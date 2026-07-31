"""FastAPI-бэкенд DJ School — PLAY API (GP + Referral).

Эндпоинты:
  GET  /                        — Mini App (index.html)
  POST /api/init                — точка входа (создание юзера, рефссылка)
  GET  /api/health              — healthcheck
  GET  /api/profile             — профиль + referral_code
  GET  /api/lessons             — список уроков (по оплате)
  POST /api/progress            — завершить урок (+50 GP)
  POST /api/referral/purchase   — инвайте купил → инвайтер +200 GP
  POST /api/gp/apply            — списать GP на скидку MENTOR
  POST /api/grant               — выдача доступа (внутренний)
  POST /webhooks/prodamus       — вебхук оплаты
"""
from __future__ import annotations
import os, json, httpx
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, Header, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

from backend.auth import verify_init_data
import backend.db as db

db.init()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
if not BOT_TOKEN:
    raise SystemExit("❌ BOT_TOKEN не задан! Установи переменную окружения.")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY:
    raise SystemExit("❌ INTERNAL_API_KEY не задан! Без него /api/grant не защищён.")
MINI_APP_DIR = Path(__file__).resolve().parent.parent  # корень проекта — один index.html
COURSE_ID = "dj-basics"

app = FastAPI(title="DJ School API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://opendeck-tma.serveousercontent.com",
        "https://opendeck-tma.loca.lt",
        "https://squabble-lilly-lankiness.ngrok-free.dev",
        "https://baronantonov.github.io",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Демо-курс ---
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

# --- PLAY remap: основной курс = старые уроки 5-10 (новые 1-6), бонусы = старые 1-4 ---
MAIN_OLD_IDS = [5, 6, 7, 8, 9, 10]
MAIN_NEW_IDS = [1, 2, 3, 4, 5, 6]
BONUS_OLD_IDS = [1, 2, 3, 4]
BONUS_COURSE_ID = "dj-bonus"  # бонусы — отдельный course_id (C3), чтобы не конфликтовали с основным
OLD_TO_NEW = {old: new for old, new in zip(MAIN_OLD_IDS, MAIN_NEW_IDS)}
NEW_TO_OLD = {new: old for new, old in zip(MAIN_NEW_IDS, MAIN_OLD_IDS)}
# бонусы: старые id 1-4 -> новые id 1-4 (прямое совпадение, но свой course_id)
BONUS_OLD_TO_NEW = {i: i for i in BONUS_OLD_IDS}
BONUS_NEW_TO_OLD = {i: i for i in BONUS_OLD_IDS}
TOTAL_MAIN = len(MAIN_OLD_IDS)
TOTAL_BONUS = len(BONUS_OLD_IDS)

COURSE_MAIN = [
    {"id": i + 1, "title": COURSE[COURSE_ID][MAIN_OLD_IDS[i] - 1]["title"]}
    for i in range(TOTAL_MAIN)
]
COURSE_BONUS = [
    {"id": i + 1, "title": COURSE[COURSE_ID][i]["title"], "bonus": True}
    for i in range(4)
]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

class Grant(BaseModel):
    user_id: int
    course_id: str
    provider: str

class Progress(BaseModel):
    course_id: str = COURSE_ID
    lesson_id: int
    bonus: bool = False  # C3: фронт помечает бонусный урок явно

class InitRequest(BaseModel):
    init_data: str
    start_param: str | None = None

class GpApply(BaseModel):
    amount: int  # GP для списания


def _user_id_from_init(init_data: str) -> int | None:
    """Валидировать init_data, вернуть telegram_id."""
    data = verify_init_data(init_data, BOT_TOKEN)
    if not data:
        return None
    try:
        u = json.loads(data["user"])
        uid = u.get("id")
        db.upsert_user(
            uid,
            first_name=u.get("first_name"),
            username=u.get("username"),
            photo_url=u.get("photo_url"),
        )
        return uid
    except Exception:
        return None


def _user_response(uid: int) -> dict:
    """Собрать блок user для /api/init."""
    u = db.get_user(uid)
    if not u:
        return {}
    return {
        "id": str(u["user_id"]),
        "name": u["first_name"] or "",
        "photo_url": u["photo_url"] or "",
        "referral_code": u["referral_code"] or "",
        "referred_by": u["referred_by"],
        "archetype": u["archetype"] or "Куратор Вайба",
        "groove_points": db.get_gp(uid),
    }


def _course_response(uid: int) -> dict:
    """Собрать блок course."""
    raw_completed = db.get_completed(uid, COURSE_ID)
    remap_main = lambda ids: [OLD_TO_NEW[x] for x in ids if x in MAIN_OLD_IDS]
    main_completed = remap_main(raw_completed)
    main_total = TOTAL_MAIN
    current = (max(main_completed) + 1) if main_completed else 1
    if current > main_total:
        current = main_total
    bonus_completed = len([x for x in raw_completed if x in BONUS_OLD_IDS])
    bonus_total = len(BONUS_OLD_IDS)
    return {
        "course_id": COURSE_ID,
        "completed_lessons": main_completed,
        "total_lessons": main_total,
        "current_lesson_id": current,
        "bonus_lessons": bonus_completed,
        "total_bonus_lessons": bonus_total,
        "bonus_unlocked": len(main_completed) >= main_total,
    }


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (MINI_APP_DIR / "index.html").read_text(encoding="utf-8")
    return HTMLResponse(
        content=html,
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


# ---- POST /api/init (core PLAY) ----

@app.post("/api/init")
async def api_init(body: InitRequest):
    data = verify_init_data(body.init_data, BOT_TOKEN)
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

    # проверить, существует ли пользователь
    existing = db.get_user(uid)
    if existing:
        # upsert (обновить last_seen и т.д.)
        db.upsert_user(uid, first_name, username, photo_url)
    else:
        # создать нового
        db.create_user(uid, first_name, username, photo_url)

    bonus = None

    # обработка реферальной ссылки
    sp = body.start_param or ""
    if sp.startswith("ref_") and existing is None:
        ref_code = sp[4:]  # "a1b2c3d4"
        inviter = db.get_user_by_referral_code(ref_code)
        if inviter and inviter["user_id"] != uid:
            # записать referred_by
            with db._conn() as c:
                c.execute(
                    "UPDATE users SET referred_by=? WHERE user_id=?",
                    (ref_code, uid),
                )
            # начислить бонусы
            inviter_code = db.apply_referral_signup(uid, inviter["user_id"])
            if inviter_code:
                bonus = {
                    "type": "referral_signup",
                    "amount": 50,
                    "message": "🎁 Подарок от друга! Тебе начислено 50 GP",
                }
    elif sp.startswith("ref_") and existing and not existing.get("referred_by"):
        # пользователь уже существовал, но реф ссылка не была привязана
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
                    "amount": 50,
                    "message": "🎁 Подарок от друга! Тебе начислено 50 GP",
                }

    return {
        "user": _user_response(uid),
        "course": _course_response(uid),
        "bonus": bonus,
        "referral_friends": db.get_referral_stats(uid)["friends_count"],
        "referral_gp_earned": db.get_referral_stats(uid)["gp_earned"],
    }


# ---- GET /api/profile (extended) ----

@app.get("/api/profile")
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
    }


