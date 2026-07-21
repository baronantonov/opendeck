#!/bin/bash
# Автоперезапуск туннеля с закреплённым именем opendeck-tma.loca.lt
# Ссылка на приложение: https://opendeck-tma.loca.lt (постоянная!)
cd "$(dirname "$0")"

echo "🔄 Сторож туннеля запущен. Ссылка:"
echo "   https://opendeck-tma.loca.lt"
echo "   (закреплена навсегда)"
echo ""

# сначала убить старые туннели, чтобы не конфликтовали
pkill -f "lt --port 8000" 2>/dev/null
sleep 1

# запустить сторож: если lt упадёт — поднимаем заново
while true; do
  echo "[$(date '+%H:%M:%S')] поднимаю туннель..."
  lt --port 8000 --subdomain opendeck-tma 2>&1
  echo "[$(date '+%H:%M:%S')] туннель упал, перезапуск через 3 сек..."
  sleep 3
done
