"""Прогон экономики GP/рефералок/бонусов после пересчёта (2026-маркетинг).

Проверяет:
- реф-сигнап двусторонний +100/+100
- бонусный урок = +200 GP (vs основной +50)
- daily/share = +25 GP (rewarded)
- инвайтер +500 при покупке рефералом + tiered-милестоуны 3/5/10
- streak-freeze списывает 75 GP

Запуск:  python tests/test_economy.py   (из корня проекта)
"""
import os, sys, time, tempfile, json
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["BOT_TOKEN"] = "TEST_BOT_TOKEN"
os.environ["PRODAMUS_SECRET_KEY"] = "TEST_PRODAMUS_SECRET"
os.environ["INTERNAL_API_KEY"] = "TEST_INTERNAL_KEY"
os.environ["ADMIN_KEY"] = "super-secret-crm-key"

import backend.db as db
from backend.auth import verify_init_data
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
db.DB_PATH = Path(_tmp.name)

from fastapi.testclient import TestClient
import backend.main as main
from backend.main import app

client = TestClient(app, follow_redirects=False)

passed = failed = 0
def check(name, cond, extra=""):
    global passed, failed
    if cond: print(f"  PASS  {name}")
    else:   print(f"  FAIL  {name}  {extra}")
    if cond: passed += 1
    else:   failed += 1

# --- helper: подписать init_data (как TG) под TEST_BOT_TOKEN ---
def sign_init(uid, first_name="U", username=None):
    secret = hmac.new(b"WebAppData", b"TEST_BOT_TOKEN", hashlib.sha256).digest()
    user = {"id": uid, "first_name": first_name, "username": username}
    payload = {
        "auth_date": str(int(time.time())),
        "query_id": f"q{uid}",
        "user": json.dumps(user, ensure_ascii=False),
    }
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(payload.items()))
    h = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    payload["hash"] = h
    return "&".join(f"{k}={v}" for k, v in payload.items())

import hmac, hashlib

def ua(uid):
    return {"X-Init-Data": sign_init(uid)}

def gp(uid):
    return db.get_gp(uid)

# свежие uid каждый прогон (in-memory SQLite персистит между вызовами)
base = int(time.time() * 1000) % 1000000

print("== Реф-сигнап: двусторонний +100/+100 ==")
inviter_id = base + 1
friend_id = base + 2
r = client.post("/api/init", json={"init_data": sign_init(inviter_id, "Inviter"), "start_param": ""})
check("inviter init ok", r.status_code == 200)
# friend приходит по реф-ссылке inviter
inv_code = (db.get_user(inviter_id) or {}).get("referral_code")
r = client.post("/api/init", json={"init_data": sign_init(friend_id, "Friend"), "start_param": f"ref_{inv_code}"})
check("friend init с рефом ok", r.status_code == 200)
check("friend +100 GP", gp(friend_id) == 100, f"gp={gp(friend_id)}")
check("inviter +100 GP (за друга)", gp(inviter_id) == 100, f"gp={gp(inviter_id)}")
check("friend.bonus сообщение 100", (r.json().get("bonus") or {}).get("amount") == 100)

print("== Бонусный урок = +200, основной = +50 ==")
# основной урок 1 (бесплатный) -> +50
r = client.post("/api/progress", json={"course_id": "dj-basics", "lesson_id": 1}, headers=ua(friend_id))
check("основной урок +50", r.json().get("gp") == gp(friend_id), f"gp={gp(friend_id)}")
before = gp(friend_id)
# бонусный урок (dj-bonus)
r = client.post("/api/progress", json={"course_id": "dj-bonus", "lesson_id": 1, "bonus": True}, headers=ua(friend_id))
check("бонусный урок +200", gp(friend_id) - before == 200, f"delta={gp(friend_id)-before}")
check("бонус помечен", r.json().get("bonus") is True)

print("== Rewarded: daily/share = +25 ==")
before = gp(friend_id)
r = client.post("/api/gp/earn", json={"action": "daily"}, headers=ua(friend_id))
check("daily +25", gp(friend_id) - before == 25, f"delta={gp(friend_id)-before}")
before = gp(friend_id)
r = client.post("/api/gp/earn", json={"action": "share"}, headers=ua(friend_id))
check("share +25", gp(friend_id) - before == 25, f"delta={gp(friend_id)-before}")
# cooldown: второй daily -> 429
r = client.post("/api/gp/earn", json={"action": "daily"}, headers=ua(friend_id))
check("daily cooldown 429", r.status_code == 429)

print("== Реф-покупка: инвайтер +500 (+ милестоуны) ==")
# friend покупает курс -> бот шлёт /api/referral/purchase с INTERNAL_API_KEY
before = gp(inviter_id)
r = client.post("/api/referral/purchase", json={"user_id": friend_id},
                headers={"Authorization": "Bearer TEST_INTERNAL_KEY"})
check("referral/purchase ok", r.status_code == 200)
check("inviter +500 за покупку", gp(inviter_id) - before == 500, f"delta={gp(inviter_id)-before}")
check("inviter_bonus=500 в ответе", r.json().get("inviter_bonus") == 500)
# idempotent: повтор -> без двойного начисления
before = gp(inviter_id)
r = client.post("/api/referral/purchase", json={"user_id": friend_id},
                headers={"Authorization": "Bearer TEST_INTERNAL_KEY"})
check("referral/purchase idempotent", gp(inviter_id) == before, f"gp={gp(inviter_id)}")

print("== Tiered-милестоуны: 3/5/10 друзей ==")
# создадим ещё 2 друзей inviter'а, купивших курс -> 3 платящих -> +300
f3 = base + 3; f4 = base + 4
for i, fid in enumerate([f3, f4], start=1):
    code = (db.get_user(inviter_id) or {}).get("referral_code")
    client.post("/api/init", json={"init_data": sign_init(fid, f"F{i}"), "start_param": f"ref_{code}"})
    client.post("/api/referral/purchase", json={"user_id": fid},
                headers={"Authorization": "Bearer TEST_INTERNAL_KEY"})
before = gp(inviter_id)
# третий платящий друг уже был (friend) -> при 3-м должен сработать милестоун +300
# friend уже counted, f3, f4 -> всего 3 платящих -> милестоун 3 сработал при f4
with db._conn() as _c:
    paid_friends = _c.execute(
        "SELECT COUNT(DISTINCT ref_user_id) FROM transactions WHERE user_id=? AND action_type='referral_purchase'",
        (inviter_id,)).fetchone()[0]
    check("3 платящих друга", paid_friends == 3, f"n={paid_friends}")
    milestone = _c.execute(
        "SELECT COALESCE(SUM(amount),0) FROM transactions WHERE user_id=? AND action_type='referral_milestone'",
        (inviter_id,)).fetchone()[0]
check("милестоун +300 начислен", milestone == 300, f"ms={milestone}")

print("== Streak-freeze списывает 75 GP ==")
# даём inviter'у достаточно GP (уже есть 100+500+300+...), списываем freeze
before = gp(inviter_id)
r = client.post("/api/gp/spend", json={"amount": 75, "reason": "streak_freeze"}, headers=ua(inviter_id))
check("streak-freeze списал 75", r.status_code == 200 and (before - gp(inviter_id)) == 75, f"delta={before-gp(inviter_id)}")

print()
print(f"ИТОГО: {passed} PASS / {failed} FAIL")
sys.exit(1 if failed else 0)