# ---- GET /api/lessons /api/lessons-bonus — основная часть / бонусы ----
@app.get("/api/lessons")
async def lessons(
    x_init_data: str = Header("", alias="X-Init-Data"),
    course_id: str = COURSE_ID,
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data", "paid": False}, status_code=401)
    completed = [OLD_TO_NEW[x] for x in db.get_completed(uid, course_id) if x in MAIN_OLD_IDS]
    return {
        "paid": db.has_paid(uid, course_id),
        "course_id": course_id,
        "lessons": COURSE_MAIN,
        "completed": completed,
        "total": TOTAL_MAIN,
    }


@app.get("/api/lessons-bonus")
async def lessons_bonus(
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    # Бонусы ВИДНЫ всегда, но открываются по порядку от прогресса основного курса:
    #   Бонус 1 — доступен сразу.
    #   Бонус N (N>=2) — открывается после прохождения урока N-1 основного курса.
    # unlocked_count = min(пройдено_основных + 1, всего_бонусов).
    main_completed = len([x for x in db.get_completed(uid, COURSE_ID) if x in MAIN_OLD_IDS])
    # Все бонусные уроки видны и открыты сразу (без привязки к прогрессу основного курса)
    unlocked_count = TOTAL_BONUS
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
        "bonus_unlocked": unlocked_count >= TOTAL_BONUS,  # true только когда все 4 открыты
    }



# ---- POST /api/progress (existing, +GP) ----

@app.post("/api/progress")
async def progress(
    p: Progress,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    # ---- БОНУСЫ (C3): отдельный course_id, не требует оплаты ----
    if p.course_id == BONUS_COURSE_ID or p.bonus:
        course_id = BONUS_COURSE_ID
        old_id = BONUS_NEW_TO_OLD.get(p.lesson_id, p.lesson_id)
        gp = db.complete_lesson(uid, course_id, old_id)
        completed = [
            BONUS_OLD_TO_NEW[x]
            for x in db.get_completed(uid, course_id)
            if x in BONUS_OLD_IDS
        ]
        return {"gp": gp, "completed": completed, "bonus": True}

    # ---- ОСНОВНОЙ КУРС (платный доступ) ----
    if p.course_id == COURSE_ID and p.lesson_id in MAIN_NEW_IDS:
        paid_full = db.has_paid(uid, p.course_id)
        if not paid_full and not db.has_paid(uid, "tripwire"):
            return JSONResponse({"error": "not_paid", "paid": False}, status_code=403)
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


# ---- POST /api/referral/purchase ----

@app.post("/api/referral/purchase")
async def referral_purchase(
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    inviter_id = db.apply_referral_purchase(uid)
    if inviter_id is None:
        return {
            "inviter_bonus": 0,
            "gp": db.get_gp(uid),
        }

    inviter = db.get_user(inviter_id)
    return {
        "inviter_bonus": 200,
        "inviter_code": inviter["referral_code"] if inviter else "",
        "gp": db.get_gp(uid),
    }


# ---- POST /api/gp/apply ----

@app.post("/api/gp/apply")
async def gp_apply(
    body: GpApply,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    result = db.apply_gp_spend(uid, body.amount)
    if result is None:
        return JSONResponse({"error": "insufficient_gp"}, status_code=400)
    return result


# ---- Цены в Stars ----
# 1 Star ≈ $0.014 для покупателя. Цена с учётом комиссии Apple/Google (~30% на мобильных).
# Creator получает ~$0.013 за Star после вывода.
TRIPWIRE_PRICE = 500      # $7   → 500 Stars
FULL_COURSE_PRICE = 2100  # $30  → 2100 Stars
MENTOR_PRICE = 21000      # $300 → 21000 Stars


# ---- POST /api/create-invoice — Telegram Stars invoice ----

class CreateInvoice(BaseModel):
    course_id: str = "dj-basics"
    price: int | None = None  # если передан — переопределяет цену по-умолчанию

@app.post("/api/create-invoice")
async def create_invoice(
    body: CreateInvoice,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    course_id = body.course_id
    # ⚠️ ЦЕНА ВСЕГДА СЧИТАЕТСЯ НА СЕРВЕРЕ (C2).
    # Клиентский body.price ИГНОРИРУЕТСЯ — иначе юзер мог передать price:1
    # и купить менторство за 1 Star.
    if course_id == "tripwire":
        price = TRIPWIRE_PRICE
        label = "Pocket DJ: уроки 1-4"
    elif course_id == COURSE_ID:
        price = FULL_COURSE_PRICE
        label = "Pocket DJ: полный курс"
    elif course_id == "mentoring":
        # автоскидка 1 GP = 1 Star, макс 7000, итог не ниже 14000
        gp = db.get_gp(uid)
        disc = min(gp, 7000)
        price = max(14000, MENTOR_PRICE - disc)
        label = "Персональное менторство FREEDA DJ"
    else:
        return JSONResponse({"error": "unknown_course"}, status_code=400)

    async with httpx.AsyncClient(timeout=10) as c:
        resp = await c.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/createInvoiceLink",
            json={
                "title": label,
                "description": "Open Deck DJ School",
                "payload": course_id,
                "provider_token": "",
                "currency": "XTR",
                "prices": [{"label": label, "amount": price}],
            },
        )
        data = resp.json()
    if not data.get("ok"):
        return JSONResponse({"error": "telegram_api_error", "detail": data}, status_code=502)
    return {
        "invoice_link": data["result"],
        "title": label,
        "price": price,
    }


# ---- POST /api/grant (internal) ----

@app.post("/api/grant")
async def grant(
    g: Grant,
    authorization: str | None = Header(None),
):
    if authorization != f"Bearer {INTERNAL_API_KEY}":
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    db.add_payment(g.user_id, g.course_id, g.provider, status="paid")
    return {"ok": True}


# ---- POST /webhooks/prodamus (unchanged) ----

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
