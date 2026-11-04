"""Роутер A/B-тестирования цен и локализации (/api/ab/assign, /api/ab/track)."""
from __future__ import annotations

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

import backend.db as db
from backend.deps import AB_EXPERIMENTS, COURSE_ID, _user_id_from_init, require_internal_key

router = APIRouter()


@router.get("/api/ab/assign")
async def ab_assign(
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    """Вернуть назначенные A/B-варианты юзера (для фронт-персонализации UI/локали)."""
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    result = {}
    for exp_name, cfg in AB_EXPERIMENTS.items():
        if not cfg.get("active"):
            result[exp_name] = "control"
            continue
        variant = db.assign_ab_variant(uid, exp_name, list(cfg["variants"].keys()))
        result[exp_name] = variant
    return result


@router.post("/api/ab/track")
async def ab_track(
    req: Request,
    authorization: str | None = Header(None),
):
    """Записать A/B-вариант покупки для LTV-аналитики."""
    if not require_internal_key(authorization):
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    uid = body.get("user_id")
    course_id = body.get("course_id")
    if not uid or not course_id:
        return JSONResponse({"error": "bad_body"}, status_code=400)
    exp = "price_tripwire" if course_id == "tripwire" else ("price_full" if course_id == COURSE_ID else None)
    variant = db.get_ab_variant(uid, exp) if exp else None
    if variant:
        db.add_payment(uid, course_id, "ab_track", status="ab_track", ab_variant=f"{exp}:{variant}")
    return {"ok": True, "variant": variant}
