"""Репозиторий CRM-админки (статистика, список учеников, управление аккаунтами)."""
from __future__ import annotations

import backend.db as db

_TEST_NAMES = ("Tester", "E2E", "Adhoc", "LiveAdhoc", "Live3")
_TEST_USERNAMES = ("tester",)

_SORT_MAP = {
    "name": "u.first_name COLLATE NOCASE",
    "created": "u.created_at",
    "last_seen": "u.last_seen",
    "gp": "u.groove_points",
    "refers": "refers_count",
    "lessons": "lessons_done",
    "bonus": "bonus_done",
}
_STATUS_WHERE = {
    "free": "NOT EXISTS (SELECT 1 FROM payments p WHERE p.user_id=u.user_id AND p.status='paid')",
    "paid": ("EXISTS (SELECT 1 FROM payments p WHERE p.user_id=u.user_id AND p.status='paid' "
             "AND p.course_id IN ('dj-basics','tripwire'))"),
    "vip": ("EXISTS (SELECT 1 FROM payments p WHERE p.user_id=u.user_id AND p.status='paid' "
            "AND p.course_id='mentoring')"),
}


def _test_account_filter() -> str:
    names = ", ".join("?" * len(_TEST_NAMES))
    unames = ", ".join("?" * len(_TEST_USERNAMES))
    return f"(u.first_name IN ({names}) OR u.username IN ({unames}) OR u.first_name LIKE 'Live%')"


def crm_list_test_accounts() -> list[dict]:
    """Предпросмотр тестовых аккаунтов (dry-run перед удалением)."""
    with db._conn() as c:
        rows = c.execute(
            f"SELECT user_id, first_name, username, groove_points FROM users u WHERE {_test_account_filter()}",
            _TEST_NAMES + _TEST_USERNAMES,
        ).fetchall()
    return [dict(r) for r in rows]


def crm_delete_test_accounts() -> dict:
    """Каскадно удалить тестовые аккаунты. Возвращает {deleted, ids}."""
    ids = [r["user_id"] for r in crm_list_test_accounts()]
    if not ids:
        return {"deleted": 0, "ids": []}
    with db._conn() as c:
        for uid in ids:
            for tbl in ("progress", "payments", "transactions", "badges", "ab_assignments", "users"):
                c.execute(f"DELETE FROM {tbl} WHERE user_id=?", (uid,))
    return {"deleted": len(ids), "ids": ids}


def crm_delete_user(user_id: int) -> bool:
    """Каскадно удалить одного пользователя. Возвращает True, если был удалён."""
    if not db.get_user(user_id):
        return False
    with db._conn() as c:
        for tbl in ("progress", "payments", "transactions", "badges", "ab_assignments"):
            c.execute(f"DELETE FROM {tbl} WHERE user_id=?", (user_id,))
        c.execute(
            "UPDATE users SET referred_by=NULL WHERE referred_by="
            "(SELECT referral_code FROM users WHERE user_id=?)",
            (user_id,),
        )
        c.execute("DELETE FROM users WHERE user_id=?", (user_id,))
    return True


def crm_reset_to_free(user_id: int) -> bool:
    """Сбросить аккаунт в «бесплатный»: удалить все платежи."""
    if not db.get_user(user_id):
        return False
    with db._conn() as c:
        c.execute("DELETE FROM payments WHERE user_id=?", (user_id,))
    return True


def crm_set_gp(user_id: int, amount: int, mode: str = "set") -> dict | None:
    """Изменить баланс GP (set / add / subtract) с записью в transactions."""
    u = db.get_user(user_id)
    if not u:
        return None
    current = int(u.get("groove_points", 0) or 0)
    if mode == "set":
        new = max(0, int(amount))
    elif mode == "add":
        new = max(0, current + int(amount))
    elif mode == "subtract":
        new = max(0, current - int(amount))
    else:
        return None
    action = {"set": "crm_gp_set", "add": "crm_gp_add", "subtract": "crm_gp_sub"}[mode]
    with db._conn() as c:
        c.execute("UPDATE users SET groove_points=? WHERE user_id=?", (new, user_id))
        c.execute(
            "INSERT INTO transactions (user_id, amount, action_type) VALUES (?,?,?)",
            (user_id, new - current, action),
        )
    return {"groove_points": new, "delta": new - current}


