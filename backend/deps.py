"""Общие зависимости, конфигурация, константы курсов/цен и хелперы авторизации."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from pathlib import Path

import httpx

from backend.auth import verify_init_data
import backend.db as db
from backend.schemas import _GIFT_USERNAME_RE

logger = logging.getLogger("opendeck.backend")

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
if not BOT_TOKEN:
    raise SystemExit("❌ BOT_TOKEN не задан! Установи переменную окружения.")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")
if not INTERNAL_API_KEY:
    raise SystemExit("❌ INTERNAL_API_KEY не задан! Без него /api/grant не защищён.")

MINI_APP_DIR = Path(__file__).resolve().parent.parent  # корень проекта — один index.html
COURSE_ID = "dj-basics"

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
BONUS_NEW_IDS = [1, 2, 3, 4]
BONUS_COURSE_ID = "dj-bonus"
OLD_TO_NEW = {old: new for old, new in zip(MAIN_OLD_IDS, MAIN_NEW_IDS)}
NEW_TO_OLD = {new: old for new, old in zip(MAIN_NEW_IDS, MAIN_OLD_IDS)}
BONUS_OLD_TO_NEW = {i: i for i in BONUS_OLD_IDS}
BONUS_NEW_TO_OLD = {i: i for i in BONUS_OLD_IDS}
TOTAL_MAIN = len(MAIN_OLD_IDS)
TOTAL_BONUS = len(BONUS_OLD_IDS)
FREE_LESSONS = 1

COURSE_MAIN = [
    {"id": i + 1, "title": COURSE[COURSE_ID][MAIN_OLD_IDS[i] - 1]["title"]}
    for i in range(TOTAL_MAIN)
]
COURSE_BONUS = [
    {"id": i + 1, "title": COURSE[COURSE_ID][i]["title"], "bonus": True}
    for i in range(4)
]

REWARD_ACTIONS = {
    "share": 25,
    "share_achievement": 25,
    "invite_team": 50,
    "daily": 25,
    "review": 50,
}

# ---- Цены в Stars ----
TRIPWIRE_PRICE = 2500
FULL_COURSE_PRICE = 2500
MENTOR_PRICE = 28000
MENTOR_FLOOR = 23400
MENTOR_GP_CAP = 500

AB_EXPERIMENTS = {
    "price_tripwire": {
        "active": False,
        "variants": {
            "control": TRIPWIRE_PRICE,
            "low": 300,
            "bundle": 700,
        },
    },
    "price_full": {
        "active": False,
        "variants": {
            "control": FULL_COURSE_PRICE,
            "discount": 1700,
            "premium": 2500,
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

_STARS_INVOICE_CACHE: dict[tuple[str, int], str] = {}


def _bot_token() -> str:
    return os.getenv("BOT_TOKEN", BOT_TOKEN)


def _internal_api_key() -> str:
    return os.getenv("INTERNAL_API_KEY", INTERNAL_API_KEY)


def _prodamus_secret() -> str:
    return os.getenv("PRODAMUS_SECRET_KEY", "")


def _tribute_secret() -> str:
    return os.getenv("TRIBUTE_API_KEY", "")


def _load_courses() -> dict:
    return COURSE


def _user_id_from_init(init_data: str) -> int | None:
    """Валидировать init_data, вернуть telegram_id."""
    data = verify_init_data(init_data, _bot_token())
    if not data:
        return None
    try:
        u = json.loads(data["user"])
        uid = u.get("id")
        if not uid or not isinstance(uid, int):
            return None
        db.upsert_user(
            uid,
            first_name=u.get("first_name"),
            username=u.get("username"),
            photo_url=u.get("photo_url"),
        )
        return uid
    except Exception:
        return None


def current_user(x_init_data: str) -> int | None:
    """FastAPI-зависимость/хелпер получения текущего пользователя по X-Init-Data."""
    return _user_id_from_init(x_init_data)


def require_internal_key(authorization: str | None) -> bool:
    """Проверить заголовок Authorization: Bearer INTERNAL_API_KEY (constant-time)."""
    key = _internal_api_key()
    return bool(authorization and key and hmac.compare_digest(authorization, f"Bearer {key}"))


def _resolve_uid(
    x_init_data: str,
    authorization: str | None,
    body: dict | None = None,
) -> int | None:
    """Определить telegram_id запроса через X-Init-Data или INTERNAL_API_KEY + body.user_id."""
    uid = _user_id_from_init(x_init_data)
    if uid is not None:
        return uid
    if require_internal_key(authorization) and body:
        uid = body.get("user_id")
        if uid is not None:
            try:
                return int(uid)
            except (TypeError, ValueError):
                return None
    return None


def _course_response(uid: int) -> dict:
    """Собрать блок course."""
    raw_completed = db.get_completed(uid, COURSE_ID)
    main_completed = [OLD_TO_NEW[x] for x in raw_completed if x in MAIN_OLD_IDS]
    main_total = TOTAL_MAIN
    current = (max(main_completed) + 1) if main_completed else 1
    if current > main_total:
        current = main_total
    bonus_completed = len([x for x in db.get_completed(uid, BONUS_COURSE_ID) if x in BONUS_OLD_IDS])
    bonus_total = len(BONUS_OLD_IDS)
    return {
        "course_id": COURSE_ID,
        "completed_lessons": main_completed,
        "total_lessons": main_total,
        "current_lesson_id": current,
        "bonus_lessons": bonus_completed,
        "total_bonus_lessons": bonus_total,
        "bonus_unlocked": len(main_completed) >= main_total,
        "free_lessons": FREE_LESSONS,
    }


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


def _ab_price(course_id: str, uid: int | None) -> tuple[int, str]:
    """Вернуть (цена, variant_label) с учётом A/B-эксперимента."""
    if course_id == "tripwire":
        exp, base = "price_tripwire", TRIPWIRE_PRICE
    elif course_id == COURSE_ID:
        exp, base = "price_full", FULL_COURSE_PRICE
    else:
        return MENTOR_PRICE, "control"
    cfg = AB_EXPERIMENTS.get(exp)
    if not cfg or not cfg.get("active") or uid is None:
        return base, "control"
    variant = db.assign_ab_variant(uid, exp, list(cfg["variants"].keys()))
    return cfg["variants"][variant], variant


def _verify_tribute_signature(raw: bytes, x_signature: str | None, api_key: str) -> bool:
    """Проверить HMAC-SHA256 подпись вебхука Tribute."""
    if not x_signature or not api_key:
        return False
    computed = hmac.new(api_key.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, x_signature)


def _extract_gift_token(raw_gift: str) -> tuple[str, str | None]:
    """Разобрать параметр подарка '<recipient>__<token>' или '<recipient>'."""
    cleaned = raw_gift.strip()
    if "__" in cleaned:
        recipient, token = cleaned.split("__", 1)
    else:
        recipient, token = cleaned, None
    return recipient.lstrip("@").lower(), token


async def _send_telegram_notification(chat_id: int, text: str) -> bool:
    """Отправить уведомление в Telegram через Bot API."""
    token = _bot_token()
    if not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text},
            )
            return r.status_code == 200
    except Exception:
        return False
