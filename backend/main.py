"""FastAPI-бэкенд DJ School.

- отдаёт Mini App (GET /)
- валидирует Telegram init_data (X-Init-Data)
- раздаёт уроки только оплаченным (GET /api/lessons)
- принимает прогресс из приложения (POST /api/progress)
- выдаёт доступ по оплате (POST /api/grant) и по webhook Prodamus
- ВСЁ хранится в SQLite (backend/db.py) — не теряется при перезапуске
"""
from __future__ import annotations
import os
from pathlib import Path

from fastapi import FastAPI, Header, Request
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from backend.auth import verify_init_data
import backend.db as db

db.init()  # создаём таблицы при старте, если их нет

BOT_TOKEN = os.getenv("BOT_TOKEN", "TEST_BOT_TOKEN")
MINI_APP_DIR = Path(__file__).resolve().parent.parent / "miniapp"
COURSE_ID = "dj-basics"

app = FastAPI(title="DJ School API")

# --- Демо-курс (в проде — из БД / файла) ---
COURSE = {
    "dj-basics": [
        {"id": 1, "title": "Знакомство с пультами", "hls": "/video/lesson1/index.m3u8"},
        {"id": 2, "title": "Beatmatching своими руками", "hls": "/video/lesson2/index.m3u8"},
        {"id": 3, "title": "Первый сет: структура", "hls": "/video/lesson3/index.m3u8"},
    ]
}


class Grant(BaseModel):
    user_id: int
    course_id: str
    provider: str


class Progress(BaseModel):
    user_id: int
    course_id: str = COURSE_ID
    lesson_id: int


def _user_id_from_init(init_data: str) -> int | None:
    data = verify_init_data(init_data, BOT_TOKEN)
    if not data:
        return None
    import json
    try:
        u = json.loads(data["user"])
        uid = u.get("id")
        # обновим профиль в БД при каждом входе
        db.upsert_user(
            uid,
            first_name=u.get("first_name"),
            username=u.get("username"),
            photo_url=u.get("photo_url"),
        )
        return uid
    except Exception:
        return None


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (MINI_APP_DIR / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(html)


@app.get("/api/lessons")
async def lessons(x_init_data: str = Header("", alias="X-Init-Data"), course_id: str = COURSE_ID):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data", "paid": False}, status_code=401)
    paid = db.has_paid(uid, course_id)
    completed = db.get_completed(uid, course_id)
    return {
        "paid": paid,
        "course_id": course_id,
        "lessons": COURSE.get(course_id, []),
        "completed": completed,
    }


@app.post("/api/progress")
async def progress(p: Progress, x_init_data: str = Header("", alias="X-Init-Data")):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    gp = db.complete_lesson(uid, p.course_id, p.lesson_id)
    badges = db.get_badges(uid, p.course_id)
    return {"ok": True, "gp": gp, "completed": db.get_completed(uid, p.course_id), "badges": badges}


@app.post("/api/grant")
async def grant(g: Grant):
    db.add_payment(g.user_id, g.course_id, g.provider, status="paid")
    return {"ok": True}


@app.post("/webhooks/prodamus")
async def prodamus_webhook(req: Request, x_signature: str = Header(None)):
    import hashlib, hmac, json
    body = await req.body()
    secret = os.getenv("PRODAMUS_WEBHOOK_SECRET", "TEST_PRODAMUS_SECRET").encode()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_signature or ""):
        return JSONResponse({"error": "bad_signature"}, status_code=400)
    data = json.loads(body)
    if data.get("status") == "paid":
        user_id, course_id = data["order_id"].split(":", 1)
        db.add_payment(int(user_id), course_id, "prodamus", status="paid")
    return {"ok": True}
