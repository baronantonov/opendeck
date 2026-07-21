#!/bin/bash
# Постоянный туннель: берёт адрес из последнего запуска ssh и поднимает заново.
# Если туннель падает, ссылка будет другая (без SSH-ключа).
# Тебе делать: вставить адрес в BotFather один раз, ссылка появится через ~5 сек.

cd "$(dirname "$0")"

# уничтожаем старые ssh/serveo процессы
pkill -f "ssh.*serveo.net" 2>/dev/null
pkill -f "АВТО-ТУННЕЛЬ" 2>/dev/null
sleep 1

while true; do
  echo "[$(date '+%H:%M:%S')] поднимаю постоянный туннель serveo..."
  ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes \
      -R 80:localhost:8000 serveo.net 2>&1 | grep -i "HTTP traffic from" | head -1
  echo "[$(date '+%H:%M:%S')] туннель упал, перезапуск через 3 сек..."
  sleep 3
done
