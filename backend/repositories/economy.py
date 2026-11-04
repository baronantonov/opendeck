"""Репозиторий экономики GP и бейджей (groove_points, transactions, badges)."""
from __future__ import annotations

from typing import Optional

import backend.db as db

MENTOR_BASE_PRICE_USD = 250
MENTOR_BASE_PRICE_RUB = 23900
MENTOR_MAX_GP_DISCOUNT = 7000
ARCHETYPE_SHARE_REWARD_GP = 20


def get_gp(user_id):
    """Вернуть groove_points из users (источник истины)."""
    with db._conn() as c:
        row = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
        return int(row["groove_points"]) if row else 0


def apply_gp_spend(user_id: int, amount: int, charge_id: str | None = None) -> Optional[dict]:
    """Списать Stars на скидку MENTOR (идемпотентно по charge_id)."""
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
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

        try:
            amount = int(amount)
        except (TypeError, ValueError):
            return None
        if amount <= 0:
            return None

        row = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
        if not row:
            return None

        actual_amount = min(amount, int(row["groove_points"]), MENTOR_MAX_GP_DISCOUNT)
        if actual_amount <= 0:
            return None

        discount = actual_amount
        final_price = max(14000, 21000 - discount)

        c.execute(
            "UPDATE users SET groove_points = groove_points - ? WHERE user_id=?",
            (actual_amount, user_id),
        )
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
    """Произвольное списание GP (streak freeze, промо-траты и т.п.)."""
    try:
        amount = int(amount)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    clean_reason = "".join(
        ch for ch in str(reason or "spend") if ch.isalnum() or ch in ("_", "-")
    )[:32] or "spend"
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        row = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()
        if not row:
            return None
        actual = min(amount, int(row["groove_points"]))
        if actual <= 0:
            return {"groove_points": int(row["groove_points"])}
        c.execute(
            "UPDATE users SET groove_points = groove_points - ? WHERE user_id=?",
            (actual, user_id),
        )
        action_name = (
            f"gp_spend_{clean_reason}"
            if clean_reason and clean_reason != "spend"
            else "gp_spend"
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) VALUES (?, ?, ?)",
            (user_id, -actual, action_name),
        )
        new_gp = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()[0]
        return {"groove_points": int(new_gp)}


def add_gp(
    user_id: int,
    amount: int,
    action_type: str = "gp_earn",
    cooldown_hours: int | None = None,
) -> dict:
    """Начислить GP (rewarded-механика: шер/ежедневный бонус и т.п.)."""
    amount = int(amount)
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        if cooldown_hours is not None and cooldown_hours > 0:
            recent = c.execute(
                "SELECT 1 FROM transactions WHERE user_id=? AND action_type=? "
                f"AND timestamp > datetime('now', '-{int(cooldown_hours)} hours') LIMIT 1",
                (user_id, action_type),
            ).fetchone()
            if recent:
                row = c.execute(
                    "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
                ).fetchone()
                return {
                    "groove_points": int(row["groove_points"]) if row else 0,
                    "cooldown": True,
                }
        c.execute(
            "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
            (amount, user_id),
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) VALUES (?, ?, ?)",
            (user_id, amount, action_type),
        )
        new_gp = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()[0]
        return {"groove_points": int(new_gp)}


def apply_archetype_share(user_id: int) -> dict:
    """Share-your-archetype Team Loop (+20 GP один раз, идемпотентно)."""
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
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
        c.execute(
            "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
            (ARCHETYPE_SHARE_REWARD_GP, _uid),
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) "
            "VALUES (?, ?, 'archetype_share')",
            (_uid, ARCHETYPE_SHARE_REWARD_GP),
        )
        new_gp = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (_uid,)
        ).fetchone()[0]
        return {
            "groove_points": int(new_gp),
            "shared": True,
            "amount": ARCHETYPE_SHARE_REWARD_GP,
        }


def grant_badge(user_id, course_id, badge):
    with db._conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO badges (user_id, course_id, badge) VALUES (?,?,?)",
            (user_id, course_id, badge),
        )


def get_badges(user_id, course_id="dj-basics"):
    with db._conn() as c:
        rows = c.execute(
            "SELECT badge FROM badges WHERE user_id=? AND course_id=?",
            (user_id, course_id),
        ).fetchall()
    return [r["badge"] for r in rows]
