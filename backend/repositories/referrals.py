"""Репозиторий реферальной системы (referrals & milestones)."""
from __future__ import annotations

from typing import Optional

import backend.db as db

REFERRAL_SIGNUP_INVITER_GP = 100
REFERRAL_SIGNUP_FRIEND_GP = 100
REFERRAL_PURCHASE_INVITER_GP = 500
REFERRAL_MILESTONES = {3: 300, 5: 1000, 10: 2500}


def get_referral_stats(user_id: int) -> dict:
    """Вернуть {friends_count, gp_earned} по рефералам пользователя."""
    with db._conn() as c:
        ref_code = c.execute(
            "SELECT referral_code FROM users WHERE user_id=?",
            (user_id,),
        ).fetchone()
        if not ref_code or not ref_code["referral_code"]:
            return {"friends_count": 0, "gp_earned": 0}
        code = ref_code["referral_code"]
        friends = c.execute(
            "SELECT COUNT(*) FROM users WHERE referred_by=?",
            (code,),
        ).fetchone()[0]
        gp = c.execute(
            "SELECT COALESCE(SUM(amount),0) FROM transactions "
            "WHERE user_id=? AND action_type LIKE 'referral_%'",
            (user_id,),
        ).fetchone()[0]
        return {"friends_count": int(friends), "gp_earned": int(gp)}


def apply_referral_signup(invitee_id: int, inviter_id: int):
    """Начислить бонусы при регистрации по рефссылке (ДВУСТОРОННИЙ бонус)."""
    if invitee_id == inviter_id:
        return None
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        inviter = c.execute(
            "SELECT referral_code, referred_by FROM users WHERE user_id=?",
            (inviter_id,),
        ).fetchone()
        if not inviter:
            return None

        invitee_row = c.execute(
            "SELECT referral_code FROM users WHERE user_id=?",
            (invitee_id,),
        ).fetchone()
        if (
            invitee_row
            and invitee_row["referral_code"]
            and inviter["referred_by"] == invitee_row["referral_code"]
        ):
            return None

        dup = c.execute(
            "SELECT 1 FROM transactions WHERE user_id=? AND action_type='referral_signup' LIMIT 1",
            (invitee_id,),
        ).fetchone()
        if dup:
            return inviter["referral_code"]

        c.execute(
            "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
            (REFERRAL_SIGNUP_FRIEND_GP, invitee_id),
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
            "VALUES (?, ?, 'referral_signup', ?)",
            (invitee_id, REFERRAL_SIGNUP_FRIEND_GP, inviter_id),
        )

        c.execute(
            "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
            (REFERRAL_SIGNUP_INVITER_GP, inviter_id),
        )
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
            "VALUES (?, ?, 'referral_signup_bonus', ?)",
            (inviter_id, REFERRAL_SIGNUP_INVITER_GP, invitee_id),
        )

        return inviter["referral_code"]


def apply_referral_purchase(invitee_id: int) -> Optional[int]:
    """Инвайте купил курс — инвайтер получает заработок + милестоун-бонус."""
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        row = c.execute(
            "SELECT referred_by FROM users WHERE user_id=?", (invitee_id,)
        ).fetchone()
        if not row or not row["referred_by"]:
            return None

        paid = c.execute(
            "SELECT 1 FROM payments WHERE user_id=? AND status='paid' LIMIT 1",
            (invitee_id,),
        ).fetchone()
        if not paid:
            return None

        inviter = c.execute(
            "SELECT user_id FROM users WHERE referral_code=?",
            (row["referred_by"],),
        ).fetchone()
        if not inviter:
            return None
        inviter_id = inviter["user_id"]

        dup = c.execute(
            "SELECT 1 FROM transactions "
            "WHERE user_id=? AND action_type='referral_purchase' AND ref_user_id=? LIMIT 1",
            (inviter_id, invitee_id),
        ).fetchone()
        if not dup:
            c.execute(
                "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                (REFERRAL_PURCHASE_INVITER_GP, inviter_id),
            )
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type, ref_user_id) "
                "VALUES (?, ?, 'referral_purchase', ?)",
                (inviter_id, REFERRAL_PURCHASE_INVITER_GP, invitee_id),
            )

        paid_friends = c.execute(
            "SELECT COUNT(DISTINCT ref_user_id) FROM transactions "
            "WHERE user_id=? AND action_type='referral_purchase'",
            (inviter_id,),
        ).fetchone()[0]
        for threshold, reward in sorted(REFERRAL_MILESTONES.items()):
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
