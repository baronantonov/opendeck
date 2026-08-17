#!/usr/bin/env bash
# Open Deck TMA — frontend deploy helper.
#
# The backend serves the root index.html via GET / and GitHub Pages also expects
# a root index.html, so we build the Vite/React/Tailwind app into a single
# self-contained file (vite-plugin-singlefile) and copy it onto index.html.
#
# Usage: bash frontend/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
DIST="$FRONTEND/dist"
TARGET="$ROOT/index.html"

cd "$FRONTEND"
echo "→ installing deps (if needed)"
[ -d node_modules ] || npm install --no-audit --no-fund

echo "→ type-check"
npx tsc --noEmit

echo "→ building single-file bundle"
npm run build

if [ ! -f "$DIST/index.html" ]; then
  echo "✕ build did not produce $DIST/index.html" >&2
  exit 1
fi

# Preserve a timestamped backup of the previous root index.html (the legacy build).
if [ -f "$TARGET" ]; then
  BACK="$ROOT/backups/opendeck-html-$(date +%Y%m%d_%H%M%S).html"
  mkdir -p "$(dirname "$BACK")"
  cp "$TARGET" "$BACK"
  echo "→ backed up previous index.html -> $BACK"
fi

cp "$DIST/index.html" "$TARGET"
echo "✓ deployed frontend -> $TARGET ($(wc -c < "$TARGET") bytes)"

echo
echo "Next steps (require user / tokens):"
echo "  - Push index.html to GitHub Pages (vetka main):  git push origin master:main"
echo "  - Or place $TARGET behind the backend GET / (no change needed there)."
echo "  - Bump version-bust marker if backend serves cached copy."
