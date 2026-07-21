"""Валидация Telegram init_data (алгоритм из документации TG).

hash = HMAC_SHA256(data_check_string, key=HMAC_SHA256("WebAppData", bot_token))
data_check_string = "k=v\n..." отсортированный по ключам (без hash).
"""
from __future__ import annotations
import hmac, hashlib, time
from urllib.parse import parse_qsl


def verify_init_data(init_data: str, bot_token: str) -> dict | None:
    try:
        data = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        return None
    received_hash = data.pop("hash", None)
    if not received_hash:
        return None
    # проверка устаревания init_data (Telegram рекомендует 5 минут)
    auth_date = int(data.get("auth_date", 0))
    if time.time() - auth_date > 300:
        return None
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, received_hash):
        return None
    return data  # {'user': '{...}', 'auth_date': '...', 'query_id': '...', ...}
