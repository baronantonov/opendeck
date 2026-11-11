"""Роутер создания инвойсов, выдачи доступа и активации подарков (/api/create-invoice, /api/grant, /api/gift/activate)."""
from __future__ import annotations

import secrets
import time

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
import httpx

import backend.db as db
from backend.deps import (
    COURSE_ID,
    MENTOR_GP_CAP,
    _GIFT_USERNAME_RE,
    _STARS_INVOICE_CACHE,
    _ab_price,
    _bot_token,
    _user_id_from_init,
    require_internal_key,
)
from backend.schemas import CreateInvoice, GiftActivate, Grant

router = APIRouter()


@router.post("/api/create-invoice")
async def create_invoice(
    body: CreateInvoice,
    x_init_data: str = Header("", alias="X-Init-Data"),
):
    uid = _user_id_from_init(x_init_data)
    if uid is None:
        return JSONResponse({"error": "bad_init_data"}, status_code=401)

    course_id = body.course_id
    variant = "control"
    price_usd = 30
    custom_order_id = None
    if course_id in ("tripwire", COURSE_ID):
        if body.provider == "tribute":
            return JSONResponse(
                {
                    "error": "tribute_course_not_supported",
                    "detail": "Оплата курса через Tribute недоступна (только менторство). Используй Stars или Prodamus (Карта/СБП)",
                },
                status_code=400,
            )
        price, variant = _ab_price(course_id, uid)
        label = "Pocket DJ: Полный курс"
        custom_order_id = f"{uid}:{course_id}:0:{int(time.time())}"
    elif course_id == "mentoring":
        if body.provider == "stars":
            return JSONResponse(
                {
                    "error": "stars_not_allowed_for_mentoring",
                    "detail": "Оплата менторства доступна только через Prodamus или Tribute (без 40% комиссии Stars)",
                },
                status_code=400,
            )
        gp = db.get_gp(uid)
        max_gp = min(max(gp, 0), MENTOR_GP_CAP)
        if body.points is not None:
            capped_gp = min(max(int(body.points), 0), max_gp)
        else:
            capped_gp = max_gp
        discount_rub = round(capped_gp * 18.2)
        price_rub = max(19800, 28900 - discount_rub)
        price_usd = max(200, 300 - round(capped_gp * 0.2))
        price = price_rub
        label = f"Персональное менторство FREEDA DJ (${price_usd})"
        custom_order_id = f"{uid}:mentoring:{capped_gp}:{int(time.time())}"
    else:
        return JSONResponse({"error": "unknown_course"}, status_code=400)

    gift_payload = None
    gift_token = None
    if body.gift_recipient:
        if body.provider != "stars":
            return JSONResponse({"error": "gift_stars_only"}, status_code=400)
        if course_id not in ("tripwire", COURSE_ID):
            return JSONResponse({"error": "gift_course_only"}, status_code=400)
        recipient = body.gift_recipient.strip().lstrip("@").lower()
        if not _GIFT_USERNAME_RE.fullmatch(recipient):
            return JSONResponse({"error": "bad_gift_recipient"}, status_code=400)
        gift_token = secrets.token_urlsafe(24)
        gift_payload = f"gift:{gift_token}"
        db.create_gift(uid, recipient, gift_token)

    if body.provider == "prodamus":
        from bot.payments.prodamus import ProdamusProvider
        prov = ProdamusProvider()
        rub = price if course_id == "mentoring" else max(1, round(price * 1.7))
        inv = await prov.create_invoice(
            uid,
            course_id,
            f"{rub} RUB",
            order_id=custom_order_id,
            product_name=label,
        )
        if inv.meta.get("not_configured"):
            return JSONResponse(
                {
                    "error": "prodamus_not_configured",
                    "detail": "Prodamus не настроен (нужны PAYFORM_URL, SECRET_KEY, SYS_CODE)",
                },
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

    elif body.provider == "tribute":
        from bot.payments.tribute import TributeProvider
        prov = TributeProvider()
        amount_str = f"{price_usd} USD" if course_id == "mentoring" else f"{price} XTR"
        inv = await prov.create_invoice(uid, course_id, amount_str)
        if inv.meta.get("not_configured"):
            return JSONResponse(
                {
                    "error": "tribute_not_configured",
                    "detail": "Tribute не настроен (нужны TRIBUTE_MENTOR_PRODUCT_ID)",
                },
                status_code=503,
            )
        if not inv.url_or_payload:
            return JSONResponse(
                {"error": "tribute_invoice_failed", "detail": inv.meta},
                status_code=502,
            )
        return {
            "provider": "tribute",
            "pay_url": inv.url_or_payload,
            "order_id": inv.meta.get("order_id"),
            "title": label,
        }

    cache_key = (course_id, price)
    exp_name = "price_tripwire" if course_id == "tripwire" else ("price_full" if course_id == COURSE_ID else None)
    if gift_payload is None and cache_key in _STARS_INVOICE_CACHE:
        return {
            "invoice_link": _STARS_INVOICE_CACHE[cache_key],
            "title": label,
            "price": price,
            "variant": variant,
            "experiment": exp_name,
        }

    async with httpx.AsyncClient(timeout=10) as c:
        resp = await c.post(
            f"https://api.telegram.org/bot{_bot_token()}/createInvoiceLink",
            json={
                "title": label,
                "description": "Полный доступ к курсу Open Deck DJ School: уроки 2-6 + все бонусы от FREEDA DJ",
                "payload": gift_payload or course_id,
                "provider_token": "",
                "currency": "XTR",
                "prices": [{"label": label, "amount": price}],
            },
        )
        data = resp.json()
    if not data.get("ok"):
        return JSONResponse({"error": "telegram_api_error", "detail": data}, status_code=502)
    if gift_payload is None:
        _STARS_INVOICE_CACHE[cache_key] = data["result"]
    res = {
        "invoice_link": data["result"],
        "title": label,
        "price": price,
        "variant": variant,
        "experiment": exp_name,
    }
    if gift_token:
        res["gift_token"] = gift_token
    return res


@router.post("/api/grant")
async def grant(
    g: Grant,
    authorization: str | None = Header(None),
):
    if not require_internal_key(authorization):
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    db.add_payment(g.user_id, g.course_id, g.provider, status="paid")
    return {"ok": True}


@router.post("/api/gift/activate")
async def gift_activate(
    g: GiftActivate,
    authorization: str | None = Header(None),
):
    if not require_internal_key(authorization):
        return JSONResponse({"error": "unauthorized"}, status_code=403)
    result = db.activate_gift(g.token, g.user_id)
    if result is None:
        return JSONResponse({"error": "bad_token"}, status_code=400)
    return result
