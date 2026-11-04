"""Роутер внешних платёжных вебхуков (/webhooks/prodamus, /webhooks/tribute)."""
from __future__ import annotations

import json
import logging
from urllib.parse import parse_qs

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse

import backend.db as db
from backend.deps import _prodamus_secret, _tribute_secret, _verify_tribute_signature
import backend.prodamus_sign as prodamus_sign

logger = logging.getLogger("opendeck.backend")
router = APIRouter()


@router.post("/webhooks/prodamus")
async def prodamus_webhook(req: Request, sign: str = Header(None, alias="Sign")):
    secret_raw = _prodamus_secret()
    if not secret_raw:
        return JSONResponse({"error": "webhook_not_configured"}, status_code=500)

    raw_bytes = await req.body()
    if len(raw_bytes) > 65536:
        return JSONResponse({"error": "payload_too_large"}, status_code=413)

    raw = raw_bytes.decode("utf-8", "ignore")
    parsed = parse_qs(raw, keep_blank_values=True)
    form_dict = {k: (v[0] if isinstance(v, list) and v else "") for k, v in parsed.items()}

    if not prodamus_sign.verify_webhook(form_dict, secret_raw, sign):
        return JSONResponse({"error": "bad_signature"}, status_code=400)

    status = form_dict.get("status") or form_dict.get("payment_status")
    order_id = form_dict.get("order_id") or ""

    if status == "paid" and order_id:
        try:
            parts = order_id.split(":")
            user_id = int(parts[0])
            cid = parts[1]
            gp_spent = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 0
        except (ValueError, IndexError):
            logger.warning(f"Invalid Prodamus order_id format: {order_id}")
            return JSONResponse({"error": "bad_order_id"}, status_code=400)

        if cid not in ("dj-basics", "tripwire", "mentoring"):
            return JSONResponse({"error": "bad_course_id"}, status_code=400)

        sum_raw = form_dict.get("sum") or form_dict.get("amount")
        paid_rub: int | None = None
        if sum_raw is not None or len(parts) >= 3 or cid == "mentoring":
            try:
                paid_val = float(sum_raw or 0)
            except (TypeError, ValueError):
                return JSONResponse({"error": "bad_amount"}, status_code=400)
            min_rub = 19800.0 if cid == "mentoring" else 1500.0
            if cid == "mentoring" and gp_spent > 0 and db.get_gp(user_id) < gp_spent:
                min_rub = 23900.0
            if paid_val < min_rub:
                logger.warning(f"Prodamus underpayment rejected: order={order_id} sum={paid_val} min={min_rub}")
                return JSONResponse({"error": "underpaid"}, status_code=400)
            paid_rub = int(round(paid_val))

        if not db.claim_webhook_order(order_id):
            return {"ok": True, "duplicate": True}

        try:
            if gp_spent > 0:
                db.spend_gp(user_id, gp_spent, reason=f"{cid}_discount")
            db.add_payment(
                user_id,
                cid,
                "prodamus",
                amount=paid_rub,
                currency="RUB",
                status="paid",
                raw=json.dumps(form_dict, ensure_ascii=False)[:4000],
            )
            db.apply_referral_purchase(user_id)
        except Exception:
            db.unclaim_webhook_order(order_id)
            logger.exception("Error processing Prodamus webhook")
            return JSONResponse({"error": "internal_error"}, status_code=500)
    return {"ok": True}


@router.post("/webhooks/tribute")
async def tribute_webhook(req: Request, x_signature: str = Header(None, alias="X-Signature")):
    api_key = _tribute_secret()
    if not api_key:
        return JSONResponse({"error": "webhook_not_configured"}, status_code=500)

    if not x_signature:
        return JSONResponse({"error": "missing_signature"}, status_code=400)

    raw = await req.body()
    if len(raw) > 65536:
        return JSONResponse({"error": "payload_too_large"}, status_code=413)
    if not _verify_tribute_signature(raw, x_signature, api_key):
        return JSONResponse({"error": "bad_signature"}, status_code=400)

    try:
        body = json.loads(raw.decode("utf-8", "ignore"))
    except Exception:
        return JSONResponse({"error": "bad_json"}, status_code=400)

    event_name = str(body.get("name") or body.get("event") or "").lower()
    if event_name and any(w in event_name for w in ("cancel", "refund", "fail", "expire")):
        return {"ok": True, "ignored": True}

    purchase_id = str(body.get("purchase_id") or body.get("id") or "")
    if not purchase_id:
        return JSONResponse({"error": "no_purchase_id"}, status_code=400)

    user_id = (
        body.get("user_id")
        or body.get("telegram_id")
        or (body.get("payload") or {}).get("user", {}).get("telegram_id")
        or (body.get("payload") or {}).get("telegram_id")
        or (body.get("customer") or {}).get("telegram_id")
    )
    if not user_id:
        return JSONResponse({"error": "missing_user_id"}, status_code=400)

    if not db.claim_webhook_order(purchase_id):
        return {"ok": True, "duplicate": True}

    course_id = "mentoring"
    try:
        uid = int(user_id)
        db.add_payment(
            uid,
            course_id,
            "tribute",
            status="paid",
            raw=json.dumps(body, ensure_ascii=False)[:4000],
        )
        db.apply_referral_purchase(uid)
    except Exception:
        db.unclaim_webhook_order(purchase_id)
        logger.exception("Error processing Tribute webhook")
        return JSONResponse({"error": "internal_error"}, status_code=500)
    return {"ok": True}
