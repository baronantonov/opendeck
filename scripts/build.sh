#!/usr/bin/env bash
# Подставляет актуальный git short-hash HEAD в index.html вместо плейсхолдера
# __GIT_HASH__ (self version-busting для Telegram WebView). Идемпотентен:
# если хэш уже актуален — ничего не меняет.
set -euo pipefail

PROJECT_DIR="${1:-$PWD}"
cd "$PROJECT_DIR"

HTML="index.html"
PLACEHOLDER="__GIT_HASH__"

if [ ! -f "$HTML" ]; then
  echo "[build] $HTML not found, skip"
  exit 0
fi

HASH="$(git rev-parse --short HEAD 2>/dev/null || true)"
if [ -z "$HASH" ]; then
  echo "[build] no git hash, skip"
  exit 0
fi

# уже актуально?
if grep -q "selfVersionBust\|location.replace" "$HTML" && grep -q "__GIT_HASH__" "$HTML"; then
  : # ок, будем заменять
fi

if grep -q "$PLACEHOLDER" "$HTML"; then
  # заменяем плейсхолдер на хэш
  sed -i "s#$PLACEHOLDER#$HASH#g" "$HTML"
  echo "[build] injected ?v=$HASH into $HTML"
elif grep -q "const want = '$HASH'" "$HTML"; then
  echo "[build] already up to date (?v=$HASH)"
else
  # плейсхолдера нет, но есть старая вставка с другим хэшем — обновим
  sed -i "s#const want = '[0-9a-f]*';.*#const want = '$HASH';           // подставляется сборкой (git hash)#" "$HTML"
  echo "[build] updated ?v=$HASH in $HTML"
fi
