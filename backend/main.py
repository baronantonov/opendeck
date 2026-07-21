"""FastAPI-бэкенд DJ School.

- отдаёт Mini App (GET /)
- валидирует Telegram init_data (X-Init-Data)
- раздаёт уроки только оплаченным (GET /api/lessons)
- принимает прогресс из приложения (POST /api/progress)
- профиль пользователя (GET /api/profile)
- выдаёт доступ по оплате (POST /api/grant) и по webhook Prodamus
- ВСЁ хранится в SQLite (backend/db.py) — не теряется при перезапуске
"""
from __future__ import annotations
import os
from pathlib import Path

# Авто-загрузка .env, если есть
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from backend.auth import verify_init_data
import backend.db as db

db.init()  # создаём таблицы при старте, если их нет

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
if not BOT_TOKEN:
    raise SystemExit("❌ BOT_TOKEN не задан! Установи переменную окружения.")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY:
    raise SystemExit("❌ INTERNAL_API_KEY не задан! Без него /api/grant не защищён.")
MINI_APP_DIR = Path(__file__).resolve().parent.parent / "miniapp"
COURSE_ID = "dj-basics"

app = FastAPI(title="DJ School API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://opendeck-tma.serveousercontent.com",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Демо-курс (в проде — из БД / файла) ---
COURSE = {
    "dj-basics": [
        {"id": 1, "title": "Знакомство: кто такой диджей и зачем он нужен"},
        {"id": 2, "title": "История: от диско до наших дней"},
        {"id": 3, "title": "Направления и оборудование: где найти себя"},
        {"id": 4, "title": "Музыкальная теория: бит, ритм и колесо Камелота"},
        {"id": 5, "title": "Интерфейс на телефоне: твой первый контроллер"},
        {"id": 6, "title": "Основы сведения: BPM, темп и кнопка Sync"},
        {"id": 7, "title": "Кроссфейдер и нюансы темпо"},
        {"id": 8, "title": "Лупы и Beat Jump: лёгкое сведение"},
        {"id": 9, "title": "Эффекты и фильтр: краски твоего сета"},
        {"id": 10, "title": "Твой первый микс из 4–5 треков"},
    ]
}


class Grant(BaseModel):
    user_id: int
    course_id: str
    provider: str


class Progress(BaseModel):
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


@app.get("/api/profile")
async def profile(x_init_data: str = Header("", alias="X-Init-Data")):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    user = db.get_user(uid)
    gp = db.get_gp(uid)
    completed = db.get_completed(uid, COURSE_ID)
    badges = db.get_badges(uid, COURSE_ID)
    total = len(COURSE.get(COURSE_ID, []))
    return {
        "user": user,
        "gp": gp,
        "completed": completed,
        "total_lessons": total,
        "badges": badges,
        "archetype": "Куратор Вайба",
    }


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (MINI_APP_DIR / "index.html").read_text(encoding="utf-8")
    from fastapi.responses import HTMLResponse as Resp
    return Resp(content=html, headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"})


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
    if not db.has_paid(uid, p.course_id):
        return JSONResponse({"error": "not_paid", "paid": False}, status_code=403)
    course_lessons = COURSE.get(p.course_id, [])
    if not any(l["id"] == p.lesson_id for l in course_lessons):
        return JSONResponse({"error": "bad_lesson_id"}, status_code=400)
    gp = db.complete_lesson(uid, p.course_id, p.lesson_id)
    badges = db.get_badges(uid, p.course_id)
    return {"ok": True, "gp": gp, "completed": db.get_completed(uid, p.course_id), "badges": badges}


@app.post("/api/grant")
async def grant(g: Grant, authorization: str = Header(None)):
    if authorization != f"Bearer {INTERNAL_API_KEY}":
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    db.add_payment(g.user_id, g.course_id, g.provider, status="paid")
    return {"ok": True}


@app.post("/webhooks/prodamus")
async def prodamus_webhook(req: Request, x_signature: str = Header(None)):
    import hashlib, hmac, json
    body = await req.body()
    secret_raw = os.getenv("PRODAMUS_WEBHOOK_SECRET", "")
    if not secret_raw:
        return JSONResponse({"error": "webhook_not_configured"}, status_code=500)
    secret = secret_raw.encode()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, x_signature or ""):
        return JSONResponse({"error": "bad_signature"}, status_code=400)
    data = json.loads(body)
    if data.get("status") == "paid":
        order_id = data["order_id"]
        if db.is_webhook_processed(order_id):
            return {"ok": True, "duplicate": True}
        user_id, course_id = order_id.split(":", 1)
        db.add_payment(int(user_id), course_id, "prodamus", status="paid")
        db.mark_webhook_processed(order_id)
    return {"ok": True}
