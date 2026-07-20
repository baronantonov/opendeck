"""Прогон MVP: бэкенд + доступ + init_data + webhook Prodamus.
Запуск:  python tests/test_backend.py   (из корня проекта)
"""
import os, sys, hashlib, hmac, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app
from backend.auth import verify_init_data, _build_valid_init_data

TOKEN = "TEST_BOT_TOKEN"
os.environ["BOT_TOKEN"] = TOKEN
os.environ["PRODAMUS_WEBHOOK_SECRET"] = "TEST_PRODAMUS_SECRET"

client = TestClient(app)
passed = failed = 0
def check(name, cond):
    global passed, failed
    if cond: print(f"  PASS  {name}"); passed += 1
    else:   print(f"  FAIL  {name}"); failed += 1

print("== Health ==")
check("GET /api/health", client.get("/api/health").json().get("ok") is True)

print("== Mini App отдаётся ==")
html = client.get("/").text
check("GET / содержит 'Школа DJing'", "Школа DJing" in html)
check("GET / подключает telegram-web-app.js", "telegram-web-app.js" in html)

print("== Доступ до оплаты ==")
uid = 777
init = _build_valid_init_data(TOKEN, uid)
r = client.get("/api/lessons?course_id=dj-basics", headers={"X-Init-Data": init})
check("уроки скрыты ДО оплаты (access_denied)", r.json().get("paid") is False)

print("== Плохой init_data отклоняется ==")
r = client.get("/api/lessons?course_id=dj-basics", headers={"X-Init-Data": "hash=zzz&user=%7B%22id%22:1%7D"})
check("поддельный init_data -> bad_init_data", r.json().get("error") == "bad_init_data")

print("== Выдача доступа (Stars successful_payment) ==")
r = client.post("/api/grant", json={"user_id": uid, "course_id": "dj-basics", "provider": "stars"})
check("grant вернул ok", r.json().get("ok") is True)

print("== Доступ после оплаты ==")
r = client.get("/api/lessons?course_id=dj-basics", headers={"X-Init-Data": init})
j = r.json()
check("уроки доступны ПОСЛЕ оплаты (paid=true)", j.get("paid") is True)
check("вернулось 3 урока", len(j.get("lessons", [])) == 3)

print("== Webhook Prodamus (HMAC) ==")
body = json.dumps({"status": "paid", "order_id": f"{uid}:dj-basics"}).encode()
sig = hmac.new(b"TEST_PRODAMUS_SECRET", body, hashlib.sha256).hexdigest()
r = client.post("/webhooks/prodamus", content=body, headers={"x-signature": sig})
check("валидный webhook принят", r.status_code == 200)
r = client.post("/webhooks/prodamus", content=body, headers={"x-signature": "bad"})
check("поддельный webhook отклонён (400)", r.status_code == 400)

print("== init_data verify (прямой) ==")
check("валидный init_data верифицируется", verify_init_data(init, TOKEN) is not None)
check("чужой токен не проходит", verify_init_data(init, "OTHER") is None)

print(f"\nИтог: {passed} PASS / {failed} FAIL")
sys.exit(1 if failed else 0)
