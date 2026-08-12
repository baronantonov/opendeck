"""Tribute (карта / СБП / USDT, вывод в USDT) — платёжный провайдер для менторства.

Особенность: Tribute НЕ умеет динамическую цену через REST API — digital-продукт
имеет фиксированную цену, заданную в Tribute Dashboard. Поэтому провайдер НЕ делает
сетевой запрос create_invoice: он просто возвращает прямую ссылку на продукт
(https://web.tribute.tg/p/<slug>), а подтверждение оплаты приходит вебхуком
`new_digital_product` на TRIBUTE_WEBHOOK_URL (см. backend/main.py /webhooks/tribute).

GP-скидка НЕ применяется к Tribute-каналу (цена фикс). Динамическая скидка —
только в Stars-канале (backend/main.py /api/create-invoice, course_id='mentoring').

Комиссия Tribute: 10% (flat, по FAQ). Net Фриды после 10% с цены $230 ≈ $207 (≥ цель $200).
"""
from __future__ import annotations

from bot.payments.base import PaymentProvider, PaymentInvoice
from bot import config


class TributeProvider(PaymentProvider):
    @property
    def name(self) -> str:
        return "tribute"

    async def create_invoice(self, user_id: int, course_id: str, amount_label: str) -> PaymentInvoice:
        # Менторство через Tribute — только фикс-продукт. Динамика не поддержана API.
        if not config.TRIBUTE_MENTOR_PRODUCT_ID:
            return PaymentInvoice(
                provider=self.name,
                url_or_payload="",  # бот покажет «настройте Tribute»
                meta={"not_configured": True},
            )
        slug = config.TRIBUTE_MENTOR_PRODUCT_ID
        pay_url = f"https://web.tribute.tg/p/{slug}"
        order_id = f"{user_id}:{course_id}"
        return PaymentInvoice(
            provider=self.name,
            url_or_payload=pay_url,  # открыть через openLink (внешний браузер)
            meta={"order_id": order_id, "product_slug": slug},
        )

    async def verify(self, payload: dict) -> bool:
        # Проверка подписи вебхука — в backend/main.py /webhooks/tribute.
        return bool(payload.get("purchase_id") or payload.get("id"))
