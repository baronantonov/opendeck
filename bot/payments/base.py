"""Абстрактный платёжный провайдер.

Любой провайдер реализует три метода:
  - create_invoice(order) -> PaymentInvoice  (ссылка/пейлоад для юзера)
  - verify(payload)       -> bool            (подтверждение оплаты)
  - name                  -> str             (идентификатор для БД)
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class PaymentInvoice:
    provider: str
    # Для Stars — payload для send_invoice; для TON/Prodamus — URL для openLink
    url_or_payload: str
    meta: dict = None


class PaymentProvider(ABC):
    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def create_invoice(self, user_id: int, course_id: str, amount_label: str) -> PaymentInvoice: ...

    @abstractmethod
    async def verify(self, payload: dict) -> bool: ...
