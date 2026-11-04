"""SQLite база данных DJ School — фасад соединения, миграций и доменных репозиториев.

Хранит всё важное о пользователях:
- users            — профиль (id, имя, referral_code, groove_points, archetype)
- progress         — пройденные уроки (gp_earned)
- payments         — оплаты (Stars / TON / Prodamus / Tribute)
- badges           — бейджи/скидки
- transactions     — аудит GP (referral_signup, lesson_complete, gp_spend, etc.)
- webhook_processed — идемпотентность Prodamus / Tribute
- gifts            — подарочные сертификаты курса
- ab_assignments   — назначенные A/B варианты

Для 100% обратной совместимости с тестами и внешними модулями `DB_PATH`, `_conn()`,
`_column_exists()` и `init()` живут здесь, а все 43 доменные функции и константы
реэкспортируются из `backend.repositories.*`.
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "dj_school.db"
DB_PATH = Path(os.getenv("DB_PATH", str(_DEFAULT_DB_PATH)))
COURSE_ID = "dj-basics"
BONUS_COURSE_ID = "dj-bonus"
GP_PER_LESSON = 50
GP_PER_BONUS = 30  # бонусные уроки от FREEDA DJ: +30 GP

_OLD_SCHEMA = (
    "CREATE TABLE IF NOT EXISTS users ("
    " user_id INTEGER PRIMARY KEY,"
    " first_name TEXT,"
    " username TEXT,"
    " photo_url TEXT,"
    " created_at TEXT DEFAULT (datetime('now')),"
    " last_seen TEXT DEFAULT (datetime('now'))"
    ");"
    "CREATE TABLE IF NOT EXISTS progress ("
    " user_id INTEGER NOT NULL,"
    " course_id TEXT NOT NULL DEFAULT 'dj-basics',"
    " lesson_id INTEGER NOT NULL,"
    " completed INTEGER NOT NULL DEFAULT 1,"
    " gp_earned INTEGER NOT NULL DEFAULT 0,"
    " completed_at TEXT DEFAULT (datetime('now')),"
    " PRIMARY KEY (user_id, course_id, lesson_id)"
    ");"
    "CREATE TABLE IF NOT EXISTS payments ("
    " id INTEGER PRIMARY KEY AUTOINCREMENT,"
    " user_id INTEGER NOT NULL,"
    " course_id TEXT NOT NULL,"
    " provider TEXT,"
    " amount INTEGER,"
    " currency TEXT,"
    " status TEXT,"
    " raw TEXT,"
    " created_at TEXT DEFAULT (datetime('now'))"
    ");"
    "CREATE TABLE IF NOT EXISTS badges ("
    " user_id INTEGER NOT NULL,"
    " course_id TEXT NOT NULL DEFAULT 'dj-basics',"
    " badge TEXT NOT NULL,"
    " granted_at TEXT DEFAULT (datetime('now')),"
    " PRIMARY KEY (user_id, course_id, badge)"
    ");"
    "CREATE TABLE IF NOT EXISTS webhook_processed ("
    " order_id TEXT PRIMARY KEY,"
    " processed_at TEXT DEFAULT (datetime('now'))"
    ");"
    "CREATE TABLE IF NOT EXISTS gifts ("
    " id INTEGER PRIMARY KEY AUTOINCREMENT,"
    " token_hash TEXT NOT NULL UNIQUE,"
    " buyer_id INTEGER NOT NULL,"
    " recipient TEXT NOT NULL,"
    " status TEXT NOT NULL DEFAULT 'pending',"
    " created_at TEXT DEFAULT (datetime('now')),"
    " paid_at TEXT,"
    " used_at TEXT"
    ");"
)

_NEW_COLUMNS = {
    "referral_code": "TEXT",
    "referred_by": "TEXT",
    "groove_points": "INTEGER DEFAULT 0",
    "archetype": "TEXT DEFAULT 'Куратор Вайба'",
}

_TRANSACTIONS_TABLE = """
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  ref_user_id INTEGER,
  charge_id TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);
