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
import backend.prodamus_sign as prodamus_sign
from backend.crm import router as crm_router

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

# CRM-админка (защищена ADMIN_KEY через подписанный cookie)
app.include_router(crm_router)

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


def _resolve_uid(
    x_init_data: str,
    authorization: str | None,
    body: dict | None = None,
) -> int | None:
    """Определить telegram_id запроса двумя путями:

    1) Фронт (Mini App): заголовок X-Init-Data (подписан TG).
    2) Бот (server-to-server): заголовок Authorization: Bearer INTERNAL_API_KEY
       + JSON-поле user_id. Бот НЕ имеет init_data пользователя, поэтому
       шлёт свой внутренний ключ и явный user_id.

    Возвращает telegram_id или None (если ни один путь не прошёл).
    """
    uid = _user_id_from_init(x_init_data)
    if uid is not None:
        return uid
    # путь бота: проверяем internal key, затем берём user_id из тела
    if authorization == f"Bearer {INTERNAL_API_KEY}" and body:
        uid = body.get("user_id")
        if uid is not None:
            try:
                return int(uid)
            except (TypeError, ValueError):
                return None
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
        "bonus_lessons": _course_response(uid)["bonus_lessons"],
        "last_seen": u.get("last_seen") or "",
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
                    "amount": 100,
                    "message": "🎁 Подарок от друга! Тебе начислено 100 GP",
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
                    "amount": 100,
                    "message": "🎁 Подарок от друга! Тебе начислено 100 GP",
                }

    return {
        "user": _user_response(uid),
        "course": _course_response(uid),
        "bonus": bonus,
        "referral_friends": db.get_referral_stats(uid)["friends_count"],
        "referral_gp_earned": db.get_referral_stats(uid)["gp_earned"],
        # PLAY A: флаги оплаты для фронт-пейвола (курс иначе проходится бесплатно)
        "paid_full": db.has_paid(uid, COURSE_ID),
        "paid_tripwire": db.has_paid(uid, "tripwire"),
        "paid": db.has_paid(uid, COURSE_ID) or db.has_paid(uid, "tripwire"),
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
        "bonus_lessons": len([x for x in db.get_completed(uid, "dj-bonus") if x in BONUS_OLD_IDS]),
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
    # ВОРОНКА: урок 1 — бесплатный (tripwire-вход), остальные — после оплаты.
    if p.course_id == COURSE_ID and p.lesson_id in MAIN_NEW_IDS:
        is_first_lesson = (p.lesson_id == 1)
        paid_full = db.has_paid(uid, p.course_id)
        paid_tw = db.has_paid(uid, "tripwire")
        if not paid_full and not paid_tw and not is_first_lesson:
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
    req: Request,
    x_init_data: str = Header("", alias="X-Init-Data"),
    authorization: str | None = Header(None),
):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}
    uid = _resolve_uid(x_init_data, authorization, body)
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
    # реально начисленный базовый бонус инвайтеру за этого invitee (500)
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


# ---- POST /api/gp/apply ----

@app.post("/api/gp/apply")
async def gp_apply(
    req: Request,
    x_init_data: str = Header("", alias="X-Init-Data"),
    authorization: str | None = Header(None),
):
    body = {}
    try:
        body = await req.json()
    except Exception:
        body = {}

    # charge_id: у бота это telegram_payment_charge_id (идемпотентность),
    # у фронта обычно нет — тогда списание разовое (фронт зовёт один раз после paid)
    charge_id = body.get("charge_id")
    uid = _resolve_uid(x_init_data, authorization, body)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    # amount: либо из тела (фронт), либо бот считает его сам из GP пользователя
    amount = body.get("amount")
    if amount is None:
        amount = min(db.get_gp(uid), 7000)

    result = db.apply_gp_spend(uid, amount, charge_id=charge_id)
    if result is None:
        return JSONResponse({"error": "insufficient_gp"}, status_code=400)
    return result


# ---- POST /api/gp/spend ----
@app.post("/api/gp/spend")
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
    if not amount or amount <= 0:
        return JSONResponse({"error": "bad_amount"}, status_code=400)
    reason = body.get("reason", "spend")
    uid = _resolve_uid(x_init_data, None, body)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)
    result = db.spend_gp(uid, amount, reason=reason)
    if result is None:
        return JSONResponse({"error": "user_not_found"}, status_code=404)
    return result


