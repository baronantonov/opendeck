"""Конфигурация. Скопируй в config.py и впиши свои ключи."""
import os

# Telegram
BOT_TOKEN = os.getenv("BOT_TOKEN", "ТВОЙ_БОТ_ТОКЕН_ОТ_@BotFather")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://ТВОЙ-ДОМЕН.tld")

# Telegram Stars: цена в Stars (нативно для цифровых товаров)
STARS_PRICE = 199  # 199 Stars за курс

# TON Connect
TON_NETWORK = os.getenv("TON_NETWORK", "mainnet")  # или testnet
TON_MERCHANT_WALLET = os.getenv("TON_MERCHANT_WALLET", "UQ...")  # твой TON-кошелёк
TON_RPC = os.getenv("TON_RPC", "https://toncenter.com/api/v2/jsonRPC")

# Prodamus (внешний редирект, вне webview)
PRODAMUS_API_KEY = os.getenv("PRODAMUS_API_KEY", "")
PRODAMUS_SHOP_ID = os.getenv("PRODAMUS_SHOP_ID", "")
PRODAMUS_WEBHOOK_SECRET = os.getenv("PRODAMUS_WEBHOOK_SECRET", "")

# Backend
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
