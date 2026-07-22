#!/usr/bin/env bash
# Open Deck DJ School — one-click launcher
# Поднимает бэкенд (он же отдаёт фронтенд через /) + serveo-туннель
set -u

APP_DIR="$HOME/dj-school-tma"
KEY="$APP_DIR/tunnel-keys/id_ed25519"
LOG_DIR="/tmp"
ICON="$HOME/.local/share/icons/opendeck.svg"

log(){ echo "[opendeck] $*"; }

# 1. Остановить старые инстансы
log "Останавливаю старые процессы…"
fuser -k 8000/tcp 2>/dev/null || true
pkill -f "ssh -o StrictHostKeyChecking=accept-new.*opendeck-tma" 2>/dev/null || true
sleep 1

# 2. Бэкенд (фронтенд раздаётся им же через GET /)
cd "$APP_DIR" || { notify-send "Open Deck" "Нет папки $APP_DIR" --icon=error 2>/dev/null; exit 1; }
log "Запускаю бэкенд…"
nohup python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 \
  > "$LOG_DIR/opendeck-backend.log" 2>&1 &

# 3. Туннель serveo
log "Поднимаю туннель…"
nohup ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 \
  -o ExitOnForwardFailure=yes -o IdentitiesOnly=yes -i "$KEY" \
  -R opendeck-tma:80:localhost:8000 serveo.net \
  > "$LOG_DIR/opendeck-tunnel.log" 2>&1 &

# 4. Проверка
sleep 4
if curl -sf http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  if curl -sf https://opendeck-tma.serveousercontent.com/api/health >/dev/null 2>&1; then
    log "Готово ✅"
    notify-send "Open Deck 🎧" "Приложение поднято\nhttps://opendeck-tma.serveousercontent.com" --icon="$ICON" 2>/dev/null || true
  else
    log "Бэкенд ок, туннель ещё не готов"
    notify-send "Open Deck 🎧" "Бэкенд поднят, туннель подключается…" --icon="$ICON" 2>/dev/null || true
  fi
else
  log "ОШИБКА запуска бэкенда"
  notify-send "Open Deck" "Ошибка запуска бэкенда (см. $LOG_DIR/opendeck-backend.log)" --icon=error 2>/dev/null || true
fi
