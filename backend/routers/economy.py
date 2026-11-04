"""Роутер экономики GP и реферальных начислений (/api/referral/purchase, /api/gp/*, /api/archetype/share)."""
from __future__ import annotations

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

import backend.db as db
from backend.deps import REWARD_ACTIONS, _resolve_uid, require_internal_key

router = APIRouter()


@router.post("/api/referral/purchase")
async def referral_purchase(
    req: Request,
    authorization: str | None = Header(None),
):
    if not require_internal_key(authorization):
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    uid = _resolve_uid("", authorization, body)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    inviter_id = db.apply_referral_purchase(uid)
    if inviter_id is None:
        return {
            "inviter_bonus": 0,
            "inviter_id": None,
            "gp": db.get_gp(uid),
        }

    inviter = db.get_user(inviter_id)
    with db._conn() as _c:
        earned = _c.execute(
            "SELECT COALESCE(SUM(amount),0) FROM transactions "
            "WHERE user_id=? AND action_type='referral_purchase' AND ref_user_id=?",
            (inviter_id, uid),
        ).fetchone()[0]
    return {
        "inviter_bonus": int(earned),
        "inviter_id": inviter_id,
        "inviter_code": inviter["referral_code"] if inviter else "",
        "gp": db.get_gp(uid),
    }


@router.post("/api/gp/apply")
async def gp_apply(
    req: Request,
    authorization: str | None = Header(None),
):
    if not require_internal_key(authorization):
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}

    charge_id = body.get("charge_id")
    uid = _resolve_uid("", authorization, body)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    amount = body.get("amount")
    if amount is None:
        amount = min(db.get_gp(uid), 7000)

    result = db.apply_gp_spend(uid, amount, charge_id=charge_id)
    if result is None:
        return JSONResponse({"error": "insufficient_gp"}, status_code=400)
    return result


@router.post("/api/gp/spend")
async def gp_spend(
    req: Request,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    """Произвольное списание GP (streak freeze и т.п.). Требует валидный init_data."""
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    amount = body.get("amount")
    if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0 or amount > 10000:
        return JSONResponse({"error": "bad_amount"}, status_code=400)
    reason = str(body.get("reason", "spend"))[:32]
    uid = _resolve_uid(x_init_data, None, body)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    result = db.spend_gp(uid, amount, reason=reason)
    if result is None:
        return JSONResponse({"error": "user_not_found"}, status_code=404)
    return result


@router.post("/api/gp/earn")
async def gp_earn(
    req: Request,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    """Rewarded-механика: начислить GP за действие (не чаще 1 раза в 24ч)."""
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    action = body.get("action")
    if action not in REWARD_ACTIONS:
        return JSONResponse({"error": "bad_action"}, status_code=400)
    uid = _resolve_uid(x_init_data, None, body)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    amount = REWARD_ACTIONS[action]
    result = db.add_gp(uid, amount, action_type=f"reward_{action}", cooldown_hours=24)
    if result.get("cooldown"):
        return JSONResponse({"error": "cooldown", "hint": "доступно через 24ч"}, status_code=429)
    result["amount"] = amount
    result["action"] = action
    return result


@router.post("/api/archetype/share")
async def archetype_share(
    req: Request,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    """Share-your-archetype Team Loop (+20 GP один раз, идемпотентно)."""
    uid = _resolve_uid(x_init_data, None, {})
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    return db.apply_archetype_share(uid)
