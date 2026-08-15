"""Прогон CRM-админки: логин, защита, список, фильтры, профиль.
Запуск:  python tests/test_crm.py   (из корня проекта)
"""
import os, sys, time, tempfile
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Переменные окружения ДО импорта backend (main проверяет секреты при старте)
os.environ["BOT_TOKEN"] = "TEST_BOT_TOKEN"
os.environ["PRODAMUS_SECRET_KEY"] = "TEST_PRODAMUS_SECRET"
os.environ["INTERNAL_API_KEY"] = "TEST_INTERNAL_KEY"
os.environ["ADMIN_KEY"] = "super-secret-crm-key"

# изолированная БД ДО импорта backend.main (иначе db.init() создаст таблицы
# в дефолтной БД, а тест будет работать с пустой temp-БД -> no such table)
import backend.db as db
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
db.DB_PATH = Path(_tmp.name)
db.init()

# БД также изолируется централизованно в tests/conftest.py (temp + db.init до импорта)

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app, follow_redirects=False)

def test_crm():
    passed = failed = 0
    def check(name, cond):
        nonlocal passed, failed
        if cond: print(f"  PASS  {name}"); passed += 1
        else:   print(f"  FAIL  {name}"); failed += 1

    print("== CRM: защита ==")
    # без логина — 401
    r = client.get("/api/crm/stats")
    check("stats без cookie -> 401", r.status_code == 401)
    r = client.get("/api/crm/students")
    check("students без cookie -> 401", r.status_code == 401)
    r = client.get("/crm")
    check("страница /crm отдаётся без логина (shell)", r.status_code == 200 and "Open Deck" in r.text)

    print("== CRM: логин ==")
    r = client.post("/crm/login", json={"key": "wrong"})
    check("плохой пароль -> 401", r.status_code == 401)
    # правильный пароль — cookie в ответе
    r = client.post("/crm/login", json={"key": "super-secret-crm-key"})
    check("верный пароль -> ok", r.status_code == 200 and r.json().get("ok") is True)
    check("cookie crm_session выставлен", "crm_session" in r.cookies)

    # сессия-клиент с cookie
    session = TestClient(app)
    session.cookies.set("crm_session", r.cookies["crm_session"])

    print("== CRM: статистика на пустой БД ==")
    r = session.get("/api/crm/stats")
    check("stats -> ok", r.status_code == 200)
    j = r.json()
    check("total_users == 0 на пустой БД", j["total_users"] == 0)
    check("paid_any == 0", j["paid_any"] == 0)

    print("== CRM: наполнение данными ==")
    # создадим учеников через /api/init + платежи через /api/grant
    from backend.auth import verify_init_data
    import hashlib, hmac, json, urllib.parse
    def make_init(uid, first="DJ", user=""):
        data = {"auth_date": str(int(time.time())-10), "query_id":"q",
                "user": json.dumps({"id": uid, "first_name": first, "username": user})}
        dc = "\n".join(f"{k}={v}" for k,v in sorted(data.items()))
        secret = hmac.new(b"WebAppData", b"TEST_BOT_TOKEN", hashlib.sha256).digest()
        data["hash"] = hmac.new(secret, dc.encode(), hashlib.sha256).hexdigest()
        return urllib.parse.urlencode(data)

    u1 = 700001; init1 = make_init(u1, "Алиса", "alice")
    client.post("/api/init", json={"init_data": init1})
    # u1 платит полный курс
    client.post("/api/grant", json={"user_id": u1, "course_id":"dj-basics","provider":"stars"},
                headers={"Authorization":"Bearer TEST_INTERNAL_KEY"})
    # u1 проходит уроки
    client.post("/api/progress", json={"course_id":"dj-basics","lesson_id":1}, headers={"X-Init-Data":init1})
    client.post("/api/progress", json={"course_id":"dj-basics","lesson_id":2}, headers={"X-Init-Data":init1})

    u2 = 700002; init2 = make_init(u2, "Боб", "bob")
    client.post("/api/init", json={"init_data": init2})
    # Боб приглашён Алисой
    alice_code = db.get_user(u1)["referral_code"]
    client.post("/api/init", json={"init_data": make_init(700003,"Кэрол","carol"), "start_param": f"ref_{alice_code}"})

    # VIP: менторство
    u3 = 700004; init3 = make_init(u3, "Диана", "diana")
    client.post("/api/init", json={"init_data": init3})
    client.post("/api/grant", json={"user_id": u3, "course_id":"mentoring","provider":"stars"},
                headers={"Authorization":"Bearer TEST_INTERNAL_KEY"})

    print("== CRM: список + фильтры ==")
    r = session.get("/api/crm/students")
    check("students -> 200", r.status_code == 200)
    j = r.json()
    check("всего >= 4 ученика", j["total"] >= 4)
    ids = {s["user_id"] for s in j["students"]}
    check("присутствует Алиса", u1 in ids)

    # фильтр paid
    r = session.get("/api/crm/students", params={"status":"paid"})
    j = r.json()
    check("фильтр paid: только платные", all(s["status"] in ("paid","vip") for s in j["students"]) and j["total"]>=1)

    # фильтр vip
    r = session.get("/api/crm/students", params={"status":"vip"})
    j = r.json()
    check("фильтр vip: только Диана", j["total"]>=1 and all(s["status"]=="vip" for s in j["students"]))

    # поиск по имени
    r = session.get("/api/crm/students", params={"q":"Алиса"})
    j = r.json()
    check("поиск 'Алиса' находит 1", j["total"]==1 and j["students"][0]["user_id"]==u1)

    # сортировка по GP desc
    r = session.get("/api/crm/students", params={"sort":"gp","order":"desc"})
    j = r.json()
    gps = [s["groove_points"] for s in j["students"]]
    check("сортировка gp desc монотонна", all(gps[i] >= gps[i+1] for i in range(len(gps)-1)))

    print("== CRM: профиль ученика ==")
    r = session.get(f"/api/crm/student/{u1}")
    check("профиль Алисы -> 200", r.status_code == 200)
    s = r.json()
    check("профиль содержит payments", isinstance(s["payments"], list) and len(s["payments"])>=1)
    check("профиль: paid_full=True", s["paid_full"] is True)
    check("профиль: referrals Кэрол (1)", s["referrals_count"]>=1)
    check("профиль: уроки пройдены (>=2)", (s["lessons"] and sum(1 for l in s["lessons"] if l["completed"])>=2))
    check("профиль: есть транзакции GP", isinstance(s["transactions"], list) and len(s["transactions"])>=1)

    # несуществующий
    r = session.get("/api/crm/student/999999")
    check("профиль несуществующего -> 404", r.status_code == 404)

    print("== CRM: Prodamus-webhook -> отражается в CRM ==")
    # связь: webhook Prodamus должен записаться в payments и поднять paid_full в CRM
    import backend.prodamus_sign as ps
    order_pro = f"{u1}:dj-basics"
    form_pro = {"order_id": order_pro, "status": "paid", "amount": "3570",
                "currency": "rub", "payment_id": "PD-CRM-1", "email": "alice@x.ru"}
    # подпись заголовка Sign = тот же алгоритм, что ждёт main.py (verify_webhook)
    clean = {k: v for k, v in form_pro.items() if k not in ("signature", "Sign")}
    sign_hdr = ps._compute_signature(clean, "TEST_PRODAMUS_SECRET")
    r = client.post("/webhooks/prodamus", data=form_pro, headers={"Sign": sign_hdr})
    check("Prodamus webhook валидный Sign -> 200", r.status_code == 200 and r.json().get("ok") is True)
    stu_pro = db.crm_get_student(u1)
    provs = [p["provider"] for p in stu_pro["payments"]]
    check("в CRM платёж provider=prodamus есть", "prodamus" in provs)
    check("paid_full остаётся True (prodamus + stars)", stu_pro["paid_full"] is True)
    # идемпотентность
    r2 = client.post("/webhooks/prodamus", data=form_pro, headers={"Sign": sign_hdr})
    check("дубль webhook -> duplicate", r2.status_code == 200 and r2.json().get("duplicate") is True)
    check("не задвоился платёж prodamus",
          sum(1 for p in db.crm_get_student(u1)["payments"] if p["provider"] == "prodamus") == 1)
    # плохая подпись -> 400 (защита)
    r3 = client.post("/webhooks/prodamus", data=form_pro, headers={"Sign": "deadbeef"})
    check("Prodamus webhook плохой Sign -> 400", r3.status_code == 400)

    print("== CRM: logout ==")
    r = client.post("/crm/logout")
    check("logout -> ok", r.status_code == 200)

    os.unlink(_tmp.name)
    print(f"\nИтог CRM: {passed} PASS / {failed} FAIL")
    return passed, failed

if __name__ == "__main__":
    _p, _f = test_crm()
    sys.exit(1 if _f else 0)