def crm_stats() -> dict:
    """Агрегированная статистика для дашборда CRM."""
    with db._conn() as c:
        total = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        paid_full = c.execute(
            "SELECT COUNT(DISTINCT p.user_id) FROM payments p JOIN users u ON u.user_id=p.user_id "
            "WHERE p.course_id='dj-basics' AND p.status='paid'"
        ).fetchone()[0]
        paid_tw = c.execute(
            "SELECT COUNT(DISTINCT p.user_id) FROM payments p JOIN users u ON u.user_id=p.user_id "
            "WHERE p.course_id='tripwire' AND p.status='paid'"
        ).fetchone()[0]
        paid_mentor = c.execute(
            "SELECT COUNT(DISTINCT p.user_id) FROM payments p JOIN users u ON u.user_id=p.user_id "
            "WHERE p.course_id='mentoring' AND p.status='paid'"
        ).fetchone()[0]
        revenue_stars = c.execute(
            "SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN users u ON u.user_id=p.user_id "
            "WHERE p.status='paid' AND p.amount IS NOT NULL"
        ).fetchone()[0]
        active_today = c.execute(
            "SELECT COUNT(*) FROM users WHERE last_seen >= datetime('now','-1 day')"
        ).fetchone()[0]
        new_week = c.execute(
            "SELECT COUNT(*) FROM users WHERE created_at >= datetime('now','-7 day')"
        ).fetchone()[0]
        total_gp = c.execute("SELECT COALESCE(SUM(groove_points),0) FROM users").fetchone()[0]
        referrals_total = c.execute("SELECT COUNT(*) FROM users WHERE referred_by IS NOT NULL").fetchone()[0]
    return {
        "total_users": int(total),
        "paid_full": int(paid_full),
        "paid_tripwire": int(paid_tw),
        "paid_mentor": int(paid_mentor),
        "paid_any": int(paid_full) + int(paid_tw) + int(paid_mentor),
        "revenue_stars": int(revenue_stars),
        "active_today": int(active_today),
        "new_week": int(new_week),
        "total_gp": int(total_gp),
        "referrals_total": int(referrals_total),
    }


def crm_list_users(q=None, status="all", sort="created", order="desc", page=1, per_page=25) -> dict:
    """Список учеников с фильтрами, сортировкой и пагинацией."""
    page = max(1, int(page))
    per_page = min(100, max(1, int(per_page)))
    sort_col = _SORT_MAP.get(sort, "u.created_at")
    order_sql = "ASC" if order == "asc" else "DESC"

    where, params = [], []
    if q:
        like = f"%{q}%"
        where.append("(u.first_name LIKE ? OR u.username LIKE ? OR u.referral_code LIKE ? OR CAST(u.user_id AS TEXT) LIKE ?)")
        params += [like, like, like, like]
    if status in _STATUS_WHERE:
        where.append(_STATUS_WHERE[status])
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    with db._conn() as c:
        total = c.execute(f"SELECT COUNT(*) FROM users u {where_sql}", params).fetchone()[0]
        rows = c.execute(
            f"""
            SELECT u.*,
              (SELECT COUNT(*) FROM users r WHERE r.referred_by = u.referral_code) AS refers_count,
              (SELECT COUNT(*) FROM progress pr WHERE pr.user_id=u.user_id AND pr.completed=1 AND pr.course_id='dj-basics') AS lessons_done,
              (SELECT COUNT(*) FROM progress pb WHERE pb.user_id=u.user_id AND pb.completed=1 AND pb.course_id='dj-bonus') AS bonus_done,
              (SELECT COUNT(*) FROM payments p WHERE p.user_id=u.user_id AND p.status='paid') AS paid_count,
              EXISTS (SELECT 1 FROM payments pm WHERE pm.user_id=u.user_id AND pm.course_id='mentoring' AND pm.status='paid') AS is_vip,
              EXISTS (SELECT 1 FROM payments pf WHERE pf.user_id=u.user_id AND pf.course_id='dj-basics' AND pf.status='paid') AS is_full,
              EXISTS (SELECT 1 FROM payments pt WHERE pt.user_id=u.user_id AND pt.course_id='tripwire' AND pt.status='paid') AS is_tw
            FROM users u {where_sql}
            ORDER BY {sort_col} {order_sql}
            LIMIT ? OFFSET ?
            """,
            params + [per_page, (page - 1) * per_page],
        ).fetchall()

    students = []
    for r in rows:
        d = dict(r)
        paid_count = int(d.get("paid_count", 0) or 0)
        is_vip, is_full, is_tw = bool(d.get("is_vip")), bool(d.get("is_full")), bool(d.get("is_tw"))
        seg = "vip" if is_vip else ("paid" if paid_count > 0 else "free")
        students.append({
            "user_id": d["user_id"],
            "first_name": d.get("first_name") or "",
            "username": d.get("username") or "",
            "photo_url": d.get("photo_url") or "",
            "referral_code": d.get("referral_code") or "",
            "archetype": d.get("archetype") or "",
            "groove_points": int(d.get("groove_points", 0) or 0),
            "created_at": d.get("created_at") or "",
            "last_seen": d.get("last_seen") or "",
            "refers_count": int(d.get("refers_count", 0) or 0),
            "lessons_done": int(d.get("lessons_done", 0) or 0),
            "bonus_done": int(d.get("bonus_done", 0) or 0),
            "bonus_unlocked": min(int(d.get("lessons_done", 0) or 0) + 1, 4),
            "paid_full": is_full,
            "paid_tripwire": is_tw,
            "paid_mentor": is_vip,
            "status": seg,
        })
    return {"total": int(total), "page": page, "per_page": per_page, "students": students}


