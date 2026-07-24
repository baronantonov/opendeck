#!/usr/bin/env python3
"""
db_users_view.py — витрина базы пользователей Open Deck (только чтение).

Собирает читаемую таблицу по логинам из существующих таблиц:
  users (user_id, first_name, username) + payments (paid) + progress (уроки, gp).
НЕ меняет схему БД и не пишет в неё — read-only.

Почему user_id, а не логин, — первичный ключ:
  Telegram user_id immutable и всегда есть; @username может быть пустым
  (уже есть юзеры без имени/логина) и может меняться. Логин здесь — для
  отображения и поиска, а не для идентификации.

Тестовые провайдеры (test/smoke/manual-test) и first_name=Tester/TestUser/
SmokeTest помечаются [TEST] и по умолчанию исключаются из «реальных».

Запуск:
  python3 db_users_view.py            # реальные юзеры + сводка
  python3 db_users_view.py --all      # все, включая тестовые
  python3 db_users_view.py --csv      # экспорт реальных в CSV (stdout)
  python3 db_users_view.py --csv --all > out.csv
"""
from __future__ import annotations
import sqlite3
import argparse
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "dj_school.db"

# провайдеры-заглушки из автотестов — НЕ считаем реальной оплатой.
# manual-test — это ручная выдача доступа (например, владельцу для теста
# прогресса), это РЕАЛЬНЫЙ доступ, поэтому не в этом списке.
TEST_PROVIDERS = {"test", "smoke"}
TEST_FIRSTNAMES = {"Tester", "TestUser", "SmokeTest"}


def _row_factory(cur, row):
    return dict(sqlite3.Row(cur, row))


def load():
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    con.row_factory = _row_factory
    users = [dict(r) for r in con.execute("SELECT * FROM users ORDER BY user_id")]
    pay = [dict(r) for r in con.execute(
        "SELECT user_id, provider, status FROM payments")]
    prog = [dict(r) for r in con.execute(
        "SELECT user_id, COUNT(*) n, COALESCE(SUM(gp_earned),0) gp "
        "FROM progress WHERE completed=1 GROUP BY user_id")]
    con.close()

    pmap = {}
    for p in pay:
        if p["status"] == "paid":
            pmap.setdefault(p["user_id"], set()).add(p["provider"])
    gmap = {r["user_id"]: (r["n"], r["gp"]) for r in prog}

    rows = []
    for u in users:
        uid = u["user_id"]
        paid = pmap.get(uid, set())
        is_test = (u["first_name"] in TEST_FIRSTNAMES
                   or bool(paid & TEST_PROVIDERS))
        n, gp = gmap.get(uid, (0, 0))
        rows.append({
            "user_id": uid,
            "login": "@" + (u["username"] or "—"),
            "first_name": u["first_name"] or "—",
            "paid": ",".join(sorted(paid)) if paid else "—",
            "lessons": f"{n}/10",
            "gp": gp,
            "is_test": is_test,
            "created_at": u.get("created_at", ""),
            "last_seen": u.get("last_seen", ""),
        })
    return rows


def is_real(r):
    # реально плативший/получивший доступ — у кого есть paid (не "—") и не тест
    return r["paid"] != "—" and not r["is_test"]


def print_table(rows, include_test):
    show = rows if include_test else [r for r in rows if not r["is_test"]]
    hdr = f"{'user_id':<12} {'login':<20} {'name':<18} {'paid':<17} {'lessons':<8} {'gp':<5} {'flag'}"
    print(hdr)
    print("-" * len(hdr))
    for r in show:
        flag = "[TEST]" if r["is_test"] else ""
        print(f"{r['user_id']:<12} {r['login']:<20} {r['first_name']:<18} "
              f"{r['paid']:<17} {r['lessons']:<8} {r['gp']:<5} {flag}")
    real = [r for r in show if is_real(r)]
    print("-" * len(hdr))
    print(f"Показано: {len(show)} | реальных плативших: {len(real)} | "
          f"всего в БД: {len(rows)}")


def to_csv(rows):
    import csv, sys
    w = csv.writer(sys.stdout)
    w.writerow(["user_id", "login", "first_name", "paid_providers",
                "lessons_done", "gp", "is_test", "created_at", "last_seen"])
    for r in rows:
        w.writerow([r["user_id"], r["login"], r["first_name"], r["paid"],
                    r["lessons"], r["gp"], r["is_test"],
                    r["created_at"], r["last_seen"]])


def main():
    ap = argparse.ArgumentParser(description="Витрина пользователей Open Deck (read-only)")
    ap.add_argument("--all", action="store_true", help="показать и тестовые записи")
    ap.add_argument("--csv", action="store_true", help="экспорт в CSV (stdout)")
    args = ap.parse_args()

    rows = load()
    if args.csv:
        out = rows if args.all else [r for r in rows if not r["is_test"]]
        to_csv(out)
    else:
        print_table(rows, include_test=args.all)


if __name__ == "__main__":
    main()
