"""Роутер уроков и прогресса (/api/lessons, /api/lessons-bonus, /api/progress)."""
from __future__ import annotations

import os

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

import backend.db as db
from backend.deps import (
    BONUS_COURSE_ID,
    BONUS_NEW_IDS,
    BONUS_NEW_TO_OLD,
    BONUS_OLD_IDS,
    BONUS_OLD_TO_NEW,
    COURSE_BONUS,
    COURSE_ID,
    COURSE_MAIN,
    FREE_LESSONS,
    MAIN_NEW_IDS,
    MAIN_OLD_IDS,
    NEW_TO_OLD,
    OLD_TO_NEW,
    TOTAL_BONUS,
    TOTAL_MAIN,
    _user_id_from_init,
)
from backend.schemas import Progress

router = APIRouter()


@router.get("/api/lessons")
async def lessons(
    x_init_data: str = Header("", alias="X-Init-Data"),
    course_id: str = COURSE_ID,
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data", "paid": False}, status_code=401)
    completed = [OLD_TO_NEW[x] for x in db.get_completed(uid, course_id) if x in MAIN_OLD_IDS]
    paid = db.has_paid(uid, course_id) or (course_id == COURSE_ID and db.has_paid(uid, "tripwire"))
    return {
        "paid": paid,
        "course_id": course_id,
        "lessons": COURSE_MAIN,
        "completed": completed,
        "total": TOTAL_MAIN,
        "tribe_invite_link": os.getenv("TRIBE_INVITE_LINK", "https://t.me/+S9cLCiFHbWQzY2Iy") if paid else None,
    }


@router.get("/api/lessons-bonus")
async def lessons_bonus(
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    main_completed = len([x for x in db.get_completed(uid, COURSE_ID) if x in MAIN_OLD_IDS])
    unlocked_count = min(main_completed + 1, TOTAL_BONUS)
    completed = [
        BONUS_OLD_TO_NEW[x]
        for x in db.get_completed(uid, BONUS_COURSE_ID)
        if x in BONUS_OLD_IDS
    ]
    return {
        "course_id": BONUS_COURSE_ID,
        "lessons": COURSE_BONUS,
        "completed": completed,
        "unlocked_count": unlocked_count,
        "total_main": TOTAL_MAIN,
        "bonus_unlocked": unlocked_count >= TOTAL_BONUS,
    }


@router.post("/api/progress")
async def progress(
    p: Progress,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    if p.course_id == BONUS_COURSE_ID or p.bonus:
        course_id = BONUS_COURSE_ID
        if p.lesson_id not in BONUS_NEW_IDS and p.lesson_id not in BONUS_OLD_IDS:
            return JSONResponse({"error": "bad_lesson_id"}, status_code=400)
        new_bonus_id = BONUS_OLD_TO_NEW.get(p.lesson_id, p.lesson_id)
        main_completed = len([x for x in db.get_completed(uid, COURSE_ID) if x in MAIN_OLD_IDS])
        unlocked_count = min(main_completed + 1, TOTAL_BONUS)
        if new_bonus_id > unlocked_count:
            return JSONResponse(
                {"error": "bonus_locked", "unlocked_count": unlocked_count},
                status_code=403,
            )
        old_id = BONUS_NEW_TO_OLD.get(p.lesson_id, p.lesson_id)
        gp = db.complete_lesson(uid, course_id, old_id)
        completed = [
            BONUS_OLD_TO_NEW[x]
            for x in db.get_completed(uid, course_id)
            if x in BONUS_OLD_IDS
        ]
        return {"gp": gp, "completed": completed, "bonus": True}

    if p.course_id == COURSE_ID:
        if p.lesson_id not in MAIN_NEW_IDS and p.lesson_id not in MAIN_OLD_IDS:
            return JSONResponse({"error": "bad_lesson_id"}, status_code=400)
        new_lesson_id = OLD_TO_NEW.get(p.lesson_id, p.lesson_id)
        is_free_lesson = (new_lesson_id <= FREE_LESSONS)
        paid_full = db.has_paid(uid, p.course_id)
        paid_tw = db.has_paid(uid, "tripwire")
        if not paid_full and not paid_tw and not is_free_lesson:
            return JSONResponse({"error": "not_paid", "paid": False}, status_code=403)
    else:
        return JSONResponse({"error": "bad_course_id"}, status_code=400)

    old_id = NEW_TO_OLD.get(p.lesson_id, p.lesson_id)
    gp = db.complete_lesson(uid, p.course_id, old_id)
    completed = [
        OLD_TO_NEW[x]
        for x in db.get_completed(uid, p.course_id)
        if x in MAIN_OLD_IDS
    ]
    return {
        "gp": gp,
        "completed": completed,
    }
