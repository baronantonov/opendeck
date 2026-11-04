"""FastAPI-бэкенд DJ School — PLAY API (GP + Referral).

Точка входа ASGI (`backend.main:app`). Все доменные роуты вынесены в `backend/routers/`,
схемы — в `backend/schemas.py`, общие зависимости и константы — в `backend/deps.py`.
Для 100% обратной совместимости с тестами и внешними вызовами все публичные и
приватные символы реэкспортируются из этого модуля.
"""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from backend.auth import verify_init_data  # noqa: F401
from backend.crm import router as crm_router
import backend.db as db
from backend.deps import (  # noqa: F401
    AB_EXPERIMENTS,
    BONUS_COURSE_ID,
    BONUS_NEW_IDS,
    BONUS_NEW_TO_OLD,
    BONUS_OLD_IDS,
    BONUS_OLD_TO_NEW,
    BOT_TOKEN,
    COURSE,
    COURSE_BONUS,
    COURSE_ID,
    COURSE_MAIN,
    FREE_LESSONS,
    FULL_COURSE_PRICE,
    INTERNAL_API_KEY,
    MAIN_NEW_IDS,
    MAIN_OLD_IDS,
    MENTOR_FLOOR,
    MENTOR_GP_CAP,
    MENTOR_PRICE,
    MINI_APP_DIR,
    NEW_TO_OLD,
    OLD_TO_NEW,
    REWARD_ACTIONS,
    TOTAL_BONUS,
    TOTAL_MAIN,
    TRIPWIRE_PRICE,
    _GIFT_USERNAME_RE,
    _STARS_INVOICE_CACHE,
    _ab_price,
    _bot_token,
    _course_response,
    _extract_gift_token,
    _internal_api_key,
    _load_courses,
    _prodamus_secret,
    _resolve_uid,
    _send_telegram_notification,
    _tribute_secret,
    _user_id_from_init,
    _user_response,
    _verify_tribute_signature,
    current_user,
    require_internal_key,
)
import backend.prodamus_sign as prodamus_sign  # noqa: F401
from backend.routers.ab_testing import ab_assign, ab_track, router as ab_router  # noqa: F401
from backend.routers.economy import (  # noqa: F401
    archetype_share,
    gp_apply,
    gp_earn,
    gp_spend,
    referral_purchase,
    router as economy_router,
)
from backend.routers.lessons import (  # noqa: F401
    lessons,
    lessons_bonus,
    progress,
    router as lessons_router,
)
from backend.routers.payments import (  # noqa: F401
    create_invoice,
    gift_activate,
    grant,
    router as payments_router,
)
from backend.routers.session import (  # noqa: F401
    api_init,
    profile,
    router as session_router,
)
from backend.routers.webhooks import (  # noqa: F401
    prodamus_webhook,
    router as webhooks_router,
    tribute_webhook,
)
from backend.schemas import (  # noqa: F401
    AbTrackRequest,
    ArchetypeShareRequest,
    CreateInvoice,
    CreateInvoiceRequest,
    GiftActivate,
    GiftActivateRequest,
    GpApplyRequest,
    GpEarnRequest,
    GpSpendRequest,
    Grant,
    GrantRequest,
    InitRequest,
    Progress,
    ProgressRequest,
    ReferralPurchaseRequest,
)

logger = logging.getLogger("opendeck.backend")

db.init()

app = FastAPI(title="DJ School API")

_DEFAULT_CORS_ORIGINS = [
    "https://baronantonov.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_EXTRA_CORS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "").split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_CORS_ORIGINS + _EXTRA_CORS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


app.include_router(crm_router)
app.include_router(session_router)
app.include_router(lessons_router)
app.include_router(economy_router)
app.include_router(payments_router)
app.include_router(ab_router)
app.include_router(webhooks_router)
