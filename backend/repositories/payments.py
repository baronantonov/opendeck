"""Репозиторий платежей, идемпотентности вебхуков и подарков (payments, webhook_processed, gifts)."""
from __future__ import annotations

import hashlib

import backend.db as db


def add_payment(
    user_id,
    course_id,
    provider,
    amount=None,
    currency=None,
    status="paid",
    raw="",
    ab_variant=None,
):
    with db._conn() as c:
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


def has_paid(user_id, course_id="dj-basics"):
    with db._conn() as c:
        row = c.execute(
            "SELECT 1 FROM payments WHERE user_id=? AND course_id=? AND status='paid' LIMIT 1",
            (user_id, course_id),
        ).fetchone()
    return row is not None


def is_webhook_processed(order_id: str) -> bool:
    with db._conn() as c:
        row = c.execute(
            "SELECT 1 FROM webhook_processed WHERE order_id=?", (order_id,)
        ).fetchone()
    return row is not None


def mark_webhook_processed(order_id: str):
    with db._conn() as c:
        c.execute(
            "INSERT OR IGNORE INTO webhook_processed (order_id) VALUES (?)",
            (order_id,),
        )


def claim_webhook_order(order_id: str) -> bool:
    """Атомарно пометить order_id как обработанный (защита от гонки ретраев вебхука)."""
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        cur = c.execute(
            "INSERT OR IGNORE INTO webhook_processed (order_id) VALUES (?)",
            (order_id,),
        )
        return cur.rowcount == 1


def unclaim_webhook_order(order_id: str):
    with db._conn() as c:
        c.execute("DELETE FROM webhook_processed WHERE order_id=?", (order_id,))


def _gift_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_gift(buyer_id: int, recipient: str, token: str):
    """Зарегистрировать подарок в статусе pending (до подтверждения оплаты)."""
    with db._conn() as c:
        c.execute(
            "INSERT INTO gifts (token_hash, buyer_id, recipient, status) "
            "VALUES (?,?,?,'pending')",
            (_gift_token_hash(token), buyer_id, recipient),
        )


def activate_gift(token: str, buyer_id: int) -> dict | None:
    """Бот подтвердил оплату Stars: pending -> paid. Идемпотентно."""
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        row = c.execute(
            "SELECT id, buyer_id, status FROM gifts WHERE token_hash=?",
            (_gift_token_hash(token),),
        ).fetchone()
        if not row or int(row["buyer_id"]) != int(buyer_id):
            return None
        if row["status"] != "pending":
            return {"duplicate": True}
        cur = c.execute(
            "UPDATE gifts SET status='paid', paid_at=datetime('now') "
            "WHERE id=? AND buyer_id=? AND status='pending'",
            (row["id"], buyer_id),
        )
        if cur.rowcount == 0:
            return None
        return {"ok": True}


def claim_gift(recipient: str, token: str | None = None) -> dict | None:
    """Получатель открыл gift-ссылку: paid -> used (один раз)."""
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        row = None
        if token:
            row = c.execute(
                "SELECT id, buyer_id FROM gifts "
                "WHERE token_hash=? AND recipient=? AND status='paid' LIMIT 1",
                (_gift_token_hash(token), recipient),
            ).fetchone()
        if not row:
            row = c.execute(
                "SELECT id, buyer_id FROM gifts "
                "WHERE recipient=? AND status='paid' ORDER BY created_at LIMIT 1",
                (recipient,),
            ).fetchone()
        if not row:
            return None
        cur = c.execute(
            "UPDATE gifts SET status='used', used_at=datetime('now') "
            "WHERE id=? AND status='paid'",
            (row["id"],),
        )
        if cur.rowcount == 0:
            return None
        return {"gift_id": row["id"], "buyer_id": row["buyer_id"]}
