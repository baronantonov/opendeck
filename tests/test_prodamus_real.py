"""Тест реальной интеграции Prodamus (по мануалу payform.ru).

Проверяет:
1. sign_params() формирует подпись как в мануале (алгоритм Hmac::verify).
2. verify_webhook() валидирует form-data + заголовок Sign.
3. Webhook с валидной подписью выдаёт доступ (add_payment + идемпотентность).

Запуск:
  cd /home/brnv/projects/dj-school-tma
  python3 -m pytest tests/test_prodamus_real.py -q
  # или:  python3 tests/test_prodamus_real.py
"""
from __future__ import annotations
import sys, os, json
from pathlib import Path

# путь к проекту
PROJECT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT))

# фиктивные переменные окружения для теста (НЕ боевые)
os.environ.setdefault("PRODAMUS_SECRET_KEY", "TEST_SECRET_123")
os.environ.setdefault("PRODAMUS_PAYFORM_URL", "https://demo.payform.ru/")
os.environ.setdefault("PRODAMUS_SYS_CODE", "opendeck")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")

from backend.prodamus_sign import sign_params, verify_webhook


def test_sign_and_verify_roundtrip():
    """Подпись сформирована -> webhook с этой подписью проходит проверку."""
    params = {
        "do": "link",
        "sys": "opendeck",
        "order_id": "123:dj-basics",
        "currency": "rub",
        "products": [{"name": "Курс", "price": 1990, "quantity": 1, "type": "course"}],
    }
    sig = sign_params(params, "TEST_SECRET_123")
    # Prodamus пришлёт те же поля (без signature) + заголовок Sign=sig
    form = {k: v for k, v in params.items() if k != "signature"}
    assert verify_webhook(form, "TEST_SECRET_123", sig) is True
    # неверный секрет/подпись -> провал
    assert verify_webhook(form, "WRONG_SECRET", sig) is False
    assert verify_webhook(form, "TEST_SECRET_123", "deadbeef") is False
    print("✅ sign/verify roundtrip OK")


def test_verify_rejects_tampered_form():
    params = {"order_id": "123:dj-basics", "status": "paid", "amount": "1990"}
    sig = sign_params(params, "TEST_SECRET_123")
    tampered = dict(params)
    tampered["amount"] = "1"  # кто-то подменил сумму
    assert verify_webhook(tampered, "TEST_SECRET_123", sig) is False
    print("✅ tamper detection OK")


def test_webhook_endpoint_grants_access():
    """Полный цикл: POST /webhooks/prodamus с валидной подписью -> доступ выдан."""
    import asyncio
    from fastapi.testclient import TestClient
    import backend.db as db
    import backend.main as main_mod

    db.init()
    # тестовый юзер + заказ
    uid, course = 999001, "dj-basics"
    db.upsert_user(uid, first_name="Tester")
    order_id = f"{uid}:{course}"

    form = {
        "order_id": order_id,
        "status": "paid",
        "amount": "1990",
        "currency": "rub",
        "sys": "opendeck",
    }
    sig = sign_params(form, "TEST_SECRET_123")

    client = TestClient(main_mod.app)
    # передаём form-data как обычные поля + заголовок Sign
    resp = client.post(
        "/webhooks/prodamus",
        data=form,
        headers={"Sign": sig},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json().get("ok") is True
    assert db.has_paid(uid, course) is True, "доступ не выдан!"
    print("✅ webhook выдал доступ (paid)")

    # идемпотентность: повторный вызов не падает и не дублирует
    resp2 = client.post("/webhooks/prodamus", data=form, headers={"Sign": sig})
    assert resp2.status_code == 200
    assert resp2.json().get("duplicate") is True
    print("✅ идемпотентность webhook OK")

    # плохая подпись -> 400
    resp3 = client.post("/webhooks/prodamus", data=form, headers={"Sign": "bad"})
    assert resp3.status_code == 400
    print("✅ плохая подпись отклонена (400)")


if __name__ == "__main__":
    test_sign_and_verify_roundtrip()
    test_verify_rejects_tampered_form()
    test_webhook_endpoint_grants_access()
    print("\n🎉 ВСЕ ТЕСТЫ ПРОЙДЕНЫ")
