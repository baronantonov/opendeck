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
    SuccessfulPayment, WebAppInfo, InlineQuery,
    InlineQueryResultArticle, InputTextMessageContent,
)
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import CommandStart, CommandObject

import httpx
from bot import config

COURSE_ID = "dj-basics"


def main_kb(start_param: str | None = None) -> InlineKeyboardMarkup:
    # Свежий ?v=<git-hash> при КАЖДОМ нажатии /start — бьём кэш Telegram.
    url = config.mini_app_url()
    if start_param:
        delim = "&" if "?" in url else "?"
        url = f"{url}{delim}startapp={start_param}"
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎧 Открыть курс DJ", web_app=WebAppInfo(url=url))],
    ])


async def cmd_start(msg: Message, command: CommandObject | None = None):
    start_arg = command.args if command else None
    if not start_arg and msg.text and " " in msg.text:
        parts = msg.text.split(maxsplit=1)
        if len(parts) > 1:
            start_arg = parts[1].strip()

    # GH: win-back — если вернулся через 30+ дней и не купил, предложить вернуться
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(
                f"{config.BACKEND_URL}/api/init",
                json={
                    "user_id": msg.from_user.id,
                    "start_param": start_arg,
                },
                headers={"Authorization": f"Bearer {config.INTERNAL_API_KEY}"},
            )
            if r.status_code == 200:
                d = r.json()
                paid = d.get("paid") or d.get("paid_full") or d.get("paid_tripwire")
                last = d.get("user", {}).get("last_seen") or d.get("last_seen") or ""
                if not paid and last:
                    try:
                        from datetime import datetime
                        ld = datetime.fromisoformat(last.replace("Z", ""))
                        days = (datetime.now() - ld).days
                        if days >= 30:
                            await msg.answer(
                                f"👋 С возвращением! Прошло {days} дней с твоей последней сессии.\n"
                                "Уроки 2–6 всё ещё ждут тебя. Открой доступ со скидкой 50 ⭐ за возврат:",
                                reply_markup=main_kb(start_arg),
                            )
                            return
                    except Exception:
                        pass
    except Exception:
        pass
    await msg.answer(
        "Привет! Это школа DJing 🎚\nНажми кнопку, чтобы открыть курс:",
        reply_markup=main_kb(start_arg),
    )


async def on_pre_checkout(q: PreCheckoutQuery):
    # Валидируем валюту и сумму Stars-оплаты перед подтверждением
    if q.currency != "XTR" or q.total_amount <= 0:
        await q.bot.answer_pre_checkout_query(
            q.id,
            ok=False,
            error_message="Некорректная валюта или сумма счёта.",
        )
        return
    payload = q.invoice_payload or ""
    if not (payload in ("dj-basics", "tripwire", "mentoring") or payload.startswith("gift:")):
        await q.bot.answer_pre_checkout_query(
            q.id,
            ok=False,
            error_message="Неизвестный тип заказа.",
        )
        return
    await q.bot.answer_pre_checkout_query(q.id, ok=True)


