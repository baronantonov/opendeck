"""Конфигурация бота.

Все секреты — через переменные окружения. Для удобства локально можно
положить их в .env (подхватит python-dotenv). Никогда не коммить .env!

Ключевое для привязки Mini App:
  MINI_APP_URL — ПУБЛИЧНЫЙ https, который отдаёт backend (GET /).
  В BotFather -> /newapp -> Web App URL = тот же MINI_APP_URL.
"""
import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://ВАШ-ДОМЕН.tld")

# --- Version-busting для Telegram WebView ---
# Telegram агрессивно кэширует Mini App по URL. Чтобы новый дизайн/правки
# показывались сразу (без ручного сброса кэша), добавляем ?v=<версия> к URL.
# Версия: env MINI_APP_VERSION > git-short-hash HEAD > сегодняшняя дата.
# GitHub Pages отдаёт тот же index.html при любом query, но Telegram видит
# НОВЫЙ URL и перезагружает WebView.
import datetime as _dt
import subprocess as _sp
from pathlib import Path as _Path

def _mini_app_version() -> str:
    v = os.getenv("MINI_APP_VERSION")
    if v:
        return v
    try:
        r = _sp.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=_Path(__file__).resolve().parent.parent,
            capture_output=True, text=True, timeout=3,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    return _dt.date.today().isoformat()

def mini_app_url() -> str:
    """Вернуть MINI_APP_URL с актуальным ?v=<git-hash>.

    ВАЖНО: хэш вычисляется КАЖДЫЙ раз при вызове (а не при импорте модуля!),
    иначе после git push новых правок бот продолжает отдавать старый ?v=,
    и Telegram отдаёт закэшированную старую страницу Mini App.
    """
    url = MINI_APP_URL
    if url in ("https://ВАШ-ДОМЕН.tld", ""):
        return url
    ver = _mini_app_version()
    # убираем старый ?v=, если вдруг попал в .env
    base = url.split("?")[0]
    return f"{base}?v={ver}"


# Для обратной совместимости оставляем константу, но реальный URL
# с актуальным хэшом берётся через mini_app_url().
MINI_APP_URL = mini_app_url()

# Telegram Stars: цена в Stars (XTR) за курс
# Актуальные цены заданы в backend/main.py (TRIPWIRE_PRICE, FULL_COURSE_PRICE, MENTOR_PRICE)
# ЗДЕСЬ ОПРЕДЕЛЯЮТСЯ ТОЛЬКО ПАРАМЕТРЫ ДЛЯ ПРЯМОЙ ОТПРАВКИ ИНВОЙСА ЧЕРЕЗ БОТА
STARS_PRICE = 199  # полный курс (legacy — не используется, инвойс идёт через backend /api/create-invoice)
MENTOR_PRICE = 300  # Stars за менторство
MENTOR_GP_MAX = 1030  # максимальный списания GP

# Ключ для internal API (бота -> бэкенд)
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

# TON Connect
TON_NETWORK = os.getenv("TON_NETWORK", "mainnet")
TON_MERCHANT_WALLET = os.getenv("TON_MERCHANT_WALLET", "")
TON_RPC = os.getenv("TON_RPC", "https://toncenter.com/api/v2/jsonRPC")

# Prodamus (внешний редирект через openLink) — реальный REST API payform.ru
# URL платёжной страницы вида https://<поддомен>.payform.ru/ (из адресной строки)
PRODAMUS_PAYFORM_URL = os.getenv("PRODAMUS_PAYFORM_URL", "")
# Секретный ключ платёжной страницы (раздел «Где найти url для уведомлений и секретный ключ»)
PRODAMUS_SECRET_KEY = os.getenv("PRODAMUS_SECRET_KEY", "")
# Код интеграции SYS (согласуется с поддержкой Prodamus). Один на всех клиентов интеграции.
PRODAMUS_SYS_CODE = os.getenv("PRODAMUS_SYS_CODE", "")
# API-ключ (логи/доп. вызовы). НЕ используется при формировании ссылки.
PRODAMUS_API_KEY = os.getenv("PRODAMUS_API_KEY", "")

# Backend (где живёт раздача уроков / выдача доступа)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
