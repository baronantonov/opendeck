#!/usr/bin/env bash
# Open Deck tunnel wrapper: starts ngrok, waits for public URL, rewrites
# API_BASE in index.html + MINI_APP_URL in .env, and pushes to GitHub.
# Designed to be run by systemd-user (opendeck-tunnel.service).
set -euo pipefail

PROJECT_DIR="%h/projects/dj-school-tma"
# systemd expands %h; if running outside systemd, fall back to HOME
PROJECT_DIR="${PROJECT_DIR/\%h/$HOME}"
cd "$PROJECT_DIR"

LOG="/tmp/opendeck-tunnel.log"
exec >>"$LOG" 2>&1

echo "[$(date -Is)] starting ngrok tunnel wrapper"

# Start ngrok in background (managed by this script's lifetime)
NGROK_BIN="$HOME/.config/ngrok/ngrok"
if [ ! -x "$NGROK_BIN" ]; then
  NGROK_BIN="$(command -v ngrok || true)"
fi
"$NGROK_BIN" http 8000 --log=stdout &
NGROK_PID=$!
echo "[$(date -Is)] ngrok pid=$NGROK_PID"

# Wait for ngrok local API to expose the public URL
URL=""
for i in $(seq 1 30); do
  sleep 2
  URL=$(curl -s --max-time 3 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
        | grep -o '"public_url":"https://[^"]*"' | head -1 | sed 's/"public_url":"//;s/"//')
  if [ -n "$URL" ]; then
    echo "[$(date -Is)] got public url: $URL"
    break
  fi
done

if [ -z "$URL" ]; then
  echo "[$(date -Is)] ERROR: ngrok did not expose a public url, exiting"
  kill "$NGROK_PID" 2>/dev/null || true
  exit 1
fi

# Rewrite API_BASE in index.html
if grep -q "API_BASE = " index.html; then
  # СНАЧАЛА подставить актуальный git-hash в self version-busting
  bash "$(dirname "$0")/build.sh" "$PROJECT_DIR" || echo "[$(date -Is)] build.sh failed (non-fatal)"
  # only rewrite if changed
  CURRENT=$(grep -o "API_BASE = '[^']*'" index.html | head -1 | sed "s/API_BASE = '//;s/'//")
  if [ "$CURRENT" != "$URL" ]; then
    sed -i "s#API_BASE = '[^']*'#API_BASE = '$URL'#" index.html
    echo "[$(date -Is)] rewrote API_BASE -> $URL"
    # Also ensure CORS origin is allowed (best-effort; backend reads from main.py)
    git add index.html
    git commit -m "🔧 auto: API_BASE -> $URL (tunnel autostart)" || true
    git push origin master:main || echo "[$(date -Is)] push failed (will retry next run)"
  else
    echo "[$(date -Is)] API_BASE already up to date"
  fi
fi

# Rewrite MINI_APP_URL in .env (bot reads it at startup).
# ВАЖНО: пишем СТАБИЛЬНЫЙ GitHub Pages URL, а НЕ эфемерный ngrok!
# Иначе бот ведёт на ngrok, который меняется при каждом рестарте туннеля,
# и приходится менять Web App URL в боте вручную. GitHub Pages статичен,
# а фронт сам стучит в актуальный бэкенд через API_BASE (ниже).
MINI_APP_URL_STABLE="https://baronantonov.github.io/opendeck/"
if [ -f .env ]; then
  if grep -q "MINI_APP_URL=" .env; then
    sed -i "s#^MINI_APP_URL=.*#MINI_APP_URL=$MINI_APP_URL_STABLE#" .env
  else
    echo "MINI_APP_URL=$MINI_APP_URL_STABLE" >> .env
  fi
  echo "[$(date -Is)] updated .env MINI_APP_URL -> $MINI_APP_URL_STABLE (stable)"
fi

echo "[$(date -Is)] tunnel wrapper ready, holding ngrok (pid=$NGROK_PID)"
# Keep running so systemd Restart does not loop unnecessarily
wait "$NGROK_PID"
