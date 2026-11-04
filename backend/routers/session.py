"""Роутер сессии и профиля пользователя (/api/init, /api/profile)."""
from __future__ import annotations

import json
import os

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from backend.auth import verify_init_data
import backend.db as db
from backend.deps import (
    BONUS_OLD_IDS,
    COURSE_ID,
    MAIN_OLD_IDS,
    OLD_TO_NEW,
    TOTAL_MAIN,
    _bot_token,
    _course_response,
    _extract_gift_token,
    _user_id_from_init,
    _user_response,
    require_internal_key,
)
from backend.schemas import InitRequest

router = APIRouter()


@router.post("/api/init")
async def api_init(
    body: InitRequest,
    authorization: str | None = Header(None),
):
    if require_internal_key(authorization) and body.user_id:
        uid = int(body.user_id)
        existing = db.get_user(uid)
        ref_stats = db.get_referral_stats(uid)
        return {
            "user": _user_response(uid) if existing else {},
            "course": _course_response(uid),
            "bonus": None,
            "referral_friends": ref_stats["friends_count"],
            "referral_gp_earned": ref_stats["gp_earned"],
            "paid_full": db.has_paid(uid, COURSE_ID),
            "paid_tripwire": db.has_paid(uid, "tripwire"),
            "paid": db.has_paid(uid, COURSE_ID) or db.has_paid(uid, "tripwire"),
        }

    if not body.init_data:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    data = verify_init_data(body.init_data, _bot_token())
    if not data:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    try:
        tu = json.loads(data["user"])
    except (KeyError, json.JSONDecodeError):
        return JSONResponse({"error": "bad_user_data"}, status_code=400)

    uid = tu.get("id")
    first_name = tu.get("first_name")
    username = tu.get("username")
    photo_url = tu.get("photo_url")

    existing = db.get_user(uid)
    if existing:
        db.upsert_user(uid, first_name, username, photo_url)
    else:
        db.create_user(uid, first_name, username, photo_url)

    bonus = None
    sp = body.start_param or ""
    if sp.startswith("ref_") and existing is None:
        ref_code = sp[4:]
        inviter = db.get_user_by_referral_code(ref_code)
        if inviter and inviter["user_id"] != uid:
            with db._conn() as c:
                c.execute(
                    "UPDATE users SET referred_by=? WHERE user_id=?",
                    (ref_code, uid),
                )
            inviter_code = db.apply_referral_signup(uid, inviter["user_id"])
            if inviter_code:
                bonus = {
                    "type": "referral_signup",
                    "amount": 100,
                    "message": "🎁 Подарок от друга! Тебе начислено 100 GP",
                }
    elif sp.startswith("ref_") and existing and not existing.get("referred_by"):
        ref_code = sp[4:]
        inviter = db.get_user_by_referral_code(ref_code)
        my_code = existing.get("referral_code")
        if (
            inviter
            and inviter["user_id"] != uid
            and (not my_code or inviter.get("referred_by") != my_code)
        ):
            with db._conn() as c:
                c.execute(
                    "UPDATE users SET referred_by=? WHERE user_id=?",
                    (ref_code, uid),
                )
            db.apply_referral_signup(uid, inviter["user_id"])
    elif sp.startswith("gift_"):
        target_recipient, gift_token_arg = _extract_gift_token(sp[5:])
        my_username = (username or "").strip().lower()
        if target_recipient and (target_recipient == my_username or target_recipient == str(uid)):
            if not db.has_paid(uid, COURSE_ID):
                claimed = db.claim_gift(target_recipient, token=gift_token_arg)
                if claimed:
                    db.add_payment(uid, COURSE_ID, provider="gift", status="paid")
                    bonus = {
                        "type": "gift_accepted",
                        "amount": 0,
                        "message": "🎁 Тебе подарили полный курс Open Deck! Все уроки открыты.",
                    }

    is_paid = db.has_paid(uid, COURSE_ID) or db.has_paid(uid, "tripwire")
    ref_stats = db.get_referral_stats(uid)
    return {
        "user": _user_response(uid),
        "course": _course_response(uid),
        "bonus": bonus,
        "referral_friends": ref_stats["friends_count"],
        "referral_gp_earned": ref_stats["gp_earned"],
        "paid_full": db.has_paid(uid, COURSE_ID),
        "paid_tripwire": db.has_paid(uid, "tripwire"),
        "paid": is_paid,
        "tribe_invite_link": os.getenv("TRIBE_INVITE_LINK", "https://t.me/+S9cLCiFHbWQzY2Iy") if is_paid else None,
    }


@router.get("/api/profile")
async def profile(x_init_data: str = Header("", alias="X-Init-Data")):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    user = db.get_user(uid)
    gp = db.get_gp(uid)
    completed = db.get_completed(uid, COURSE_ID)
    badges = db.get_badges(uid, COURSE_ID)
    main_completed = [OLD_TO_NEW[x] for x in completed if x in MAIN_OLD_IDS]
    ref_stats = db.get_referral_stats(uid)
    return {
        "user": user,
        "gp": gp,
        "completed": main_completed,
        "total_lessons": TOTAL_MAIN,
        "badges": badges,
        "referral_code": user["referral_code"] if user else "",
        "referred_by": user["referred_by"] if user else None,
        "referral_friends": ref_stats["friends_count"],
        "referral_gp_earned": ref_stats["gp_earned"],
        "archetype": user["archetype"] if user else "Куратор Вайба",
        "bonus_lessons": len([x for x in db.get_completed(uid, "dj-bonus") if x in BONUS_OLD_IDS]),
    }
