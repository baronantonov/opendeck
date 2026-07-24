#!/usr/bin/env bash
# Open Deck DJ School — one-click launcher
# Поднимает бэкенд (он же отдаёт фронтенд через /) + serveo-туннель
set -u

# APP_DIR — каталог проекта (авто-определение из места скрипта)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
KEY="$APP_DIR/tunnel-keys/id_ed25519"
LOG_DIR="/tmp"
VENV_PY="$APP_DIR/.venv/bin/python3"

log(){ echo "[opendeck] $*"; }

# 1. Остановить старые инстансы
log "Останавливаю старые процессы…"
fuser -k 8000/tcp 2>/dev/null || true
pkill -f "ssh -o StrictHostKeyChecking=accept-new.*opendeck-tma" 2>/dev/null || true
sleep 1

# 2. Бэкенд (фронтенд раздаётся им же через GET /)
if [ ! -x "$VENV_PY" ]; then
  log "НЕТ venv по $VENV_PY — поставь зависимости: .venv/bin/python3 -m pip install -r requirements.txt"
  notify-send "Open Deck" "Нет .venv — сначала установи зависимости" --icon=error 2>/dev/null || true
  exit 1
fi
cd "$APP_DIR" || { notify-send "Open Deck" "Нет папки $APP_DIR" --icon=error 2>/dev/null; exit 1; }
log "Запускаю бэкенд…"
nohup "$VENV_PY" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 \
  > "$LOG_DIR/opendeck-backend.log" 2>&1 &

# 3. Туннель serveo
if [ ! -f "$KEY" ]; then
  log "НЕТ ключа туннеля $KEY — туннель не поднимется"
  notify-send "Open Deck" "Нет tunnel-keys/id_ed25519" --icon=error 2>/dev/null || true
else
  log "Поднимаю туннель…"
  nohup ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 \
    -o ExitOnForwardFailure=yes -o IdentitiesOnly=yes -i "$KEY" \
    -R opendeck-tma:80:localhost:8000 serveo.net \
    > "$LOG_DIR/opendeck-tunnel.log" 2>&1 &
fi

# 4. Проверка
sleep 4
if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  if curl -sf https://opendeck-tma.serveousercontent.com/api/health >/dev/null 2>&1; then
    log "Готово ✅"
    notify-send "Open Deck 🎧" "Приложение поднято
https://opendeck-tma.serveousercontent.com" --icon="$HOME/.local/share/icons/opendeck.svg" 2>/dev/null || true
  else
    log "Бэкенд ок, туннель ещё не готов"
    notify-send "Open Deck 🎧" "Бэкенд поднят, туннель подключается…" --icon="$HOME/.local/share/icons/opendeck.svg" 2>/dev/null || true
  fi
else
  log "ОШИБКА запуска бэкенда (см. $LOG_DIR/opendeck-backend.log)"
  notify-send "Open Deck" "Ошибка запуска бэкенда" --icon=error 2>/dev/null || true
fi
