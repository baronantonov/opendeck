"""Репозиторий пользователей (users CRUD)."""
from __future__ import annotations

import hashlib
from typing import Optional

import backend.db as db


def _generate_referral_code(user_id: int) -> str:
    """sha256(id)[:8] — короткий уникальный код."""
    return hashlib.sha256(str(user_id).encode()).hexdigest()[:8]


def upsert_user(user_id, first_name=None, username=None, photo_url=None):
    with db._conn() as c:
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
        row = c.execute(
            "SELECT referral_code FROM users WHERE user_id=?",
            (user_id,),
        ).fetchone()
        if row and not row["referral_code"]:
            code = _generate_referral_code(user_id)
            c.execute(
                "UPDATE users SET referral_code=? WHERE user_id=?",
                (code, user_id),
            )


def get_user(user_id):
    with db._conn() as c:
        row = c.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
        return dict(row) if row else None


def get_user_by_referral_code(code: str) -> Optional[dict]:
    """Найти пользователя по referral_code."""
    with db._conn() as c:
        row = c.execute(
            "SELECT * FROM users WHERE referral_code=?", (code,)
        ).fetchone()
        return dict(row) if row else None


def create_user(user_id, first_name=None, username=None, photo_url=None):
    """Создать нового пользователя с referral_code и archetype."""
    with db._conn() as c:
        code = _generate_referral_code(user_id)
        c.execute(
            "INSERT INTO users "
            "(user_id, first_name, username, photo_url, referral_code, "
            " groove_points, archetype, created_at, last_seen) "
            "VALUES (?,?,?,?,?,0,'Куратор Вайба',datetime('now'),datetime('now'))",
            (user_id, first_name, username, photo_url, code),
        )
    return get_user(user_id)