async def on_paid(msg: Message):
    payment: SuccessfulPayment = msg.successful_payment
    course_id = payment.invoice_payload
    charge_id = payment.telegram_payment_charge_id
    headers = {"Authorization": f"Bearer {config.INTERNAL_API_KEY}"}
    async with httpx.AsyncClient() as c:
        # 0) подарок курса: payload = "gift:<token>" — подтверждаем оплату подарка
        #    (pending -> paid) и НЕ выдаём курс самому покупателю (фикс бага «2 по цене 1»).
        if course_id.startswith("gift:"):
            gift_token = course_id.split(":", 1)[1]
            try:
                ga = await c.post(f"{config.BACKEND_URL}/api/gift/activate", json={
                    "user_id": msg.from_user.id,
                    "token": gift_token,
                }, headers=headers)
                if ga.status_code != 200:
                    print(f"⚠️ /api/gift/activate failed: {ga.status_code} {ga.text}")
                    await msg.answer("⚠️ Оплата получена, но не удалось активировать подарок. Напиши в поддержку.")
                    return
            except Exception as e:
                print(f"⚠️ /api/gift/activate error: {e}")
                await msg.answer("⚠️ Ошибка связи с сервером при активации подарка. Напиши в поддержку.")
                return
            await msg.answer("🎁 Подарок оплачен и активирован! Отправь ссылку другу в Mini App — курс откроется у него при входе.")
            return

        # 1) выдать доступ (идемпотентно на стороне бэкенда по course_id+user)
        r = await c.post(f"{config.BACKEND_URL}/api/grant", json={
            "user_id": msg.from_user.id,
            "course_id": course_id,
            "provider": "stars",
            "charge_id": charge_id,
        }, headers=headers)
        if r.status_code != 200:
            # не удалось выдать доступ — логируем, но продолжаем (реф/скидка не зависят)
            print(f"⚠️ /api/grant failed: {r.status_code} {r.text}")

        # 2) реферальный бонус инвайтеру (+500 ⭐, идемпотентно на 1 покупку)
        #    + уведомление инвайтера, что друг купил (закрываем петлю рефералки).
        try:
            rp = await c.post(f"{config.BACKEND_URL}/api/referral/purchase", json={
                "user_id": msg.from_user.id,
            }, headers=headers)
            if rp.status_code == 200:
                rd = rp.json()
                inv_id = rd.get("inviter_id")
                if inv_id:
                    try:
                        await c.post(
                            f"https://api.telegram.org/bot{config.BOT_TOKEN}/sendMessage",
                            json={
                                "chat_id": inv_id,
                                "text": "🎉 Твой друг купил курс Open Deck!\nНа твой баланс начислено +500 GP.",
                                "disable_notification": False,
                            },
                        )
                    except Exception:
                        pass
        except Exception:
            pass  # не критично

        # 3) LTV по A/B-варианту (для аналитики цен)
        if course_id in ("tripwire", "dj-basics", "mentoring"):
            try:
                await c.post(f"{config.BACKEND_URL}/api/ab/track", json={
                    "user_id": msg.from_user.id,
                    "course_id": course_id,
                }, headers=headers)
            except Exception:
                pass

        # 4) если куплено менторство — списать GP-скидку (1 GP = 1 Star).
        #    Цена инвойса уже была снижена на GP на сервере при /api/create-invoice,
        #    здесь фиксируем само списание GP в балансе (идемпотентно по charge_id).
        if course_id == "mentoring":
            try:
                await c.post(f"{config.BACKEND_URL}/api/gp/apply", json={
                    "user_id": msg.from_user.id,
                    "charge_id": f"mentor:{charge_id}",
                }, headers=headers)
            except Exception:
                pass

    await msg.answer("✅ Оплата прошла! Открывай курс в Mini App и смотри уроки.")


async def on_inline(query: InlineQuery):
    """Обработчик inline-режима: пересылает приглашение (экранируем HTML против фишинга)."""
    import html
    raw_text = (query.query or "").strip()
    if not raw_text or len(raw_text) > 500:
        return
    safe_text = html.escape(raw_text)
    await query.answer(
        results=[
            InlineQueryResultArticle(
                id="1",
                title="🎧 Позвать в команду Open Deck",
                description=raw_text.split("\n", 1)[0][:120] if "\n" in raw_text else raw_text[:120],
                input_message_content=InputTextMessageContent(
                    message_text=safe_text,
                ),
            )
        ],
        cache_time=0,
    )


async def on_web_app_data(msg: Message):
    """Получает данные из tg.sendData() — отправляет приглашение с Mini App карточкой."""
    import json, html
    if not msg.web_app_data:
        return
    try:
        data = json.loads(msg.web_app_data.data)
    except Exception:
        return
    if data.get("action") != "invite":
        return
    code = "".join(ch for ch in str(data.get("code", "")) if ch.isalnum())[:16]
    archetype = html.escape(str(data.get("archetype", "Куратор Вайба"))[:64])
    if not code:
        return
    bot_info = await msg.bot.get_me()
    bot_username = bot_info.username or "OpenDeck_bot"
    deep_link = f"https://t.me/{bot_username}/app?startapp=ref_{code}"
    text = f"{deep_link}\n\n🎧 Мой музыкальный архетип — {archetype}. Залетай в Open Deck, забирай 100 Groove Points на старт и узнай свой вайб!"
    await msg.answer(text)


async def main():
    if not config.BOT_TOKEN:
        raise SystemExit("❌ BOT_TOKEN не задан. Экспортируйте переменную или впишите в bot/config.py")
    if not config.INTERNAL_API_KEY:
        raise SystemExit("❌ INTERNAL_API_KEY не задан. Бот не сможет подтверждать оплаты в бэкенде.")
    bot = Bot(token=config.BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = Dispatcher()
    dp.message.register(cmd_start, CommandStart())
    dp.pre_checkout_query.register(on_pre_checkout)
    dp.message.register(on_paid, F.successful_payment)
    dp.inline_query.register(on_inline)
    dp.message.register(on_web_app_data, F.web_app_data)
    print("🤖 Бот запущен. /start в Telegram.")
    await dp.start_polling(bot)


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
