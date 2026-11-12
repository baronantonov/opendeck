"""Bot configuration — minimal, version-busted Mini App URL + payment params.

Principles (from config): no fallback logic, no overengineering, brevity,
clarity on ambiguous scope, architectural changes not workarounds.
"""
import os
import subprocess as sp
from datetime import date
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# --- Essential bot config ---
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://ВАШ-ДОМЕН.tld")

# --- Version-busting: ?v=<git-hash> forces Telegram to reload WebView ---
def _mini_app_version() -> str:
    v = os.getenv("MINI_APP_VERSION")
    if v:
        return v
    try:
        r = sp.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=Path(__file__).resolve().parent.parent,
            capture_output=True, text=True, timeout=3,
        )
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip()
    except Exception:
        pass
    return date.today().isoformat()

def mini_app_url() -> str:
    """Return MINI_APP_URL with current ?v=<git-hash>.
    Recalculated EVERY call (not at import), otherwise Telegram caches old URL.
    """
    url = MINI_APP_URL
    if url in ("https://ВАШ-ДОМЕН.tld", ""):
        return url
    base = url.split("?")[0]
    return f"{base}?v={_mini_app_version()}"

MINI_APP_URL = mini_app_url()

# --- Payment params (prices in Stars/XTR) ---
# Set in backend/main.py; here only for direct invoice-through-bot params.
STARS_PRICE = 199   # legacy — not used, invoice via backend /api/create-invoice
MENTOR_PRICE = 300  # Stars for mentoring
MENTOR_GP_MAX = 1030  # max GP write-off

# Internal API key (bot → backend)
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

# --- TON Connect (optional) ---
TON_NETWORK = os.getenv("TON_NETWORK", "mainnet")
TON_MERCHANT_WALLET = os.getenv("TON_MERCHANT_WALLET", "")
TON_RPC = os.getenv("TON_RPC", "https://toncenter.com/api/v2/jsonRPC")

# --- Prodamus (fiat redirect via openLink) ---
PRODAMUS_PAYFORM_URL = os.getenv("PRODAMUS_PAYFORM_URL", "")
PRODAMUS_SECRET_KEY = os.getenv("PRODAMUS_SECRET_KEY", "")
PRODAMUS_SYS_CODE = os.getenv("PRODAMUS_SYS_CODE", "")
PRODAMUS_API_KEY = os.getenv("PRODAMUS_API_KEY", "")

# Backend (где живёт раздача уроков / выдача доступа)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# --- Tribute (card/SBP/USDT) for mentorship ---
TRIBUTE_API_KEY = os.getenv("TRIBUTE_API_KEY", "")
TRIBUTE_WEBHOOK_URL = os.getenv("TRIBUTE_WEBHOOK_URL", "")
TRIBUTE_MENTOR_PRODUCT_ID = os.getenv("TRIBUTE_MENTOR_PRODUCT_ID", "")