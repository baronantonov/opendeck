"""Prodamus (МИР / СБП / карты РФ) — внешний редирект, серая зона ToS.

ВАЖНО: открывать через openLink (внешний браузер), НЕ в webview Mini App,
чтобы снизить риск бана бота. Подтверждение — по webhook от Prodamus.

Реальный REST API Prodamus (payform.ru), по мануалу:
https://help.prodamus.ru/payform/integracii/rest-api/instrukcii-dlya-samostoyatelnaya-integracii-servisov

Формирование платёжной ссылки:
- POST/GET на https://<поддомен>.payform.ru/ с параметрами:
    do        = "link" | "pay"
    products[] = [{name, price, quantity, ...}]
    sys       = код интеграции (согласуется с поддержкой)
    order_id  = "user_id:course_id"  (для сопоставления в webhook)
    urlNotification = URL вебхука
- Подпись: параметр `signature` = HMAC-SHA256(json(отсортированные ключи), secret_key).
  Алгоритм (как в Hmac::verify на стороне Prodamus):
    1. все значения -> строки
    2. отсортировать ключи по алфавиту, вглубь (products[0][name] и т.д.)
    3. массив -> json-строка
    4. экранировать '/' -> '\/'
    5. подписать секретом через sha256
- do="link" возвращает готовую ссылку вида https://payform.ru/xxxx/ в ТЕЛЕ ответа (text/plain).
"""
from __future__ import annotations

import hashlib
import hmac
import json

import httpx
from bot.payments.base import PaymentProvider, PaymentInvoice
from bot import config


def _flatten(d: dict, prefix: str = "") -> dict:
    """Раскладываем вложенный dict в плоские ключи 'a[b][c]' для сортировки/подписи."""
    out: dict = {}
    for k, v in d.items():
        key = f"{prefix}[{k}]" if prefix else str(k)
        if isinstance(v, dict):
            out.update(_flatten(v, key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    out.update(_flatten(item, f"{key}[{i}]"))
                else:
                    out[f"{key}[{i}]"] = item
        else:
            out[key] = v
    return out


def sign_params(params: dict, secret: str) -> str:
    """Подпись запроса Prodamus (алгоритм Hmac из мануала)."""
    flat = _flatten(params)
    str_vals = {k: ("" if v is None else str(v)) for k, v in flat.items()}
    ordered = dict(sorted(str_vals.items()))
    raw = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    raw_escaped = raw.replace("/", "\\/")
    return hmac.new(
        secret.encode("utf-8"),
        raw_escaped.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


class ProdamusProvider(PaymentProvider):
    @property
    def name(self) -> str:
        return "prodamus"

    async def create_invoice(self, user_id: int, course_id: str, amount_label: str) -> PaymentInvoice:
        # Если ключи Prodamus не заданы — не лезем в сеть, возвращаем заглушку.
        if not (config.PRODAMUS_PAYFORM_URL and config.PRODAMUS_SECRET_KEY and config.PRODAMUS_SYS_CODE):
            return PaymentInvoice(
                provider=self.name,
                url_or_payload="",  # бот покажет сообщение "настройте Prodamus"
                meta={"not_configured": True},
            )

        order_id = f"{user_id}:{course_id}"
        # Цена в рублях: берём из amount_label вида "1990 RUB" либо дефолт 1990.
        amount_rub = 1990
        try:
            amount_rub = int("".join(ch for ch in amount_label if ch.isdigit()) or "1990")
        except Exception:
            amount_rub = 1990

        # Плоские поля (как в мануале Prodamus): products[0][name] и т.д.
        # httpx сериализует dict с такими ключами в корректный
        # application/x-www-form-urlencoded (НЕ как JSON-массив).
        # ВНИМАНИЕ: твоя платёжная форма (baronantonov.payform.ru) в текущем
        # режиме НЕ требует и НЕ проверяет поле signature при создании ссылки —
        # передача signature вызывает 400. Поэтому шлём параметры БЕЗ подписи;
        # подпись проверяется только на входящем webhook (см. backend/main.py).
        params: dict = {
            "do": "link",
            "sys": config.PRODAMUS_SYS_CODE,
            "order_id": order_id,
            "currency": "rub",
            "products[0][name]": "Курс DJ School — Open Deck",
            "products[0][price]": amount_rub,
            "products[0][quantity]": 1,
            "products[0][type]": "course",
            "urlNotification": f"{config.BACKEND_URL}/webhooks/prodamus",
            "urlSuccess": f"{config.MINI_APP_URL}",
            "urlReturn": f"{config.MINI_APP_URL}",
        }
        # Подпись НЕ отправляется (форма не проверяет её при создании ссылки).
        # sign_params оставлен для справки / если включите проверку в кабинете.
        # params["signature"] = sign_params(params, config.PRODAMUS_SECRET_KEY)

        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=False) as c:
                # Prodamus отвечает 302 + заголовок Location = ссылка на оплату
                # (либо текстом в теле, если форма настроена на do=link-текст).
                r = await c.post(config.PRODAMUS_PAYFORM_URL, data=params)
            # 1) приоритет — Location из редиректа
            location = r.headers.get("location", "")
            if r.status_code in (301, 302, 303, 307, 308) and location.startswith("http"):
                return PaymentInvoice(
                    provider=self.name,
                    url_or_payload=location,  # открыть через openLink
                    meta={"order_id": order_id, "amount_rub": amount_rub},
                )
            # 2) fallback — текстовая ссылка в теле (как описано в мануале)
            text = r.text.strip()
            if r.status_code == 200 and text.startswith("http"):
                return PaymentInvoice(
                    provider=self.name,
                    url_or_payload=text,
                    meta={"order_id": order_id, "amount_rub": amount_rub},
                )
            # иначе — ошибка/ненастроенная форма
            return PaymentInvoice(
                provider=self.name,
                url_or_payload="",
                meta={"error": f"status={r.status_code}", "location": location, "body": text[:200]},
            )
        except Exception as e:
            return PaymentInvoice(
                provider=self.name,
                url_or_payload="",
                meta={"error": str(e)},
            )

    async def verify(self, payload: dict) -> bool:
        # payload приходит на backend/webhooks/prodamus (см. backend/main.py).
        # Проверка подписи делается там же (Hmac::verify).
        return payload.get("status") == "paid"
