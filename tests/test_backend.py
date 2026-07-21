"""Прогон MVP: бэкенд + доступ + init_data + webhook Prodamus.
Запуск:  python tests/test_backend.py   (из корня проекта)
"""
import os, sys, hashlib, hmac, json, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Переменные окружения ДО импорта backend.main (иначе упадёт SystemExit на проверках секретов)
TOKEN = "TEST_BOT_TOKEN"
os.environ["BOT_TOKEN"] = TOKEN
os.environ["PRODAMUS_WEBHOOK_SECRET"] = "TEST_PRODAMUS_SECRET"
os.environ["INTERNAL_API_KEY"] = "TEST_INTERNAL_KEY"

from fastapi.testclient import TestClient
from backend.main import app
from backend.auth import verify_init_data

# --- Локальный генератор валидного init_data (бывшая _build_valid_init_data из auth.py) ---
def make_init_data(token, user_id, age=60):
    data = {
        "auth_date": str(int(time.time()) - age),
        "query_id": "test_query",
        "user": f'{{"id":{user_id},"first_name":"Tester"}}',
    }
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    data["hash"] = h
    return urllib.parse.urlencode(data)

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
check("GET / содержит 'Open Deck DJ School'", "Open Deck DJ School" in html)
check("GET / подключает telegram-web-app.js", "telegram-web-app.js" in html)

print("== Доступ до оплаты ==")
# случайный uid каждый прогон — тесты не изолированы (общая БД), иначе повторный запуск
# видит уже оплаченного юзера и падает на "доступ ДО оплаты"
uid = 900000 + int(time.time()) % 100000
init = make_init_data(TOKEN, uid)
r = client.get("/api/lessons?course_id=dj-basics", headers={"X-Init-Data": init})
check("уроки скрыты ДО оплаты (paid=false)", r.json().get("paid") is False)

print("== Плохой init_data отклоняется ==")
r = client.get("/api/lessons?course_id=dj-basics", headers={"X-Init-Data": "hash=zzz&user=%7B%22id%22:1%7D"})
check("поддельный init_data -> bad_init_data", r.json().get("error") == "bad_init_data")

print("== /api/grant требует авторизацию ==")
r = client.post("/api/grant", json={"user_id": uid, "course_id": "dj-basics", "provider": "stars"})
check("grant БЕЗ токена -> 403", r.status_code == 403)
r = client.post("/api/grant", json={"user_id": uid, "course_id": "dj-basics", "provider": "stars"},
                headers={"Authorization": "Bearer TEST_INTERNAL_KEY"})
check("grant С токеном -> ok", r.json().get("ok") is True)

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
# устаревший auth_date (>5 мин) отклоняется
old = make_init_data(TOKEN, uid, age=1000)
check("устаревший init_data (>5 мин) -> None", verify_init_data(old, TOKEN) is None)

print(f"\nИтог: {passed} PASS / {failed} FAIL")
sys.exit(1 if failed else 0)
