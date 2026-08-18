#!/usr/bin/env bash
# Build the CRM frontend and ship it as a single self-contained file to the
# repo root (backend serves GET /crm -> crm.html). Keeps the same filename the
# legacy vanilla CRM used, so no backend change is required.
set -euo pipefail
cd "$(dirname "$0")"

npm run build

ROOT="$(cd .. && pwd)"
mkdir -p ../backups
cp "$ROOT/crm.html" "../backups/crm-html-$(date +%Y%m%d_%H%M%S).html" 2>/dev/null || true
cp dist/index.html "$ROOT/crm.html"
echo "✓ CRM deployed -> $ROOT/crm.html"
