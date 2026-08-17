# AGENTS.md — Open Deck DJ School TMA

Инструкции для AI coding-агентов (Hermes, Claude Code, Codex, Cursor). Точка истины по коду — этот файл + `PROJECT_BRIEF.md` (продукт/маркетинг) + `backend/PLAY-API.md` (API).

## Setup commands
- venv: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- Секреты: `cp .env.example .env` и заполнить (`BOT_TOKEN`, `MINI_APP_URL`, ключи Prodamus). Никогда не коммитить `.env`.
- Dev-бэкенд: `.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000`
- Dev-бот: `.venv/bin/python -m bot.main`
- One-click (локально + serveo-туннель): `bash start-app.sh`

## Project structure
- `backend/` — FastAPI-приложение (`main.py` = `app`), SQLite-слой (`db.py`), CRM (`crm.py`), авторизация (`auth.py`), подпись Prodamus (`prodamus_sign.py`). **`backend/PLAY-API.md`** — эталонный референс по эндпоинтам.
- `bot/` — Telegram-бот на aiogram (`main.py`), конфиги (`config.py`, `config.example.py`), платёжный модуль (`payments/`).
- `frontend/` — **новый TMA-фронтенд (2026 stack)**: Vite 7 + React 18 + TypeScript (strict) + Tailwind v4, `@telegram-apps/sdk-react` v3 (`init()` в `src/main.tsx`), однофайловая сборка через `vite-plugin-singlefile`. Собирается в `frontend/dist/index.html`, который копируется на корневой `index.html` скриптом `frontend/deploy.sh` (контракт `GET /` бэкенда не меняется). Точка входа API — `src/api/client.ts` (заголовок `X-Init-Data`).
- `index.html` (корневой) — **скомпилированный** однофайловый TMA-фронтенд (mobile-first, только Telegram WebView). Генерируется из `frontend/`, НЕ правится руками. `crm.html` — дашборд CRM.
- `tests/` — pytest (`test_backend.py`, `test_bot.py`, `test_crm.py`, `test_economy.py`, `test_prodamus_*.py`).
- `oracle/`, `nginx/` (Caddyfile), `scripts/`, `tunnel-keys/` — инфра/туннели.
- Деплой: `docker-compose.yml` (сервисы `backend`/`bot`/`caddy`) либо `deploy.sh` (systemd + Caddy, без Docker).

## Code style
- Python 3.11, PEP 8, обязательны type hints. Русские комментарии допустимы.
- Функциональные, тестируемые модули; бизнес-логика платежей/экономики — в `backend/` (не в боте).
- Один реальный пример кода > три абзаца описания.

## Testing instructions
- Перед коммитом: `.venv/bin/pytest -q tests/`
- Платежи Prodamus покрыты `test_prodamus_*.py` — запускать при любом изменении `prodamus_sign.py` или вебхука.
- CI-план ищи в `docker-compose.yml` / `deploy.sh`.

## Git workflow
- Ветка разработки `master` → удалённая `origin/main`.
- **Push ТОЛЬКО:** `git push origin master:main`. Никогда не `git push origin HEAD`, никаких force-push.
- Формат коммита: `[<area>] <Title>` (напр. `[bot] fix webhook signature`).
- Личные/финансовые артефакты Антона НЕ класть в этот репозиторий (только продуктовый код).

## Boundaries
- ✅ Always: писать в `backend/`, `bot/`, `tests/`, `*.py`, `*.html`, `*.sh`; запускать тесты перед коммитом.
- ⚠️ Ask first: изменение схемы БД (`db.py`), добавление зависимостей (`requirements.txt`), правка `.env`, изменение деплоя (`docker-compose.yml`, `deploy.sh`, `Caddyfile`), правка `index.html` (TMA-фронтенд).
- 🚫 Never: коммитить секреты (`.env`, токены, ключи Prodamus), `git push origin HEAD`, force-push, править `.venv/`, `node_modules/`, `dj_school.db` (рабочая БД) без согласования.
