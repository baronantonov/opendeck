"""Prodamus (МИР / СБП / карты РФ) — внешний редирект, серая зона ToS.

ВАЖНО: открывать через openLink (внешний браузер), НЕ в webview Mini App,
чтобы снизить риск бана бота. Подтверждение — по webhook от Prodamus.
"""
from __future__ import annotations
import httpx
from bot.payments.base import PaymentProvider, PaymentInvoice
from bot import config


class ProdamusProvider(PaymentProvider):
    @property
    def name(self) -> str:
        return "prodamus"

    async def create_invoice(self, user_id: int, course_id: str, amount_label: str) -> PaymentInvoice:
        # Если ключи Prodamus не заданы — не лезем в сеть, возвращаем заглушку.
        if not (config.PRODAMUS_API_KEY and config.PRODAMUS_SHOP_ID):
            return PaymentInvoice(
                provider=self.name,
                url_or_payload="",  # бот покажет сообщение "настройте Prodamus"
                meta={"not_configured": True},
            )
        # Создаём инвойс в Prodamus API -> получаем URL для оплаты.
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post("https://api.prodamus.example/v1/invoices", headers={
                    "Authorization": f"Bearer {config.PRODAMUS_API_KEY}",
                }, json={
                    "shop_id": config.PRODAMUS_SHOP_ID,
                    "amount": 1990,  # руб
                    "currency": "RUB",
                    "order_id": f"{user_id}:{course_id}",
                    "webhook_url": f"{config.BACKEND_URL}/webhooks/prodamus",
                })
                data = r.json()
            return PaymentInvoice(
                provider=self.name,
                url_or_payload=data["pay_url"],  # открыть через openLink
                meta={"invoice_id": data.get("id")},
            )
        except Exception as e:
            # Любая сетевая ошибка не должна ронять бота.
            return PaymentInvoice(
                provider=self.name,
                url_or_payload="",
                meta={"error": str(e)},
            )

    async def verify(self, payload: dict) -> bool:
        # payload приходит на backend/webhooks/prodamus (см. backend/main.py).
        # Проверяем подпись webhook-секретом.
        return payload.get("status") == "paid"
