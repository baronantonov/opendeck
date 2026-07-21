#!/bin/bash
# ОБНОВИТЬ: перезалить свежую версию на хост без потери работающего туннеля.
# Шаг 1 — проверить, что тебе нравится текущая версия.
# Шаг 2 — закоммитить (сохранить) + перезапустить бекенд, чтобы он подхватил новый index.html.
# Шаг 3 — PUSH в GitHub (если настроишь удалённый репозиторий), иначе просто локальный git.

cd "$(dirname "$0")"

# --- настройки ---
BOT_TOKEN="${BOT_TOKEN:-TEST_BOT_TOKEN}"
PYTHON="${PYTHON:-python}"

echo "📦 Обновление: сборка свежей версии"

# сохраняем снимок (чтобы можно было откатить)
echo "[1/4] сохраняю снимок текущей версии в git..."
git add -A
git commit -m "Обновление от $(date '+%d.%m.%Y %H:%M')" 2>&1 | tail -1 || true

echo "[2/4] перезапускаю бекенд, чтобы он подхватил свежий index.html..."
pkill -f "uvicorn backend.main:app" 2>/dev/null
sleep 1
nohup $PYTHON -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 >> backend.log 2>&1 &

echo "[3/4] проверяю, что всё живо..."
sleep 3
BACKEND=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:8000/ 2>/dev/null)
TUNNEL=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://opendeck-tma.serveousercontent.com/ 2>/dev/null)
echo "  локальный бекенд: $BACKEND"
echo "  туннель снаружи:  $TUNNEL"

echo "[4/4] готово!"
echo "   📡 ссылка навсегда: https://opendeck-tma.serveousercontent.com"
echo ""
if [ "$BACKEND" = "200" ] && [ "$TUNNEL" = "200" ]; then
  echo "✅ Обновление применено. Бот видит свежую версию."
else
  echo "⚠️  Что-то не отвечает. Проверь: tail -f backend.log"
fi
