"""CRM-админка Open Deck DJ School.

Защита: единый пароль ADMIN_KEY (из .env). Логин выдаёт подписанный
cookie `crm_session`, дальше все /api/crm/* и сама страница /crm
требуют валидный cookie (HMAC-SHA256, TTL 12ч).

Роуты:
  GET  /crm                  — страница админки (crm.html)
  POST /crm/login            — {key} -> Set-Cookie
  POST /crm/logout           — сброс cookie
  GET  /api/crm/stats        — агрегированная статистика
  GET  /api/crm/students     — список (фильтры/сортировка/пагинация)
  GET  /api/crm/student/{id} — полный профиль (платежи+рефералы+GP)
"""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

import backend.db as db

CRM_DIR = Path(__file__).resolve().parent.parent  # корень проекта
COOKIE_NAME = "crm_session"
SESSION_TTL = 12 * 3600  # 12 часов

# Секрет для подписи cookie: ADMIN_KEY обязателен (нет дефолта — иначе
# админка была бы открыта без пароля).
ADMIN_KEY = os.getenv("ADMIN_KEY", "")
# Cookie `Secure`: True, если бэкенд отдаётся по https (ngrok/прокси).
# По умолчанию False — чтобы не сломать локальную http-разработку.
SECURE_COOKIE = os.getenv("CRM_SECURE_COOKIE", "").lower() in ("1", "true", "yes")
if not ADMIN_KEY:
    # Не падаем (бэкенд стартует для Mini App), но логин будет невозможен.
    import logging
    logging.getLogger("crm").warning("ADMIN_KEY не задан — CRM-админка не доступна.")

router = APIRouter()


# ---------------------------------------------------------------------------
# signed cookie helpers
# ---------------------------------------------------------------------------

def _sign(value: str, ts: int) -> str:
    mac = hmac.new(
        ADMIN_KEY.encode(),
        f"{value}.{ts}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{value}.{ts}.{mac}"


def _verify(token: Optional[str]) -> bool:
    if not token or not ADMIN_KEY:
        return False
    try:
        value, ts_s, mac = token.split(".", 2)
        ts = int(ts_s)
    except (ValueError, AttributeError):
        return False
    if time.time() - ts > SESSION_TTL:
        return False
    expected = hmac.new(
        ADMIN_KEY.encode(),
        f"{value}.{ts}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, mac)


def _require_auth(session: Optional[str]) -> None:
    if not _verify(session):
        raise HTTPException(status_code=401, detail="unauthorized")


# ---------------------------------------------------------------------------
# auth
# ---------------------------------------------------------------------------

@router.post("/crm/login")
async def crm_login(req: Request):
    if not ADMIN_KEY:
        return JSONResponse(
            {"error": "crm_disabled", "detail": "ADMIN_KEY не задан на сервере"},
            status_code=503,
        )
    body = {}
    try:
        body = await req.json()
    except Exception:
        pass
    key = body.get("key", "")
    # защита от тайминга (сравниваем всё равно фикс. время)
    ok = hmac.compare_digest(key, ADMIN_KEY)
    if not ok:
        # лёгкий rate-limit по IP можно добавить позже; пока просто 401
        return JSONResponse({"error": "bad_key"}, status_code=401)
    token = _sign("ok", int(time.time()))
    resp = JSONResponse({"ok": True})
    resp.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_TTL,
        httponly=True,
        samesite="lax",
        secure=SECURE_COOKIE,  # True при https (ngrok/прокси): иначе cookie утекает по http
        path="/",
    )
    return resp


@router.post("/crm/logout")
async def crm_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(COOKIE_NAME, path="/")
    return resp


@router.get("/crm", response_class=HTMLResponse)
async def crm_page(request: Request):
    html = (CRM_DIR / "crm.html").read_text(encoding="utf-8")
    return HTMLResponse(content=html)


# ---------------------------------------------------------------------------
# protected API
# ---------------------------------------------------------------------------

@router.get("/api/crm/stats")
async def crm_stats(request: Request):
    _require_auth(request.cookies.get("crm_session"))
    return db.crm_stats()


@router.get("/api/crm/students")
async def crm_students(
    request: Request,
    q: str = "",
    status: str = "all",
    sort: str = "created",
    order: str = "desc",
    page: int = 1,
    per_page: int = 25,
):
    _require_auth(request.cookies.get("crm_session"))
    return db.crm_list_users(
        q=q or None,
        status=status,
        sort=sort,
        order=order,
        page=page,
        per_page=per_page,
    )


@router.get("/api/crm/student/{user_id}")
async def crm_student(user_id: int, request: Request):
    _require_auth(request.cookies.get("crm_session"))
    student = db.crm_get_student(user_id)
    if not student:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return student


# ---------------------------------------------------------------------------
# CRM: редактирование (защищено)
# ---------------------------------------------------------------------------

class DeleteBody(BaseModel):
    confirm: bool = False


@router.get("/api/crm/test-accounts")
async def crm_test_accounts(request: Request):
    """Предпросмотр тестовых аккаунтов (без удаления)."""
    _require_auth(request.cookies.get("crm_session"))
    return {"accounts": db.crm_list_test_accounts()}


@router.post("/api/crm/test-accounts/delete")
async def crm_test_accounts_delete(request: Request, body: DeleteBody = DeleteBody()):
    _require_auth(request.cookies.get("crm_session"))
    if not body.confirm:
        return JSONResponse({"error": "need_confirm", "hint": "передай confirm:true"},
                            status_code=400)
    return db.crm_delete_test_accounts()


@router.delete("/api/crm/student/{user_id}")
async def crm_student_delete(user_id: int, request: Request, confirm: bool = False):
    _require_auth(request.cookies.get("crm_session"))
    if not confirm:
        return JSONResponse({"error": "need_confirm", "hint": "передай ?confirm=1"},
                            status_code=400)
    deleted = db.crm_delete_user(user_id)
    if not deleted:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return {"ok": True, "deleted": user_id}


class GpBody(BaseModel):
    amount: int
    mode: str = "set"  # set | add | subtract


@router.post("/api/crm/student/{user_id}/gp")
async def crm_student_gp(user_id: int, body: GpBody, request: Request):
    _require_auth(request.cookies.get("crm_session"))
    result = db.crm_set_gp(user_id, body.amount, body.mode)
    if result is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return result


class LessonBody(BaseModel):
    course_id: str = "dj-basics"
    lesson_id: int
    completed: bool = True


@router.post("/api/crm/student/{user_id}/lesson")
async def crm_student_lesson(user_id: int, body: LessonBody, request: Request):
    _require_auth(request.cookies.get("crm_session"))
    result = db.crm_set_lesson(user_id, body.course_id, body.lesson_id, body.completed)
    if result is None:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return result


@router.post("/api/crm/student/{user_id}/reset-free")
async def crm_student_reset_free(user_id: int, request: Request):
    """Сбросить аккаунт в «бесплатный» (удалить платежи). Для теста paywall."""
    _require_auth(request.cookies.get("crm_session"))
    ok = db.crm_reset_to_free(user_id)
    if not ok:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return {"ok": True, "user_id": user_id, "status": "free"}
