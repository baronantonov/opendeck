#!/bin/bash
# ОДНА КОМАНДА = ПОЛНЫЙ АПДЕЙТ СТЕНДА.
# Запускай это — и не придётся держать ничего в голове.

cd "$(dirname "$0")"

echo "🔥 Поднимаю всё одним движением..."
echo ""

# 1. бекенд (если упал — поднимется)
echo "[1/3] бекенд: проверка + автоподъём если надо"
pkill -f "uvicorn backend.main:app" 2>/dev/null
sleep 1
nohup python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 >> backend.log 2>&1 &

# 2. туннель (постоянный, через SSH-ключ)
echo "[2/3] туннель: поднимаю opendeck-tma.serveousercontent.com"
pkill -f "ssh.*serveo.net" 2>/dev/null
sleep 1
nohup ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
        -o IdentitiesOnly=yes -i "tunnel-keys/id_ed25519" \
        -R opendeck-tma:80:localhost:8000 serveo.net >> tunnel.log 2>&1 &

# 3. финальная проверка
echo "[3/3] жду подъёма (8 сек)..."
sleep 8

BACKEND=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:8000/ 2>/dev/null)
TUNNEL=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://opendeck-tma.serveousercontent.com/ 2>/dev/null)

echo ""
echo "──────────────────────────────────────"
echo "  Локальный бекенд: $BACKEND"
echo "  Хост (через TG): $TUNNEL"
echo "──────────────────────────────────────"
echo ""
if [ "$BACKEND" = "200" ] && [ "$TUNNEL" = "200" ]; then
  echo "✅ Всё работает. Бот: @OpenDeck_bot → menu button"
  echo "   Ссылка (навсегда): https://opendeck-tma.serveousercontent.com"
else
  echo "❌ Что-то мертво. См. логи: backend.log, tunnel.log"
fi
