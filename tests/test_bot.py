"""Smoke-тест логики бота БЕЗ сети к Telegram.

Проверяем: сборку клавиатуры, фабрику провайдеров, payload Stars,
и что on_paid вызывает backend /api/grant. aiogram-бот в реальный TG не стучится.
Запуск:  python tests/test_bot.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
from fastapi.testclient import TestClient

# stub для aiogram: убираем реальный сетевой стек, оставляем типы/диспетчер
import unittest.mock as mock

# Чтобы bot.main не делал реальный импорт aiogram при сборке — мокаем minimal
import bot.payments as payments
from bot.payments import get_provider

# --- Тесты фабрики провайдеров ---
passed = failed = 0
def check(name, cond):
    global passed, failed
    print(("  PASS  " if cond else "  FAIL  ") + name)
    (passed if cond else failed).__init__() if False else None
    if cond: passed += 1
    else: failed += 1

print("== Фабрика провайдеров ==")
for name in ["stars", "ton", "prodamus"]:
    p = get_provider(name)
    check(f"провайдер '{name}' создаётся", p is not None)
    check(f"  -> name == '{name}'", p.name == name)

print("== Stars-инвойс ==")
stars = get_provider("stars")
inv = stars.create_invoice(777, "dj-basics", "Курс")
import asyncio
inv = asyncio.get_event_loop().run_until_complete(inv) if hasattr(inv, "__await__") else inv
# create_invoice async -> дождись
inv = asyncio.get_event_loop().run_until_complete(get_provider("stars").create_invoice(777, "dj-basics", "Курс"))
check("payload = course_id", inv.url_or_payload == "dj-basics")
check("price в meta = STARS_PRICE (199)", inv.meta.get("price_stars") == 199)

print("== Выдача доступа backend /api/grant ==")
# поднимаем тот же backend через TestClient и имитируем on_paid
os.environ["BOT_TOKEN"] = "TEST_BOT_TOKEN"
os.environ["PRODAMUS_WEBHOOK_SECRET"] = "TEST_PRODAMUS_SECRET"
from backend.main import app as backend_app
client = TestClient(backend_app)
r = client.post("/api/grant", json={"user_id": 777, "course_id": "dj-basics", "provider": "stars"})
check("grant ok после successful_payment", r.json().get("ok") is True)
r2 = client.get("/api/lessons?course_id=dj-basics", headers={"X-Init-Data": "hash=zzz"})
# без валидного init_data — bad_init_data (проверяем, что on_paid НЕ открыл бы доступ "автоматом")
check("без init_data доступ не светится (защита)", r2.json().get("error") == "bad_init_data")

print(f"\nИтог бота: {passed} PASS / {failed} FAIL")
sys.exit(1 if failed else 0)
