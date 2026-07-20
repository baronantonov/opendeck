"""Telegram Stars — нативный путь для цифровых товаров (30% комиссия).

Оплата идёт через send_invoice + обработку pre_checkout / successful_payment.
Здесь — только подготовка инвойса; реальная выдача доступа в main.py по successful_payment.
"""
from __future__ import annotations
from bot.payments.base import PaymentProvider, PaymentInvoice
from bot import config


class StarsProvider(PaymentProvider):
    @property
    def name(self) -> str:
        return "stars"

    async def create_invoice(self, user_id: int, course_id: str, amount_label: str) -> PaymentInvoice:
        # В aiogram:
        #   await bot.send_invoice(chat_id=user_id, title=...,
        #       description=..., payload=course_id, provider_token="",
        #       currency="XTR", prices=[LabeledPrice(label=amount_label, amount=config.STARS_PRICE)])
        # provider_token пустой -> значит Stars.
        return PaymentInvoice(
            provider=self.name,
            url_or_payload=course_id,  # payload, который вернётся в successful_payment
            meta={"price_stars": config.STARS_PRICE},
        )

    async def verify(self, payload: dict) -> bool:
        # Для Stars верификация = успешный successful_payment (проверяет TG).
        return bool(payload.get("ok"))