def crm_set_lesson(user_id: int, course_id: str, lesson_id: int, completed: bool) -> dict | None:
    """Переключить статус урока в прогрессе (CRM-редактирование)."""
    if not db.get_user(user_id):
        return None
    with db._conn() as c:
        existing = c.execute(
            "SELECT 1 FROM progress WHERE user_id=? AND course_id=? AND lesson_id=? AND completed=1",
            (user_id, course_id, lesson_id),
        ).fetchone()
        gp_delta = db.GP_PER_BONUS if course_id == db.BONUS_COURSE_ID else db.GP_PER_LESSON
        if completed and not existing:
            c.execute(
                "INSERT INTO progress (user_id, course_id, lesson_id, completed, gp_earned) VALUES (?,?,?,1,?) "
                "ON CONFLICT(user_id, course_id, lesson_id) DO UPDATE SET completed=1, completed_at=datetime('now')",
                (user_id, course_id, lesson_id, gp_delta),
            )
            c.execute("UPDATE users SET groove_points = groove_points + ? WHERE user_id=?", (gp_delta, user_id))
            c.execute("INSERT INTO transactions (user_id, amount, action_type) VALUES (?, ?, 'crm_lesson_add')", (user_id, gp_delta))
        elif not completed:
            c.execute("DELETE FROM progress WHERE user_id=? AND course_id=? AND lesson_id=?", (user_id, course_id, lesson_id))
            if existing:
                c.execute("UPDATE users SET groove_points = MAX(0, groove_points - ?) WHERE user_id=?", (gp_delta, user_id))
                c.execute("INSERT INTO transactions (user_id, amount, action_type) VALUES (?, ?, 'crm_lesson_remove')", (user_id, -gp_delta))
        gp = c.execute("SELECT groove_points FROM users WHERE user_id=?", (user_id,)).fetchone()[0]
    return {"groove_points": int(gp), "completed": bool(completed)}


def crm_get_student(user_id: int) -> dict | None:
    """Полный профиль ученика для drawer'а CRM."""
    u = db.get_user(user_id)
    if not u:
        return None
    with db._conn() as c:
        payments = [dict(r) for r in c.execute(
            "SELECT id, course_id, provider, amount, currency, status, created_at FROM payments WHERE user_id=? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()]
        transactions = [dict(r) for r in c.execute(
            "SELECT id, amount, action_type, ref_user_id, timestamp FROM transactions WHERE user_id=? ORDER BY timestamp DESC LIMIT 200",
            (user_id,),
        ).fetchall()]
        referrals = [dict(r) for r in c.execute(
            "SELECT user_id, first_name, username, groove_points, created_at FROM users "
            "WHERE referred_by=(SELECT referral_code FROM users WHERE user_id=?) ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()]
        lessons = [dict(r) for r in c.execute(
            "SELECT course_id, lesson_id, completed, gp_earned, completed_at FROM progress WHERE user_id=? ORDER BY course_id, lesson_id",
            (user_id,),
        ).fetchall()]
    inviter = db.get_user_by_referral_code(u["referred_by"]) if u.get("referred_by") else None
    return {
        "user": u,
        "payments": payments,
        "transactions": transactions,
        "referrals": referrals,
        "referrals_count": len(referrals),
        "inviter": (dict(inviter) if inviter else None),
        "lessons": lessons,
        "badges": db.get_badges(user_id),
        "gp": int(u.get("groove_points", 0) or 0),
        "paid_full": db.has_paid(user_id, "dj-basics"),
        "paid_tripwire": db.has_paid(user_id, "tripwire"),
        "paid_mentor": db.has_paid(user_id, "mentoring"),
    }