"""


@contextmanager
def _conn():
    c = sqlite3.connect(str(DB_PATH), timeout=30.0)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA busy_timeout=30000")
    try:
        yield c
        c.commit()
    finally:
        c.close()


def _column_exists(c, table: str, column: str) -> bool:
    cols = c.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r["name"] == column for r in cols)


def init():
    """Создать таблицы (если нет) + миграции для новых колонок."""
    with _conn() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(_OLD_SCHEMA)
        c.execute(_TRANSACTIONS_TABLE)

        for col, dtype in _NEW_COLUMNS.items():
            if not _column_exists(c, "users", col):
                c.execute(f"ALTER TABLE users ADD COLUMN {col} {dtype}")

        if not _column_exists(c, "transactions", "charge_id"):
            c.execute("ALTER TABLE transactions ADD COLUMN charge_id TEXT")

        if not _column_exists(c, "transactions", "ab_variant"):
            c.execute("ALTER TABLE transactions ADD COLUMN ab_variant TEXT")

        c.execute("""
            CREATE TABLE IF NOT EXISTS ab_assignments (
                user_id INTEGER NOT NULL,
                experiment TEXT NOT NULL,
                variant TEXT NOT NULL,
                assigned_at TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (user_id, experiment)
            )
        """)
        cols = c.execute("PRAGMA table_info(ab_assignments)").fetchall()
        if cols:
            exp_pk = next((col["pk"] for col in cols if col["name"] == "experiment"), 0)
            if exp_pk == 0:
                c.execute("""
                    CREATE TABLE ab_assignments_new (
                        user_id INTEGER NOT NULL,
                        experiment TEXT NOT NULL,
                        variant TEXT NOT NULL,
                        assigned_at TEXT DEFAULT (datetime('now')),
                        PRIMARY KEY (user_id, experiment)
                    )
                """)
                c.execute(
                    "INSERT OR IGNORE INTO ab_assignments_new "
                    "SELECT user_id, experiment, variant, assigned_at FROM ab_assignments"
                )
                c.execute("DROP TABLE ab_assignments")
                c.execute("ALTER TABLE ab_assignments_new RENAME TO ab_assignments")

        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_refcode ON users(referral_code)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_payments_lookup ON payments(user_id, course_id, status)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_transactions_user_action ON transactions(user_id, action_type)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_transactions_charge ON transactions(charge_id)")

        rows = c.execute("SELECT user_id FROM users WHERE referral_code IS NULL").fetchall()
        for r in rows:
            uid = r["user_id"]
            code = _generate_referral_code(uid)
            c.execute("UPDATE users SET referral_code=? WHERE user_id=?", (code, uid))


# ---------------------------------------------------------------------------
# Re-exports from domain repositories (100% backward compatibility)
# ---------------------------------------------------------------------------
from backend.repositories.users import (  # noqa: E402,F401
    _generate_referral_code,
    create_user,
    get_user,
    get_user_by_referral_code,
    upsert_user,
)
from backend.repositories.lessons import (  # noqa: E402,F401
    COURSE_PRICE_STARS,
    LESSON_GP,
    complete_lesson,
    db_has_paid_course,
    get_completed,
)
from backend.repositories.economy import (  # noqa: E402,F401
    ARCHETYPE_SHARE_REWARD_GP,
    MENTOR_BASE_PRICE_RUB,
    MENTOR_BASE_PRICE_USD,
    MENTOR_MAX_GP_DISCOUNT,
    add_gp,
    apply_archetype_share,
    apply_gp_spend,
    get_badges,
    get_gp,
    grant_badge,
    spend_gp,
)
from backend.repositories.referrals import (  # noqa: E402,F401
    REFERRAL_MILESTONES,
    REFERRAL_PURCHASE_INVITER_GP,
    REFERRAL_SIGNUP_FRIEND_GP,
    REFERRAL_SIGNUP_INVITER_GP,
    apply_referral_purchase,
    apply_referral_signup,
    get_referral_stats,
)
from backend.repositories.ab_testing import (  # noqa: E402,F401
    assign_ab_variant,
    get_ab_variant,
)
from backend.repositories.payments import (  # noqa: E402,F401
    _gift_token_hash,
    activate_gift,
    add_payment,
    claim_gift,
    claim_webhook_order,
    create_gift,
    has_paid,
    is_webhook_processed,
    mark_webhook_processed,
    unclaim_webhook_order,
)
from backend.repositories.crm_repo import (  # noqa: E402,F401
    _SORT_MAP,
    _STATUS_WHERE,
    _TEST_NAMES,
    _TEST_USERNAMES,
    _test_account_filter,
    crm_delete_test_accounts,
    crm_delete_user,
    crm_get_student,
    crm_list_test_accounts,
    crm_list_users,
    crm_reset_to_free,
    crm_set_gp,
    crm_set_lesson,
    crm_stats,
)
