"""Прогон MVP: бэкенд + доступ + init_data + webhook Prodamus.
Запуск:  python tests/test_backend.py   (из корня проекта)
"""
import os, sys, hashlib, hmac, json, time, urllib.parse, tempfile
from pathlib import Path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Переменные окружения ДО импорта backend.main (иначе упадёт SystemExit на проверках секретов)
TOKEN = "TEST_BOT_TOKEN"
os.environ["BOT_TOKEN"] = TOKEN
os.environ["PRODAMUS_WEBHOOK_SECRET"] = "TEST_PRODAMUS_SECRET"
# backend /webhooks/prodamus читает именно PRODAMUS_SECRET_KEY
os.environ["PRODAMUS_SECRET_KEY"] = "TEST_PRODAMUS_SECRET"
os.environ["INTERNAL_API_KEY"] = "TEST_INTERNAL_KEY"

# SQLite на tempfile — каждый прогон изолирован
import backend.db as db
_db_path_orig = db.DB_PATH
_tmp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp_db.close()
db.DB_PATH = Path(_tmp_db.name)

from fastapi.testclient import TestClient
from backend.main import app
from backend.auth import verify_init_data
import backend.prodamus_sign as prodamus_sign

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
check("вернулось 6 уроков (PLAY-remap основного курса)", len(j.get("lessons", [])) == 6)

print("== Webhook Prodamus (HMAC) ==")
# Prodamus шлёт form-data (application/x-www-form-urlencoded) + заголовок `Sign`.
# Подпись = алгоритм prodamus_sign: все поля (кроме signature/Sign), сортировка
# ключей, json(ensure_ascii=False, separators), '/' -> '\/', HMAC-SHA256 секретом.
webhook_secret = os.environ["PRODAMUS_WEBHOOK_SECRET"]
webhook_form = {"status": "paid", "order_id": f"{uid}:dj-basics"}
webhook_body = urllib.parse.urlencode(webhook_form).encode()
webhook_sig = prodamus_sign.sign_params(webhook_form, webhook_secret)
r = client.post("/webhooks/prodamus", content=webhook_body, headers={"Sign": webhook_sig})
check("валидный webhook принят", r.status_code == 200)
r = client.post("/webhooks/prodamus", content=webhook_body, headers={"Sign": "bad"})
check("поддельный webhook отклонён (400)", r.status_code == 400)

print("== init_data verify (прямой) ==")
check("валидный init_data верифицируется", verify_init_data(init, TOKEN) is not None)
check("чужой токен не проходит", verify_init_data(init, "OTHER") is None)
# устаревший auth_date (>24ч) отклоняется
old = make_init_data(TOKEN, uid, age=100000)
check("устаревший init_data (>24ч) -> None", verify_init_data(old, TOKEN) is None)

print("== Идемпотентность GP-списания и реф-бонуса (защита от фрода) ==")
# создадим 2 пользователей, свяжем реф-ссылкой
inv_uid = 910000 + int(time.time()) % 100000
inv_init = make_init_data(TOKEN, inv_uid)
inv_code = client.post("/api/init", json={"init_data": inv_init, "start_param": None}).json()["user"]["referral_code"]
fr_uid = 920000 + int(time.time()) % 100000
fr_init = make_init_data(TOKEN, fr_uid)
client.post("/api/init", json={"init_data": fr_init, "start_param": f"ref_{inv_code}"})
# дадим invitee GP напрямую через прогресс урока
client.post("/api/progress", json={"course_id": "dj-basics", "lesson_id": 1},
            headers={"X-Init-Data": fr_init})
# реф-бонус инвайтеру: вызываем дважды — должен начислиться +200 только один раз
client.get("/api/profile", headers={"X-Init-Data": inv_init})  # upsert
r1 = client.post("/api/referral/purchase", json={"user_id": fr_uid},
                 headers={"Authorization": "Bearer TEST_INTERNAL_KEY"})
r2 = client.post("/api/referral/purchase", json={"user_id": fr_uid},
                 headers={"Authorization": "Bearer TEST_INTERNAL_KEY"})
gp_after = db.get_gp(inv_uid)
# инвайтер: +100 за signup invitee (SIGNUP_INVITER) + ровно +500 за purchase
# (PURCHASE_BONUS, двойной вызов не накручивает — идемпотентно по invitee)
check("реф-бонус инвайтеру = +100 (signup) +500 (purchase), двойной вызов не накручивает",
      gp_after == 600)

# менторство: списание GP идемпотентно по charge_id
client.post("/api/progress", json={"course_id": "dj-basics", "lesson_id": 2},
            headers={"X-Init-Data": fr_init})  # ещё GP invitee
before = db.get_gp(fr_uid)
c_id = "mentor:charge_xyz"
a1 = client.post("/api/gp/apply",
                 json={"user_id": fr_uid, "charge_id": c_id},
                 headers={"Authorization": "Bearer TEST_INTERNAL_KEY"}).json()
a2 = client.post("/api/gp/apply",
                 json={"user_id": fr_uid, "charge_id": c_id},
                 headers={"Authorization": "Bearer TEST_INTERNAL_KEY"}).json()
after = db.get_gp(fr_uid)
# второй вызов — duplicate, GP не сгорели повторно
check("двойной gp/apply по тому же charge_id НЕ списывает повторно",
      a2.get("duplicate") is True and after == before - a1.get("discount", 0))

if __name__ == "__main__":
    print(f"\nИтог: {passed} PASS / {failed} FAIL")
    # Удалить tempfile
    os.unlink(_tmp_db.name)
    sys.exit(1 if failed else 0)
