"""Репозиторий A/B экспериментов (ab_assignments)."""
from __future__ import annotations

import hashlib

import backend.db as db


def assign_ab_variant(user_id: int, experiment: str, variants: list[str]) -> str:
    """Детерминированно назначить вариант юзеру (stable между сессиями)."""
    with db._conn() as c:
        row = c.execute(
            "SELECT variant FROM ab_assignments WHERE user_id=? AND experiment=?",
            (user_id, experiment),
        ).fetchone()
        if row:
            return row["variant"]
        h = int(hashlib.sha256(f"{user_id}|{experiment}".encode()).hexdigest(), 16)
        variant = variants[h % len(variants)]
        c.execute(
            "INSERT OR IGNORE INTO ab_assignments (user_id, experiment, variant) VALUES (?,?,?)",
            (user_id, experiment, variant),
        )
        return variant


def get_ab_variant(user_id: int, experiment: str) -> str | None:
    with db._conn() as c:
        row = c.execute(
            "SELECT variant FROM ab_assignments WHERE user_id=? AND experiment=?",
            (user_id, experiment),
        ).fetchone()
        return row["variant"] if row else None
