#!/usr/bin/env bash
# bump-version.sh — авто-version-bust для Open Deck TMA.
#
# Что делает:
#   1. git push origin master:main (деплой фронта на GitHub Pages)
#   2. берёт короткий git-hash HEAD
#   3. вшивает <!--opendeck-version:HASH--> в <head> index.html (через python)
#   4. коммитит + пушит version-пин
#   5. печатает актуальную ссылку ?v=HASH для BotFather / шаринга
#
# Почему это нужно: Telegram агрессивно кэширует Mini App по URL.
# Если открыть baronantonov.github.io/opendeck/ БЕЗ ?v=, TG отдаёт
# закэшированную старую страницу (симптом: "кусок кода без подложки"
# после правок фронта). Version-busting (?v=HASH) заставляет TG
# перезагрузить WebView. Бот уже добавляет ?v= через bot/config.py,
# но прямая ссылка — нет. Этот скрипт даёт свежую ссылку всегда.
# Плюс фронт сам перезагружается при смене маркера (localStorage-проверка).
#
# Использование:  bash bump-version.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

# 1. Деплой
echo "==> git push origin master:main"
git push origin master:main

# 2. Хэш
HASH="$(git rev-parse --short HEAD)"
echo "==> version: $HASH"

# 3. Вшить маркер версии в <head> index.html (replace старого или добавление)
python3 - <<PY
import re
p = "index.html"
s = open(p, encoding="utf-8").read()
marker = f"<!--opendeck-version:{__import__('subprocess').check_output(['git','rev-parse','--short','HEAD']).decode().strip()}-->"
# убираем старый маркер, если есть
s = re.sub(r"<!--opendeck-version:[0-9a-f]+-->", "", s)
# вшиваем сразу после <head>
s = s.replace("<head>", f"<head>\n  {marker}", 1)
open(p, "w", encoding="utf-8").write(s)
print("==> opendeck-version pinned in index.html")
PY

# 4. Коммит + пуш пина
git add index.html
git commit -m "[deploy] bump opendeck-version to $HASH (version-bust для Telegram WebView)" || echo "(already pinned)"
git push origin master:main

# 5. Ссылка
echo ""
echo "==> Свежая ссылка Mini App (вставь в BotFather / шари):"
echo "    https://baronantonov.github.io/opendeck/?v=$HASH"
echo ""
echo "==> Для сброса кэша у юзеров: попроси переоткрыть по этой ссылке,"
echo "    либо в TG: Settings -> Advanced -> Clear cache (или перезапуск бота)."
