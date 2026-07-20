"""aiogram3-бот DJ School: Mini App + выбор способа оплаты + выдача доступа.

Запуск:  BOT_TOKEN=... python -m bot.main
Для MVP достаточно Stars (send_invoice, currency="XTR").
"""
from __future__ import annotations

import sys
from pathlib import Path

# Чтобы импорт bot.config/worked и при запуске как модуля, и как скрипта
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    InlineKeyboardButton, InlineKeyboardMarkup, Message, PreCheckoutQuery,
    SuccessfulPayment, WebAppInfo, LabeledPrice,
)
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

import httpx
from bot import config
from bot.payments import get_provider

COURSE_ID = "dj-basics"
COURSE_TITLE = "Базовый курс DJing (3 урока)"


def main_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎧 Открыть курс DJ", web_app=WebAppInfo(url=config.MINI_APP_URL))],
    ])


async def cmd_start(msg: Message):
    await msg.answer(
        "Привет! Это школа DJing 🎚\nНажми кнопку, чтобы открыть курс:",
        reply_markup=main_kb(),
    )


async def on_buy(cb):
    method = cb.data.split(":", 1)[1]
    provider = get_provider(method)
    inv = await provider.create_invoice(cb.from_user.id, COURSE_ID, COURSE_TITLE)
    if method == "stars":
        # Нативный путь TG: provider_token пустой => валюта XTR (Stars)
        await cb.bot.send_invoice(
            chat_id=cb.from_user.id,
            title=COURSE_TITLE,
            description="Видеокурс по DJing: от пультов до первого сета.",
            payload=COURSE_ID,
            provider_token="",          # пустой = Stars
            currency="XTR",
            prices=[LabeledPrice(label="Курс DJing", amount=config.STARS_PRICE)],
        )
    elif method == "ton":
        await cb.message.answer(
            f"Оплата за TON. Переведите {inv.meta['amount_ton']} TON на {inv.url_or_payload} "
            f"в Mini App (TON Connect)."
        )
    else:  # prodamus — открываем ВНЕ webview (openLink), чтобы не словить бан
        if inv.meta.get("not_configured"):
            await cb.message.answer("Оплата МИР/СБП пока не настроена. Напиши админу или выбери Stars/TON.")
        else:
            await cb.message.answer(
                f"Оплата МИР/СБП по ссылке (откроется в браузере):\n{inv.url_or_payload}"
            )
    await cb.answer()


async def on_pre_checkout(q: PreCheckoutQuery):
    # Подтверждаем готовность принять Stars-оплату
    await q.bot.answer_pre_checkout_query(q.id, ok=True)


async def on_paid(msg: Message):
    payment: SuccessfulPayment = msg.successful_payment
    course_id = payment.invoice_payload
    async with httpx.AsyncClient() as c:
        await c.post(f"{config.BACKEND_URL}/api/grant", json={
            "user_id": msg.from_user.id,
            "course_id": course_id,
            "provider": "stars",
        })
    await msg.answer("✅ Оплата прошла! Открывай курс в Mini App и смотри уроки.")


async def main():
    if not config.BOT_TOKEN:
        raise SystemExit("❌ BOT_TOKEN не задан. Экспортируйте переменную или впишите в bot/config.py")
    bot = Bot(token=config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.message.register(cmd_start, F.text == "/start")
    dp.callback_query.register(on_buy, F.data.startswith("buy:"))
    dp.pre_checkout_query.register(on_pre_checkout)
    dp.message.register(on_paid, F.successful_payment)
    print("🤖 Бот запущен. /start в Telegram.")
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
