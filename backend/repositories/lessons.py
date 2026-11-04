"""Репозиторий уроков и прогресса (progress)."""
from __future__ import annotations

import backend.db as db

COURSE_ID = "dj-basics"
BONUS_COURSE_ID = "dj-bonus"
GP_PER_LESSON = 50
GP_PER_BONUS = 30
COURSE_PRICE_STARS = 2500
LESSON_GP = GP_PER_LESSON


def complete_lesson(user_id, course_id, lesson_id):
    """Отметить урок пройденным. Обновить groove_points в users + транзакция.

    ЗАЩИТА ОТ ФЕРМЫ (C1): если урок уже отмечен пройденным — повторно
    не начисляем GP. Иначе прямой POST /api/progress с одним lesson_id
    много раз накручивал бы Stars бесконечно.
    """
    is_bonus = (course_id == BONUS_COURSE_ID)
    gp_gain = GP_PER_BONUS if is_bonus else GP_PER_LESSON
    with db._conn() as c:
        c.execute("BEGIN IMMEDIATE")
        already = c.execute(
            "SELECT 1 FROM progress "
            "WHERE user_id=? AND course_id=? AND lesson_id=? AND completed=1",
            (user_id, course_id, lesson_id),
        ).fetchone()
        c.execute(
            "INSERT INTO progress (user_id, course_id, lesson_id, completed, gp_earned) "
            "VALUES (?,?,?,1,?) "
            "ON CONFLICT(user_id, course_id, lesson_id) DO UPDATE SET "
            "completed=1, completed_at=datetime('now')",
            (user_id, course_id, lesson_id, gp_gain),
        )
        if not already:
            c.execute(
                "UPDATE users SET groove_points = groove_points + ? WHERE user_id=?",
                (gp_gain, user_id),
            )
            c.execute(
                "INSERT INTO transactions (user_id, amount, action_type) "
                "VALUES (?,?, 'lesson_complete')",
                (user_id, gp_gain),
            )
        total = c.execute(
            "SELECT groove_points FROM users WHERE user_id=?", (user_id,)
        ).fetchone()[0]
    return int(total)


def get_completed(user_id, course_id=COURSE_ID):
    with db._conn() as c:
        rows = c.execute(
            "SELECT lesson_id FROM progress WHERE user_id=? AND course_id=? AND completed=1",
            (user_id, course_id),
        ).fetchall()
    return [int(r["lesson_id"]) for r in rows]


def db_has_paid_course(user_id, course_id) -> bool:
    """Обертка над has_paid для внутреннего использования в цикле."""
    return db.has_paid(user_id, course_id)