# ---- POST /api/gp/earn ----
REWARD_ACTIONS = {
    "share": 25,        # поделился курсом — +25 GP (шер = дешёвая вирусность)
    "daily": 25,        # ежедневный бонус — +25 GP (пинг удержания, выше порог входа)
    "review": 50,       # оставил отзыв/звёзды — +50 GP
}
@app.post("/api/gp/earn")
async def gp_earn(
    req: Request,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    """Rewarded-механика: начислить GP за действие (шер/ежедневный бонус/отзыв).

    ЗАЩИТА ОТ ФЕРМЫ: одно действие — не чаще 1 раза в 24ч (по transactions).
    """
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
    # cooldown 24ч
    with db._conn() as c:
        recent = c.execute(
            "SELECT 1 FROM transactions WHERE user_id=? AND action_type=? "
            "AND timestamp > datetime('now', '-24 hours') LIMIT 1",
            (uid, f"reward_{action}"),
        ).fetchone()
        if recent:
            return JSONResponse({"error": "cooldown", "hint": "доступно через 24ч"}, status_code=429)
    amount = REWARD_ACTIONS[action]
    result = db.add_gp(uid, amount, action_type=f"reward_{action}")
    result["amount"] = amount
    result["action"] = action
    return result


# ---- Цены в Stars ----
# 1 Star ≈ $0.014 для покупателя. Цена с учётом комиссии Apple/Google (~30% на мобильных).
# Creator получает ~$0.013 за Star после вывода.
TRIPWIRE_PRICE = 500      # $7   → 500 Stars
FULL_COURSE_PRICE = 2100  # $30  → 2100 Stars
MENTOR_PRICE = 21000      # $300 → 21000 Stars

# ---- A/B эксперименты (Adapty: локализация +62% LTV, структура trial +59%) ----
# Варианты цен для tripwire/full. Если эксперимент ВЫКЛЮЧЕН (active=False) —
# используется базовая цена (TRIPWIRE_PRICE / FULL_COURSE_PRICE).
AB_EXPERIMENTS = {
    "price_tripwire": {
        "active": False,   # ← включить True для запуска эксперимента
        "variants": {
            "control": TRIPWIRE_PRICE,   # 500⭐ (база)
            "low": 300,                  # 300⭐ (дешевле порог входа)
            "bundle": 700,               # 700⭐ (уроки 1-4 + бонус-пак)
        },
    },
    "price_full": {
        "active": False,
        "variants": {
            "control": FULL_COURSE_PRICE,  # 2100⭐
            "discount": 1700,              # 1700⭐ (−19%)
            "premium": 2500,               # 2500⭐ (+бонусы в описании)
        },
    },
    "localization": {
        "active": False,
        "variants": {
            "ru": "ru",
            "en": "en",
        },
    },
}


def _ab_price(course_id: str, uid: int | None) -> tuple[int, str]:
    """Вернуть (цена, variant_label) с учётом A/B-эксперимента.

    control/база — если эксперимент выключен или юзер не назначен.
    """
    if course_id == "tripwire":
        exp, base = "price_tripwire", TRIPWIRE_PRICE
    elif course_id == COURSE_ID:
        exp, base = "price_full", FULL_COURSE_PRICE
    else:
        return MENTOR_PRICE, "control"  # менторство пока вне эксперимента
    cfg = AB_EXPERIMENTS.get(exp)
    if not cfg or not cfg.get("active") or uid is None:
        return base, "control"
    variant = db.assign_ab_variant(uid, exp, list(cfg["variants"].keys()))
    return cfg["variants"][variant], variant


# ---- POST /api/create-invoice — Telegram Stars invoice ----

class CreateInvoice(BaseModel):
    course_id: str = "dj-basics"
    price: int | None = None  # если передан — переопределяет цену по-умолчанию
    provider: str = "stars"   # stars | prodamus | ton

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
    variant = "control"
    if course_id == "tripwire":
        price, variant = _ab_price("tripwire", uid)
        label = "Pocket DJ: уроки 1-4"
    elif course_id == COURSE_ID:
        price, variant = _ab_price(COURSE_ID, uid)
        label = "Pocket DJ: полный курс"
    elif course_id == "mentoring":
        # автоскидка 1 GP = 1 Star, макс 7000, итог не ниже 14000
        gp = db.get_gp(uid)
        disc = min(gp, 7000)
        price = max(14000, MENTOR_PRICE - disc)
        label = "Персональное менторство FREEDA DJ"
    else:
        return JSONResponse({"error": "unknown_course"}, status_code=400)

    # --- Prodamus (карта/СБП РФ): внешний редирект, подтверждение по webhook ---
    if body.provider == "prodamus":
        from bot.payments.prodamus import ProdamusProvider
        prov = ProdamusProvider()
        # цена в рублях: берём эквивалент Stars*0.0213 (курс ~ $0.0213/Star,
        # 1 Star ≈ 1.7₽), округляем до целых; для полного курса 2100 Stars ≈ 3570₽
        rub = max(1, round(price * 1.7))
        inv = await prov.create_invoice(uid, course_id, f"{rub} RUB")
        if inv.meta.get("not_configured"):
            return JSONResponse(
                {"error": "prodamus_not_configured",
                 "detail": "Prodamus не настроен (нужны PAYFORM_URL, SECRET_KEY, SYS_CODE)"},
                status_code=503,
            )
        if not inv.url_or_payload:
            return JSONResponse(
                {"error": "prodamus_invoice_failed", "detail": inv.meta},
                status_code=502,
            )
        return {
            "provider": "prodamus",
            "pay_url": inv.url_or_payload,
            "order_id": inv.meta.get("order_id"),
            "title": label,
            "price_rub": rub,
        }

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
        "variant": variant,
        "experiment": "price_tripwire" if course_id == "tripwire" else ("price_full" if course_id == COURSE_ID else None),
    }


