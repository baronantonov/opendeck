"""SQLite база данных DJ School.

Хранит всё важное о пользователях:
- users       — профиль (id, имя, referral_code, groove_points, archetype)
- progress    — пройденные уроки (gp_earned)
- payments    — оплаты (Stars / TON / Prodamus)
- badges      — бейджи/скидки
- transactions — аудит GP (referral_signup, lesson_complete, gp_spend, etc.)
- webhook_processed — идемпотентность Prodamus

База живёт в файле dj_school.db рядом с бэкендом.
При первом запуске таблицы создаются сами. Миграции — на месте.
"""
from __future__ import annotations
import sqlite3, hashlib
from pathlib import Path
from contextlib import contextmanager
from typing import Optional

DB_PATH = Path(__file__).resolve().parent.parent / "dj_school.db"
COURSE_ID = "dj-basics"
GP_PER_LESSON = 50

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
)

# Колонки, которые добавляем миграцией (ALTER TABLE)
# UNIQUE не ставим — SQLite не разрешает ADD COLUMN с UNIQUE на существующих данных.
# Вместо этого создаём уникальный индекс отдельно.
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


def _generate_referral_code(user_id: int) -> str:
    """sha256(id)[:8] — короткий уникальный код."""
    return hashlib.sha256(str(user_id).encode()).hexdigest()[:8]


# ---------------------------------------------------------------------------
# connection
# ---------------------------------------------------------------------------

@contextmanager
def _conn():
    c = sqlite3.connect(str(DB_PATH))
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


# ---------------------------------------------------------------------------
# init / migration
# ---------------------------------------------------------------------------

def _column_exists(c, table: str, column: str) -> bool:
    cols = c.execute(f"PRAGMA table_info({table})").fetchall()
    return any(r["name"] == column for r in cols)


def init():
    """Создать таблицы (если нет) + миграции для новых колонок."""
    with _conn() as c:
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(_OLD_SCHEMA)

        # — transactions table
        c.execute(_TRANSACTIONS_TABLE)

        # — ALTER TABLE для новых колонок users
        for col, dtype in _NEW_COLUMNS.items():
            if not _column_exists(c, "users", col):
                c.execute(f"ALTER TABLE users ADD COLUMN {col} {dtype}")

        # — миграция: колонка charge_id в transactions (идемпотентность GP-списания)
        if not _column_exists(c, "transactions", "charge_id"):
            c.execute("ALTER TABLE transactions ADD COLUMN charge_id TEXT")

        # — уникальный индекс на referral_code (вместо UNIQUE в колонке)
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_refcode "
                  "ON users(referral_code)")

        # — referral_code для существующих юзеров (если NULL)
        rows = c.execute(
            "SELECT user_id FROM users WHERE referral_code IS NULL"
        ).fetchall()
        for r in rows:
            uid = r["user_id"]
            code = _generate_referral_code(uid)
            c.execute("UPDATE users SET referral_code=? WHERE user_id=?",
                      (code, uid))

        # — backfill groove_points из progress для существующих
        c.execute("""
            UPDATE users
            SET groove_points = COALESCE((
                SELECT SUM(gp_earned) FROM progress
                WHERE progress.user_id = users.user_id
            ), 0)
            WHERE groove_points = 0 AND user_id IN (
                SELECT user_id FROM progress GROUP BY user_id
            )
        """)


# ---------------------------------------------------------------------------
# users CRUD
# ---------------------------------------------------------------------------

def upsert_user(user_id, first_name=None, username=None, photo_url=None):
    with _conn() as c:
        c.execute(
            "INSERT INTO users (user_id, first_name, username, photo_url, last_seen) "
            "VALUES (?,?,?,?, datetime('now')) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "first_name=COALESCE(excluded.first_name, first_name), "
            "username=COALESCE(excluded.username, username), "
            "photo_url=COALESCE(excluded.photo_url, photo_url), "
            "last_seen=datetime('now')",
            (user_id, first_name, username, photo_url),
        )
        # если referral_code не задан — сгенерировать
        row = c.execute(
            "SELECT referral_code FROM users WHERE user_id=?",
            (user_id,)).fetchone()
        if row and not row["referral_code"]:
            code = _generate_referral_code(user_id)
            c.execute("UPDATE users SET referral_code=? WHERE user_id=?",
                      (code, user_id))


def get_user(user_id):
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
        return dict(row) if row else None


def get_referral_stats(user_id: int) -> dict:
    """Вернуть {friends_count, gp_earned} по рефералам пользователя."""
    with _conn() as c:
        ref_code = c.execute(
            "SELECT referral_code FROM users WHERE user_id=?",
            (user_id,)).fetchone()
        if not ref_code or not ref_code["referral_code"]:
            return {"friends_count": 0, "gp_earned": 0}
        code = ref_code["referral_code"]
        friends = c.execute(
            "SELECT COUNT(*) FROM users WHERE referred_by=?",
            (code,)).fetchone()[0]
        gp = c.execute(
            "SELECT COALESCE(SUM(amount),0) FROM transactions "
            "WHERE user_id=? AND action_type LIKE 'referral_%'",
            (user_id,)).fetchone()[0]
        return {"friends_count": int(friends), "gp_earned": int(gp)}


