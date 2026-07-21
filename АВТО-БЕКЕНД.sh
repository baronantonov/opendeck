#!/bin/bash
# АВТО-БЕКЕНД: гарантирует, что uvicorn жив на порту 8000.
# Если упадёт — сторож сам поднимет.
# Ты просто запускаешь: "bash АВТО-БЕКЕНД.sh" — и забываешь навсегда.

cd "$(dirname "$0")"
echo "🔧 Сторож бекенда запущен (порт 8000)"
echo "   При падении — автоматически перезапустится"
echo ""

# убиваем процессы прошлого (если есть зависшие)
pkill -f "uvicorn backend.main:app" 2>/dev/null
sleep 1

while true; do
  # лёгкая проверка: жив ли бекенд
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:8000/ 2>/dev/null)
  if [ "$CODE" != "200" ]; then
    echo "[$(date '+%H:%M:%S')] бекенд упал (код=$CODE), поднимаю..."
    nohup python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 >> backend.log 2>&1 &
    sleep 2
    echo "[$(date '+%H:%M:%S')] поднят заново."
  fi
  sleep 5
done
