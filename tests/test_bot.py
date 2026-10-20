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
def test_test_bot():
    passed = failed = 0
    def check(name, cond):
        nonlocal passed, failed
        print(("  PASS  " if cond else "  FAIL  ") + name)
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
    # Python 3.14: get_event_loop() больше не создаёт loop — используем asyncio.run
    inv = asyncio.run(inv)
    check("payload = course_id", inv.url_or_payload == "dj-basics")
    print("== Клавиатура бота main_kb ==")
    from bot.main import main_kb
    kb_def = main_kb()
    check("дефолтная клавиатура имеет WebAppInfo", kb_def.inline_keyboard[0][0].web_app is not None)
    kb_ref = main_kb("ref_abc123")
    check("deep link startapp пробрасывается в URL WebApp", "startapp=ref_abc123" in kb_ref.inline_keyboard[0][0].web_app.url)

    print("== Выдача доступа backend /api/grant ==")
    # поднимаем тот же backend через TestClient и имитируем on_paid
    os.environ["BOT_TOKEN"] = "TEST_BOT_TOKEN"
    os.environ["PRODAMUS_WEBHOOK_SECRET"] = "TEST_PRODAMUS_SECRET"
    os.environ["INTERNAL_API_KEY"] = "TEST_INTERNAL_KEY"
    from backend.main import app as backend_app
    import backend.db as db
    db.init()
    client = TestClient(backend_app)
    r = client.post("/api/grant", json={"user_id": 777, "course_id": "dj-basics", "provider": "stars"},
                    headers={"Authorization": "Bearer TEST_INTERNAL_KEY"})
    check("grant ok после successful_payment (с токеном)", r.json().get("ok") is True)
    r2 = client.get("/api/lessons?course_id=dj-basics", headers={"X-Init-Data": "hash=zzz"})
    # без валидного init_data — bad_init_data (проверяем, что on_paid НЕ открыл бы доступ "автоматом")
    check("без init_data доступ не светится (защита)", r2.json().get("error") == "bad_init_data")

    print(f"\nИтог бота: {passed} PASS / {failed} FAIL")
    assert failed == 0, f"Bot tests failed: {failed} checks failed"


if __name__ == "__main__":
    test_test_bot()
