"""SQLite bazza dannykh DJ School.

Hranit vsyo vazhnoe o polzovatelyah:
- users      -- kto zashel (id, imya, yuzerneym, foto, kogda)
- progress   -- kakie uroki proydeny (groove points)
- payments   -- oplaty (Stars / TON / Prodamus)
- badges     -- beydzhi/skidki

Baza zhivyot v fayle dj_school.db ryadom s bekendom.
Pri pervom zapuske tablicy sozdayutsya sami.
"""
from __future__ import annotations
import sqlite3
from pathlib import Path
from contextlib import contextmanager
from dataclasses import dataclass, asdict
from typing import Optional

DB_PATH = Path(__file__).resolve().parent.parent / "dj_school.db"

_SCHEMA = (
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
)

# GP za zavershyonnyy urok
GP_PER_LESSON = 50


@contextmanager
def _conn():
    c = sqlite3.connect(str(DB_PATH))
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init():
    """Sozdat tablicy, esli ih net."""
    with _conn() as c:
        c.executescript(_SCHEMA)


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


def get_user(user_id):
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
        return dict(row) if row else None


def complete_lesson(user_id, course_id, lesson_id):
    """Otmetit urok proydennym. Vozvrashchaet vsego GP polzovatelya."""
    with _conn() as c:
        c.execute(
            "INSERT INTO progress (user_id, course_id, lesson_id, completed, gp_earned) "
            "VALUES (?,?,?,1,?) "
            "ON CONFLICT(user_id, course_id, lesson_id) DO UPDATE SET "
            "completed=1, completed_at=datetime('now')",
            (user_id, course_id, lesson_id, GP_PER_LESSON),
        )
        total = c.execute(
            "SELECT COALESCE(SUM(gp_earned),0) FROM progress WHERE user_id=?",
            (user_id,),
        ).fetchone()[0]
    return int(total)


def get_completed(user_id, course_id="dj-basics"):
    with _conn() as c:
        rows = c.execute(
            "SELECT lesson_id FROM progress WHERE user_id=? AND course_id=? AND completed=1",
            (user_id, course_id),
        ).fetchall()
    return [int(r["lesson_id"]) for r in rows]


def get_gp(user_id):
    with _conn() as c:
        return int(c.execute(
            "SELECT COALESCE(SUM(gp_earned),0) FROM progress WHERE user_id=?",
            (user_id,),
        ).fetchone()[0])


def add_payment(user_id, course_id, provider, amount=None, currency=None, status="paid", raw=""):
    with _conn() as c:
        c.execute(
            "INSERT INTO payments (user_id, course_id, provider, amount, currency, status, raw) "
            "VALUES (?,?,?,?,?,?,?)",
            (user_id, course_id, provider, amount, currency, status, raw),
        )


def has_paid(user_id, course_id="dj-basics"):
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


def get_badges(user_id, course_id="dj-basics"):
    with _conn() as c:
        rows = c.execute(
            "SELECT badge FROM badges WHERE user_id=? AND course_id=?",
            (user_id, course_id),
        ).fetchall()
    return [r["badge"] for r in rows]