def get_user_by_referral_code(code: str) -> Optional[dict]:
    """Найти пользователя по referral_code."""
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM users WHERE referral_code=?", (code,)).fetchone()
        return dict(row) if row else None


def create_user(user_id, first_name=None, username=None, photo_url=None):
    """Создать нового пользователя с referral_code и archetype."""
    with _conn() as c:
        code = _generate_referral_code(user_id)
        c.execute(
            "INSERT INTO users "
            "(user_id, first_name, username, photo_url, referral_code, "
            " groove_points, archetype, created_at, last_seen) "
            "VALUES (?,?,?,?,?,0,'Куратор Вайба',datetime('now'),datetime('now'))",
            (user_id, first_name, username, photo_url, code),
        )
        return get_user(user_id)


# ---------------------------------------------------------------------------
# progress
# ---------------------------------------------------------------------------

def complete_lesson(user_id, course_id, lesson_id):
    """Отметить урок пройденным. Обновить groove_points в users + транзакция.

    ЗАЩИТА ОТ ФЕРМЫ (C1): если урок уже отмечен пройденным — повторно
    не начисляем GP. Иначе прямой POST /api/progress с одним lesson_id
    много раз накручивал бы Stars бесконечно.
    """
    with _conn() as c:
        already = c.execute(
            "SELECT 1 FROM progress "
            "WHERE user_id=? AND course_id=? AND lesson_id=? AND completed=1",
            (user_id, course_id, lesson_id),
        ).fetchone()
        # вставить/обновить прогресс
        c.execute(
            "INSERT INTO progress (user_id, course_id, lesson_id, completed, gp_earned) "
            "VALUES (?,?,?,1,?) "
            "ON CONFLICT(user_id, course_id, lesson_id) DO UPDATE SET "
            "completed=1, completed_at=datetime('now')",
            (user_id, course_id, lesson_id, GP_PER_LESSON),
        )
        if not already:
            # обновить groove_points в users (только за первое прохождение)
            c.execute(
                "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                (GP_PER_LESSON, user_id),
            )
            # транзакция
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type) "
                "VALUES (?,?, 'lesson_complete')",
                (user_id, GP_PER_LESSON),
            )
        total = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()[0]
    return int(total)


def get_completed(user_id, course_id=COURSE_ID):
    with _conn() as c:
        rows = c.execute(
            "SELECT lesson_id FROM progress WHERE user_id=? AND course_id=? AND completed=1",
            (user_id, course_id),
        ).fetchall()
    return [int(r["lesson_id"]) for r in rows]


def get_gp(user_id):
    """Вернуть groove_points из users (источник истины)."""
    with _conn() as c:
        row = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
        return int(row["groove_points"]) if row else 0


# ---------------------------------------------------------------------------
# referral
# ---------------------------------------------------------------------------

def apply_referral_signup(invitee_id: int, inviter_id: int):
    """Начислить бонусы при регистрации по рефссылке.

    Возвращает: inviter_code
    """
    with _conn() as c:
        inviter = c.execute(
            "SELECT referral_code FROM users WHERE user_id=?",
            (inviter_id,)
        ).fetchone()
        if not inviter:
            return None

        # +50 invitee
        c.execute("UPDATE users SET groove_points = groove_points + 50 WHERE user_id=?",
                  (invitee_id,))
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
            "VALUES (?, 50, 'referral_signup', ?)",
            (invitee_id, inviter_id),
        )

        # +30 inviter
        c.execute("UPDATE users SET groove_points = groove_points + 30 WHERE user_id=?",
                  (inviter_id,))
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
            "VALUES (?, 30, 'referral_signup_bonus', ?)",
            (inviter_id, invitee_id),
        )

        return inviter["referral_code"]


def apply_referral_purchase(invitee_id: int) -> Optional[int]:
    """Инвайте купил курс — инвайтер получает +200 GP.

    ИДЕМПОТЕНТНО: начисляем бонус инвайтеру только ОДИН раз на invitee.
    Повторный вызов (фронт + бот, или дубль webhook'а) возвращает
    inviter_id, но НЕ начисляет +200 повторно (защита от фрода/накрутки).

    Возвращает inviter_id или None.
    """
    with _conn() as c:
        row = c.execute(
            "SELECT referred_by FROM users WHERE user_id=?", (invitee_id,)
        ).fetchone()
        if not row or not row["referred_by"]:
            return None
        inviter = c.execute(
            "SELECT user_id FROM users WHERE referral_code=?",
            (row["referred_by"],)
        ).fetchone()
        if not inviter:
            return None
        inviter_id = inviter["user_id"]

        # уже начисляли за этого invitee?
        dup = c.execute(
            "SELECT 1 FROM transactions "
            "WHERE user_id=? AND action_type='referral_purchase' AND ref_user_id=? LIMIT 1",
            (inviter_id, invitee_id),
        ).fetchone()
        if not dup:
            c.execute("UPDATE users SET groove_points = groove_points + 200 WHERE user_id=?",
                      (inviter_id,))
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
                "VALUES (?, 200, 'referral_purchase', ?)",
                (inviter_id, invitee_id),
            )
        return inviter_id


