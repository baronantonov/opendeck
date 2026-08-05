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
BONUS_COURSE_ID = "dj-bonus"
GP_PER_LESSON = 50
GP_PER_BONUS = 200  # бонусные (теоретич.) уроки — жирный стимул досмотреть (рост вовлечённости)

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

        # — миграция: колонка ab_variant в transactions (LTV по A/B-вариантам)
        if not _column_exists(c, "transactions", "ab_variant"):
            c.execute("ALTER TABLE transactions ADD COLUMN ab_variant TEXT")

        # — таблица A/B-назначений (эксперименты по ценам/локализации)
        c.execute("""
            CREATE TABLE IF NOT EXISTS ab_assignments (
                user_id INTEGER PRIMARY KEY,
                experiment TEXT NOT NULL,
                variant TEXT NOT NULL,
                assigned_at TEXT DEFAULT (datetime('now'))
            )
        """)

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

    GP по типу курса: основной = GP_PER_LESSON (50), бонусный (теория) =
    GP_PER_BONUS (200) — жирный стимул досмотреть необязательную теорию.
    """
    is_bonus = (course_id == BONUS_COURSE_ID)
    gp_gain = GP_PER_BONUS if is_bonus else GP_PER_LESSON
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
            (user_id, course_id, lesson_id, gp_gain),
        )
        if not already:
            # обновить groove_points в users (только за первое прохождение)
            c.execute(
                "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                (gp_gain, user_id),
            )
            # транзакция
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type) "
                "VALUES (?,?, 'lesson_complete')",
                (user_id, gp_gain),
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
    """Начислить бонусы при регистрации по рефссылке (ДВУСТОРОННИЙ бонус).

    Invitee +100 GP, Inviter +100 GP — симметричный win-win (Dropbox/Tesla
    растут x2 на двустороннем бонусе). Рефералка — главный бесплатный
    канал роста для короткого курса (1-2 дня прохождения).

    Возвращает: inviter_code

    Защита от самореферальной петли (фрод): invitee не может быть
    собственным инвайтером — иначе он сам себе начисляет +100 и +100 GP.
    """
    SIGNUP_INVITEE = 100
    SIGNUP_INVITER = 100
    if invitee_id == inviter_id:
        return None
    with _conn() as c:
        inviter = c.execute(
            "SELECT referral_code FROM users WHERE user_id=?",
            (inviter_id,)
        ).fetchone()
        if not inviter:
            return None

        # +100 invitee
        c.execute("UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                  (SIGNUP_INVITEE, invitee_id,))
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
            "VALUES (?, ?, 'referral_signup', ?)",
            (invitee_id, SIGNUP_INVITEE, inviter_id),
        )

        # +100 inviter
        c.execute("UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                  (SIGNUP_INVITER, inviter_id,))
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
            "VALUES (?, ?, 'referral_signup_bonus', ?)",
            (inviter_id, SIGNUP_INVITER, invitee_id),
        )

        return inviter["referral_code"]


def apply_referral_purchase(invitee_id: int) -> Optional[int]:
    """Инвайте купил курс — инвайтер получает заработок + милестоун-бонус.

    Базовый заработок инвайтера за покупку рефералом: +500 GP (закрываем
    petлю жирно — главный бесплатный канал роста). Плюс Tiered-милестоуны
    за количество приведённых ПЛАТЯЩИХ друзей:
        3 друга  → +300
        5 друзей → +1000
        10 друзей→ +2500
    Милестоуны начисляются один раз при достижении порога (идемпотентно по
    action_type + ref-счёту друзей).

    ИДЕМПОТЕНТНО: базовый бонус и каждый милестоун начисляются ОДИН раз
    на invitee / на порог. Повторный вызов возвращает inviter_id, но НЕ
    начисляет повторно (защита от фрода/накрутки).

    Возвращает inviter_id или None.
    """
    PURCHASE_BONUS = 500
    MILESTONES = {3: 300, 5: 1000, 10: 2500}  # друзей → GP
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

        # уже начисляли базовый бонус за этого invitee?
        dup = c.execute(
            "SELECT 1 FROM transactions "
            "WHERE user_id=? AND action_type='referral_purchase' AND ref_user_id=? LIMIT 1",
            (inviter_id, invitee_id),
        ).fetchone()
        if not dup:
            c.execute("UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                      (PURCHASE_BONUS, inviter_id,))
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
                "VALUES (?, ?, 'referral_purchase', ?)",
                (inviter_id, PURCHASE_BONUS, invitee_id),
            )

        # Tiered-милестоуны: считаем платящих друзей инвайтера
        paid_friends = c.execute(
            "SELECT COUNT(DISTINCT ref_user_id) FROM transactions "
            "WHERE user_id=? AND action_type='referral_purchase'",
            (inviter_id,),
        ).fetchone()[0]
        for threshold, reward in sorted(MILESTONES.items()):
            if paid_friends >= threshold:
                m_dup = c.execute(
                    "SELECT 1 FROM transactions "
                    "WHERE user_id=? AND action_type='referral_milestone' "
                    "AND ref_user_id=? LIMIT 1",
                    (inviter_id, threshold),
                ).fetchone()
                if not m_dup:
                    c.execute(
                        "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                        (reward, inviter_id),
                    )
                    c.execute(
                        "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
                        "VALUES (?, ?, 'referral_milestone', ?)",
                        (inviter_id, reward, threshold),
                    )
        return inviter_id

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


def apply_archetype_share(user_id: int) -> dict:
    """Share-your-archetype Team Loop (флагман гэймификации).

    Пользователь шерит карточку своего архетипа (DJ-персоны) с зашитой
    рефералкой. Это White-Hat (identity expression, по Octalysis) — шерится
    сама личность, а не «+20⭐ за друга», поэтому конверсия выше и не читается
    как спам. Возвращаем +20 GP ЗА ОДИН РАЗ (idempotent по action_type).

    ИДЕМПОТЕНТНОСТЬ (защита от фрода/накрутки): если транзакция
    'archetype_share' для user уже есть — НЕ начисляем повторно, возвращаем
    текущий баланс с shared=True, amount=0. Это ловит реплей эндпоинта и
    двойной тап на кнопку «Поделиться».

    Возвращает {groove_points, shared, amount}.
    """
    SHARE_REWARD = 20
    with _conn() as c:
        _uid = int(user_id)
        already = c.execute(
            "SELECT 1 FROM transactions WHERE user_id=? "
            "AND action_type='archetype_share' LIMIT 1",
            (_uid,),
        ).fetchone()
        if already:
            row = c.execute(
                "SELECT groove_points FROM users WHERE user_id=?", (_uid,)
            ).fetchone()
            return {
                "groove_points": int(row["groove_points"]),
                "shared": True,
                "amount": 0,
            }
        # guard + award в ОДНОЙ транзакции (нет race / farm)
        c.execute(
            "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
            (SHARE_REWARD, _uid),
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) "
            "VALUES (?, ?, 'archetype_share')",
            (_uid, SHARE_REWARD),
        )
        new_gp = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (_uid,)
        ).fetchone()[0]
        return {"groove_points": int(new_gp), "shared": True, "amount": SHARE_REWARD}


# ---------------------------------------------------------------------------
# A/B experiments (цены / локализация)
# ---------------------------------------------------------------------------

def assign_ab_variant(user_id: int, experiment: str, variants: list[str]) -> str:
    """Детерминированно назначить вариант юзеру (stable между сессиями).

    Хэш user_id+experiment → индекс варианта. Если уже назначен — вернуть
    сохранённый (важно для честного измерения LTV).
    """
    with _conn() as c:
        row = c.execute(
            "SELECT variant FROM ab_assignments WHERE user_id=? AND experiment=?",
            (user_id, experiment),
        ).fetchone()
        if row:
            return row["variant"]
        # детерминированный выбор: hash(uid|exp) % len(variants)
        h = int(hashlib.sha256(f"{user_id}|{experiment}".encode()).hexdigest(), 16)
        variant = variants[h % len(variants)]
        c.execute(
            "INSERT OR IGNORE INTO ab_assignments (user_id, experiment, variant) VALUES (?,?,?)",
            (user_id, experiment, variant),
        )
        return variant


def get_ab_variant(user_id: int, experiment: str) -> str | None:
    with _conn() as c:
        row = c.execute(
            "SELECT variant FROM ab_assignments WHERE user_id=? AND experiment=?",
            (user_id, experiment),
        ).fetchone()
        return row["variant"] if row else None


def add_payment(user_id, course_id, provider, amount=None, currency=None,
                status="paid", raw="", ab_variant=None):
    with _conn() as c:
        c.execute(
            "INSERT INTO payments (user_id, course_id, provider, amount, currency, status, raw) "
            "VALUES (?,?,?,?,?,?,?)",
            (user_id, course_id, provider, amount, currency, status, raw),
        )
        if ab_variant:
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type, ab_variant) "
                "VALUES (?, 0, 'purchase_ab', ?)",
                (user_id, ab_variant),
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


# ---------------------------------------------------------------------------
# CRM: редактирование (удаление / баланс)
# ---------------------------------------------------------------------------

# Явные признаки тестовых аккаунтов (e2e/adhoc-прогоны).
_TEST_NAMES = ("Tester", "E2E", "Adhoc", "LiveAdhoc", "Live3")
_TEST_USERNAMES = ("tester",)


def _test_account_filter() -> str:
    names = ", ".join("?" * len(_TEST_NAMES))
    unames = ", ".join("?" * len(_TEST_USERNAMES))
    return (
        f"(u.first_name IN ({names}) OR u.username IN ({unames}) "
        f"OR u.first_name LIKE 'Live%')"
    )


def crm_list_test_accounts() -> list[dict]:
    """Предпросмотр тестовых аккаунтов (dry-run перед удалением)."""
    with _conn() as c:
        rows = c.execute(
            f"SELECT user_id, first_name, username, groove_points FROM users u "
            f"WHERE {_test_account_filter()}",
            _TEST_NAMES + _TEST_USERNAMES,
        ).fetchall()
    return [dict(r) for r in rows]


def crm_delete_test_accounts() -> dict:
    """Каскадно удалить тестовые аккаунты. Возвращает {deleted, ids}."""
    ids = [r["user_id"] for r in crm_list_test_accounts()]
    if not ids:
        return {"deleted": 0, "ids": []}
    with _conn() as c:
        for uid in ids:
            c.execute("DELETE FROM progress WHERE user_id=?", (uid,))
            c.execute("DELETE FROM payments WHERE user_id=?", (uid,))
            c.execute("DELETE FROM transactions WHERE user_id=?", (uid,))
            c.execute("DELETE FROM badges WHERE user_id=?", (uid,))
            c.execute("DELETE FROM ab_assignments WHERE user_id=?", (uid,))
            c.execute("DELETE FROM users WHERE user_id=?", (uid,))
    return {"deleted": len(ids), "ids": ids}


def crm_delete_user(user_id: int) -> bool:
    """Каскадно удалить одного пользователя. Возвращает True, если был удалён."""
    u = get_user(user_id)
    if not u:
        return False
    with _conn() as c:
        c.execute("DELETE FROM progress WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM payments WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM transactions WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM badges WHERE user_id=?", (user_id,))
        c.execute("DELETE FROM ab_assignments WHERE user_id=?", (user_id,))
        # сбросить referred_by у тех, кто ссылался на этого юзера
        c.execute("UPDATE users SET referred_by=NULL WHERE referred_by=("
                  "SELECT referral_code FROM users WHERE user_id=?)", (user_id,))
        c.execute("DELETE FROM users WHERE user_id=?", (user_id,))
    return True


def crm_reset_to_free(user_id: int) -> bool:
    """Сбросить аккаунт в «бесплатный»: удалить все платежи (status='paid').
    GP, прогресс уроков и бейджи НЕ трогаем — только платёжный статус.
    Возвращает True, если юзер существует."""
    u = get_user(user_id)
    if not u:
        return False
    with _conn() as c:
        c.execute("DELETE FROM payments WHERE user_id=?", (user_id,))
    return True


def crm_set_gp(user_id: int, amount: int, mode: str = "set") -> dict | None:
    """Изменить баланс GP («счёт в звёздах», 1 GP = 1 Star).

    mode:
      'set'     — установить groove_points = amount (неотрицательно)
      'add'     — groove_points += amount
      'subtract'— groove_points -= amount (не ниже 0)
    Пишет транзакцию в transactions (action_type='crm_gp_set/add/sub').
    Возвращает {groove_points} или None, если юзер не найден.
    """
    u = get_user(user_id)
    if not u:
        return None
    current = int(u.get("groove_points", 0) or 0)
    if mode == "set":
        new = max(0, int(amount))
    elif mode == "add":
        new = current + int(amount)
    elif mode == "subtract":
        new = max(0, current - int(amount))
    else:
        return None
    action = {"set": "crm_gp_set", "add": "crm_gp_add", "subtract": "crm_gp_sub"}[mode]
    with _conn() as c:
        c.execute("UPDATE users SET groove_points=? WHERE user_id=?", (new, user_id))
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) VALUES (?,?,?)",
            (user_id, new - current, action),
        )
    return {"groove_points": new, "delta": new - current}


# ---------------------------------------------------------------------------
# CRM (admin panel)
# ---------------------------------------------------------------------------

def crm_stats() -> dict:
    """Агрегированная статистика для дашборда CRM.
    Платежи-сироты (user_id отсутствует в users) игнорируются — иначе
    мусорные записи завышают счётчик платных."""
    with _conn() as c:
        total = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        paid_full = c.execute(
            "SELECT COUNT(DISTINCT p.user_id) FROM payments p "
            "JOIN users u ON u.user_id=p.user_id "
            "WHERE p.course_id='dj-basics' AND p.status='paid'").fetchone()[0]
        paid_tw = c.execute(
            "SELECT COUNT(DISTINCT p.user_id) FROM payments p "
            "JOIN users u ON u.user_id=p.user_id "
            "WHERE p.course_id='tripwire' AND p.status='paid'").fetchone()[0]
        paid_mentor = c.execute(
            "SELECT COUNT(DISTINCT p.user_id) FROM payments p "
            "JOIN users u ON u.user_id=p.user_id "
            "WHERE p.course_id='mentoring' AND p.status='paid'").fetchone()[0]
        revenue_stars = c.execute(
            "SELECT COALESCE(SUM(p.amount),0) FROM payments p "
            "JOIN users u ON u.user_id=p.user_id "
            "WHERE p.status='paid' AND p.amount IS NOT NULL").fetchone()[0]
        active_today = c.execute(
            "SELECT COUNT(*) FROM users WHERE last_seen >= datetime('now','-1 day')"
        ).fetchone()[0]
        new_week = c.execute(
            "SELECT COUNT(*) FROM users WHERE created_at >= datetime('now','-7 day')"
        ).fetchone()[0]
        total_gp = c.execute(
            "SELECT COALESCE(SUM(groove_points),0) FROM users").fetchone()[0]
        referrals_total = c.execute(
            "SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL").fetchone()[0]
    return {
        "total_users": int(total),
        "paid_full": int(paid_full),
        "paid_tripwire": int(paid_tw),
        "paid_mentor": int(paid_mentor),
        "paid_any": int(paid_full) + int(paid_tw) + int(paid_mentor),
        "revenue_stars": int(revenue_stars),
        "active_today": int(active_today),
        "new_week": int(new_week),
        "total_gp": int(total_gp),
        "referrals_total": int(referrals_total),
    }


_SORT_MAP = {
    "name": "u.first_name COLLATE NOCASE",
    "created": "u.created_at",
    "last_seen": "u.last_seen",
    "gp": "u.groove_points",
    "refers": "refers_count",
    "lessons": "lessons_done",
    "bonus": "bonus_done",
}
_STATUS_WHERE = {
    "free": "NOT EXISTS (SELECT 1 FROM payments p WHERE p.user_id=u.user_id AND p.status='paid')",
    "paid": ("EXISTS (SELECT 1 FROM payments p WHERE p.user_id=u.user_id AND p.status='paid' "
             "AND p.course_id IN ('dj-basics','tripwire'))"),
    "vip": ("EXISTS (SELECT 1 FROM payments p WHERE p.user_id=u.user_id AND p.status='paid' "
            "AND p.course_id='mentoring')"),
}


def crm_list_users(q=None, status="all", sort="created", order="desc",
                   page=1, per_page=25) -> dict:
    """Список учеников с фильтрами, сортировкой и пагинацией.

    Возвращает {total, page, per_page, students:[...]}.
    """
    page = max(1, int(page))
    per_page = min(100, max(1, int(per_page)))
    sort_col = _SORT_MAP.get(sort, "u.created_at")
    order_sql = "ASC" if order == "asc" else "DESC"

    where = []
    params = []
    if q:
        like = f"%{q}%"
        where.append("(u.first_name LIKE ? OR u.username LIKE ? "
                     "OR u.referral_code LIKE ? OR CAST(u.user_id AS TEXT) LIKE ?)")
        params += [like, like, like, like]
    if status in _STATUS_WHERE:
        where.append(_STATUS_WHERE[status])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    with _conn() as c:
        total = c.execute(f"SELECT COUNT(*) FROM users u {where_sql}", params
                          ).fetchone()[0]
        rows = c.execute(
            f"""
            SELECT u.*,
              (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.referral_code) AS refers_count,
              (SELECT COUNT(*) FROM progress pr WHERE pr.user_id=u.user_id
                 AND pr.completed=1 AND pr.course_id='dj-basics') AS lessons_done,
              (SELECT COUNT(*) FROM progress pb WHERE pb.user_id=u.user_id
                 AND pb.completed=1 AND pb.course_id='dj-bonus') AS bonus_done,
              (SELECT COUNT(*) FROM payments p WHERE p.user_id=u.user_id AND p.status='paid') AS paid_count
            FROM users u
            {where_sql}
            ORDER BY {sort_col} {order_sql}
            LIMIT ? OFFSET ?
            """,
            params + [per_page, (page - 1) * per_page],
        ).fetchall()

    students = []
    for r in rows:
        d = dict(r)
        paid_count = int(d.get("paid_count", 0) or 0)
        is_vip = db_has_paid_course(d["user_id"], "mentoring")
        is_full = db_has_paid_course(d["user_id"], "dj-basics")
        is_tw = db_has_paid_course(d["user_id"], "tripwire")
        if is_vip:
            seg = "vip"
        elif paid_count > 0:
            seg = "paid"
        else:
            seg = "free"
        students.append({
            "user_id": d["user_id"],
            "first_name": d.get("first_name") or "",
            "username": d.get("username") or "",
            "photo_url": d.get("photo_url") or "",
            "referral_code": d.get("referral_code") or "",
            "archetype": d.get("archetype") or "",
            "groove_points": int(d.get("groove_points", 0) or 0),
            "created_at": d.get("created_at") or "",
            "last_seen": d.get("last_seen") or "",
            "refers_count": int(d.get("refers_count", 0) or 0),
            "lessons_done": int(d.get("lessons_done", 0) or 0),
            "bonus_done": int(d.get("bonus_done", 0) or 0),
            "bonus_unlocked": min(int(d.get("lessons_done", 0) or 0) + 1, 4),
            "paid_full": is_full,
            "paid_tripwire": is_tw,
            "paid_mentor": is_vip,
            "status": seg,
        })
    return {
        "total": int(total),
        "page": page,
        "per_page": per_page,
        "students": students,
    }


def db_has_paid_course(user_id, course_id) -> bool:
    """Обертка над has_paid для внутреннего использования в цикле."""
    return has_paid(user_id, course_id)


def crm_set_lesson(user_id: int, course_id: str, lesson_id: int, completed: bool) -> dict | None:
    """Переключить статус урока в прогрессе (CRM-редактирование).

    При завершлении (completed=True) начисляет GP_PER_LESSON, если урок ещё
    не был отмечен. При снятии (completed=False) — откатывает GP и удаляет
    строку прогресса. Пишет транзакцию crm_lesson_* для аудита.
    Возвращает {groove_points, completed} или None, если юзер не найден.
    """
    u = get_user(user_id)
    if not u:
        return None
    with _conn() as c:
        existing = c.execute(
            "SELECT 1 FROM progress WHERE user_id=? AND course_id=? AND lesson_id=? AND completed=1",
            (user_id, course_id, lesson_id),
        ).fetchone()
        if completed and not existing:
            gp_gain = GP_PER_BONUS if course_id == BONUS_COURSE_ID else GP_PER_LESSON
            c.execute(
                "INSERT INTO progress (user_id, course_id, lesson_id, completed, gp_earned) "
                "VALUES (?,?,?,1,?) "
                "ON CONFLICT(user_id, course_id, lesson_id) DO UPDATE SET completed=1, completed_at=datetime('now')",
                (user_id, course_id, lesson_id, gp_gain),
            )
            c.execute("UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                      (gp_gain, user_id))
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type) VALUES (?, ?, 'crm_lesson_add')",
                (user_id, gp_gain),
            )
        elif not completed:
            c.execute("DELETE FROM progress WHERE user_id=? AND course_id=? AND lesson_id=?",
                      (user_id, course_id, lesson_id))
            if existing:
                c.execute("UPDATE users SET groove_points = MAX(0, groove_points - ?) WHERE user_id=?",
                          (GP_PER_LESSON, user_id))
                c.execute(
                    "INSERT INTO transactions (user_id, amount, action_type) VALUES (?, ?, 'crm_lesson_remove')",
                    (user_id, -GP_PER_LESSON),
                )
        gp = c.execute("SELECT groove_points FROM users WHERE user_id=?", (user_id,)).fetchone()[0]
    return {"groove_points": int(gp), "completed": bool(completed)}


def crm_get_student(user_id: int) -> dict | None:
    """Полный профиль ученика для drawer'а CRM."""
    u = get_user(user_id)
    if not u:
        return None
    with _conn() as c:
        payments = [dict(r) for r in c.execute(
            "SELECT id, course_id, provider, amount, currency, status, created_at "
            "FROM payments WHERE user_id=? ORDER BY created_at DESC",
            (user_id,)).fetchall()]
        transactions = [dict(r) for r in c.execute(
            "SELECT id, amount, action_type, ref_user_id, timestamp "
            "FROM transactions WHERE user_id=? ORDER BY timestamp DESC LIMIT 200",
            (user_id,)).fetchall()]
        referrals = [dict(r) for r in c.execute(
            "SELECT user_id, first_name, username, groove_points, created_at "
            "FROM users WHERE referred_by=(SELECT referral_code FROM users WHERE user_id=?) "
            "ORDER BY created_at DESC", (user_id,)).fetchall()]
        lessons = [dict(r) for r in c.execute(
            "SELECT course_id, lesson_id, completed, gp_earned, completed_at "
            "FROM progress WHERE user_id=? ORDER BY course_id, lesson_id",
            (user_id,)).fetchall()]
    inviter = None
    if u.get("referred_by"):
        inviter = get_user_by_referral_code(u["referred_by"])
    return {
        "user": u,
        "payments": payments,
        "transactions": transactions,
        "referrals": referrals,
        "referrals_count": len(referrals),
        "inviter": (dict(inviter) if inviter else None),
        "lessons": lessons,
        "badges": get_badges(user_id),
        "gp": int(u.get("groove_points", 0) or 0),
        "paid_full": has_paid(user_id, "dj-basics"),
        "paid_tripwire": has_paid(user_id, "tripwire"),
        "paid_mentor": has_paid(user_id, "mentoring"),
    }
