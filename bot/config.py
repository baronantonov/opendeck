"""Конфигурация бота.

Все секреты — через переменные окружения. Для удобства локально можно
положить их в .env (подхватит python-dotenv). Никогда не коммить .env!

Ключевое для привязки Mini App:
  MINI_APP_URL — ПУБЛИЧНЫЙ https, который отдаёт backend (GET /).
  В BotFather -> /newapp -> Web App URL = тот же MINI_APP_URL.
"""
import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://ВАШ-ДОМЕН.tld")

# Telegram Stars: цена в Stars (XTR) за курс
STARS_PRICE = 199

# TON Connect
TON_NETWORK = os.getenv("TON_NETWORK", "mainnet")
TON_MERCHANT_WALLET = os.getenv("TON_MERCHANT_WALLET", "")
TON_RPC = os.getenv("TON_RPC", "https://toncenter.com/api/v2/jsonRPC")

# Prodamus (внешний редирект через openLink)
PRODAMUS_API_KEY = os.getenv("PRODAMUS_API_KEY", "")
PRODAMUS_SHOP_ID = os.getenv("PRODAMUS_SHOP_ID", "")
PRODAMUS_WEBHOOK_SECRET = os.getenv("PRODAMUS_WEBHOOK_SECRET", "")

# Backend (где живёт раздача уроков / выдача доступа)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