# ---------------------------------------------------------------------------
# GP spending (MENTOR discount)
# ---------------------------------------------------------------------------

def apply_gp_spend(user_id: int, amount: int, charge_id: str | None = None) -> Optional[dict]:
    """Списать Stars на скидку MENTOR.

    Фактически спишет min(amount, groove_points, 7000).
    discount = actual_amount (1:1 GP = Star)
    final_price = max(14000, 21000 - discount)

    ИДЕМПОТЕНТНОСТЬ: если передан charge_id и такая транзакция
    'gp_spend' уже есть — возвращаем сохранённый результат без
    повторного списания (защита от двойного вызова ботом + фронтом
    или повторного webhook'а успешного платежа).

    Возвращает {groove_points, discount, final_price} или None (если user не найден).
    """
    with _conn() as c:
        # идемпотентность: тот же charge_id уже обработан
        if charge_id:
            dup = c.execute(
                "SELECT 1 FROM transactions WHERE charge_id=? AND action_type='gp_spend' LIMIT 1",
                (charge_id,),
            ).fetchone()
            if dup:
                row = c.execute(
                    "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
                ).fetchone()
                return {
                    "groove_points": int(row["groove_points"]) if row else 0,
                    "discount": 0,
                    "final_price": 21000,
                    "duplicate": True,
                }

        row = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
        if not row:
            return None

        # реально спишем: сколько запросили, но не больше чем есть и не больше 7000
        actual_amount = min(amount, row["groove_points"], 7000)
        if actual_amount <= 0:
            return None  # нечего списывать

        discount = actual_amount  # 1:1 — 1 GP = 1 Star
        final_price = max(14000, 21000 - discount)

        c.execute("UPDATE users SET groove_points = groove_points - ? WHERE user_id=?",
                  (actual_amount, user_id))
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type, charge_id) "
            "VALUES (?, ?, 'gp_spend', ?)",
            (user_id, -actual_amount, charge_id),
        )

        new_gp = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()[0]
        return {
            "groove_points": int(new_gp),
            "discount": discount,
            "final_price": final_price,
        }


def spend_gp(user_id: int, amount: int, reason: str = "spend") -> Optional[dict]:
    """Произвольное списание GP (streak freeze, промо-траты и т.п.).

    Спишет min(amount, groove_points). Возвращает {groove_points} или None.
    """
    with _conn() as c:
        row = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
        if not row:
            return None
        actual = min(amount, row["groove_points"])
        if actual <= 0:
            return {"groove_points": int(row["groove_points"])}
        c.execute(
            "UPDATE users SET groove_points = groove_points - ? WHERE user_id=?",
            (actual, user_id),
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) "
            "VALUES (?, ?, 'gp_spend')",
            (user_id, -actual),
        )
        new_gp = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()[0]
        return {"groove_points": int(new_gp)}


def add_gp(user_id: int, amount: int, action_type: str = "gp_earn") -> dict:
    """Начислить GP (rewarded-механика: шер/ежедневный бонус и т.п.).

    Возвращает {groove_points}.
    """
    with _conn() as c:
        c.execute(
            "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
            (amount, user_id),
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) "
            "VALUES (?, ?, ?)",
            (user_id, amount, action_type),
        )
        new_gp = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()[0]
        return {"groove_points": int(new_gp)}


def add_payment(user_id, course_id, provider, amount=None, currency=None,
                status="paid", raw=""):
    with _conn() as c:
        c.execute(
            "INSERT INTO payments (user_id, course_id, provider, amount, currency, status, raw) "
            "VALUES (?,?,?,?,?,?,?)",
            (user_id, course_id, provider, amount, currency, status, raw),
        )


def has_paid(user_id, course_id=COURSE_ID):
    with _conn() as c:
        row = c.execute(
            "SELECT 1 FROM payments WHERE user_id=? AND course_id=? AND status='paid' LIMIT 1",
            (user_id, course_id),
        ).fetchone()
    return row is not None


def grant_badge(user_id, course_id, badge):
    with _conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO badges (user_id, course_id, badge) VALUES (?,?,?)",
            (user_id, course_id, badge),
        )


def get_badges(user_id, course_id=COURSE_ID):
    with _conn() as c:
        rows = c.execute(
            "SELECT badge FROM badges WHERE user_id=? AND course_id=?",
            (user_id, course_id),
        ).fetchall()
    return [r["badge"] for r in rows]


def is_webhook_processed(order_id: str) -> bool:
    with _conn() as c:
        row = c.execute(
            "SELECT 1 FROM webhook_processed WHERE order_id=?", (order_id,)
        ).fetchone()
    return row is not None


def mark_webhook_processed(order_id: str):
    with _conn() as c:
        c.execute("INSERT OR IGNORE INTO webhook_processed (order_id) VALUES (?)",
                  (order_id,))