# ---- GET /api/ab/assign ----
@app.get("/api/ab/assign")
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


# ---- POST /api/ab/track ----
@app.post("/api/ab/track")
async def ab_track(
    req: Request,
    authorization: str | None = Header(None),
):
    """Записать A/B-вариант покупки для LTV-аналитики.

    Бот вызывает после successful_payment: передаёт user_id + course_id,
    бэкенд резолвит вариант (из ab_assignments) и пишет в transactions.
    """
    if authorization != f"Bearer {INTERNAL_API_KEY}":
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
        db.add_payment(uid, course_id, "ab_track", ab_variant=f"{exp}:{variant}")
    return {"ok": True, "variant": variant}


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


# ---- POST /webhooks/prodamus ----
# Prodamus шлёт POST form-data + заголовок `Sign` (подпись HMAC-SHA256).
# Алгоритм проверки — как в мануале Hmac::verify: берём все поля КРОМЕ
# signature/Sign, сортируем ключи, json, экранируем '/', sha256 секретом.
# Подтверждение оплаты = только этот webhook с валидной подписью.

@app.post("/webhooks/prodamus")
async def prodamus_webhook(req: Request, sign: str = Header(None, alias="Sign")):
    secret_raw = os.getenv("PRODAMUS_SECRET_KEY", "")
    if not secret_raw:
        return JSONResponse({"error": "webhook_not_configured"}, status_code=500)

    # Prodamus присылает form-data (application/x-www-form-urlencoded).
    # Парсим тело вручную (без зависимости от python-multipart), т.к.
    # в рантаймеuvicorn его может не быть -> AssertionError на req.form().
    from urllib.parse import parse_qs
    raw = (await req.body()).decode("utf-8", "ignore")
    parsed = parse_qs(raw, keep_blank_values=True)
    form_dict = {k: (v[0] if isinstance(v, list) and v else "") for k, v in parsed.items()}

    if not prodamus_sign.verify_webhook(form_dict, secret_raw, sign):
        return JSONResponse({"error": "bad_signature"}, status_code=400)

    # Prodamus присылает статус оплаты в поле `status` (например "paid").
    status = form_dict.get("status") or form_dict.get("payment_status")
    order_id = form_dict.get("order_id") or ""

    if status == "paid" and order_id:
        if db.is_webhook_processed(order_id):
            return {"ok": True, "duplicate": True}
        try:
            user_id, course_id = order_id.split(":", 1)
            db.add_payment(int(user_id), course_id, "prodamus", status="paid",
                           raw=json.dumps(form_dict, ensure_ascii=False)[:4000])
            db.mark_webhook_processed(order_id)
        except Exception:
            # невалидный order_id — логируем, но отвечаем 200, чтобы Prodamus
            # не спамил повторами
            pass
    return {"ok": True}
