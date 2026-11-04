"""Pydantic-схемы запросов и валидаторы для FastAPI-бэкенда DJ School."""
from __future__ import annotations

import re
from pydantic import BaseModel

COURSE_ID = "dj-basics"

# Валидация Telegram username для подарков (совпадает с фронтендом)
_GIFT_USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{5,32}$")


class Grant(BaseModel):
    user_id: int
    course_id: str
    provider: str


class Progress(BaseModel):
    course_id: str = COURSE_ID
    lesson_id: int
    bonus: bool = False  # C3: фронт помечает бонусный урок явно


class InitRequest(BaseModel):
    init_data: str | None = None
    user_id: int | None = None
    start_param: str | None = None


class CreateInvoice(BaseModel):
    course_id: str = COURSE_ID
    price: int | None = None  # если передан — переопределяет цену по-умолчанию (игнорируется на сервере C2)
    provider: str = "stars"   # stars | prodamus | ton | tribute
    points: int | None = None  # выбор количества списываемых GP (для менторства)
    gift_recipient: str | None = None  # если задан — это подарок курса (только Stars)


class GiftActivate(BaseModel):
    token: str
    user_id: int


class ReferralPurchaseRequest(BaseModel):
    user_id: int | None = None


class GpApplyRequest(BaseModel):
    user_id: int | None = None
    amount: int | None = None
    charge_id: str | None = None


class GpSpendRequest(BaseModel):
    user_id: int | None = None
    amount: int
    reason: str = "spend"


class GpEarnRequest(BaseModel):
    user_id: int | None = None
    action: str


class ArchetypeShareRequest(BaseModel):
    user_id: int | None = None


class AbTrackRequest(BaseModel):
    user_id: int | None = None
    course_id: str | None = None


# Алиасы для совместимости со спецификацией
GrantRequest = Grant
ProgressRequest = Progress
CreateInvoiceRequest = CreateInvoice
GiftActivateRequest = GiftActivate
