"""Pytest-конфиг: изоляция БД для всех тестов.

Проблема: backend.main вызывает db.init() ПРИ ИМПОРТЕ (main.py:35), фиксируя
DB_PATH на момент первого импорта. При pytest-glob тесты импортируются вместе,
и порядок ломает изоляцию (no such table / crm_session).

Решение: conftest загружается pytest-ом ДО любого теста. Здесь ставим
DB_PATH на temp-БД и вызываем db.init() — так backend.main при последующем
импорте увидит уже temp-путь и создаст таблицы в нём (idempotent).
"""
import os
import tempfile
from pathlib import Path

# TEST-секреты ДО импорта backend (main проверяет их при старте)
os.environ.setdefault("BOT_TOKEN", "TEST_BOT_TOKEN")
os.environ.setdefault("PRODAMUS_SECRET_KEY", "TEST_PRODAMUS_SECRET")
os.environ.setdefault("INTERNAL_API_KEY", "TEST_INTERNAL_KEY")
os.environ.setdefault("ADMIN_KEY", "super-secret-crm-key")

# temp БД вместо дефолтной dj_school.db (чтобы не трогать рабочую БД)
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
import backend.db as db
db.DB_PATH = Path(_tmp.name)
db.init()


def pytest_sessionfinish(session, exitstatus):
    """Чистим temp БД после прогона."""
    try:
        os.unlink(_tmp.name)
    except OSError:
        pass
