"""Валидация Telegram init_data (алгоритм из документации TG).

hash = HMAC_SHA256(data_check_string, key=HMAC_SHA256("WebAppData", bot_token))
data_check_string = "k=v\n..." отсортированный по ключам (без hash).
"""
from __future__ import annotations
import hmac, hashlib
from urllib.parse import parse_qsl


def verify_init_data(init_data: str, bot_token: str) -> dict | None:
    try:
        data = dict(parse_qsl(init_data, keep_blank_values=True))
    except Exception:
        return None
    received_hash = data.pop("hash", None)
    if not received_hash:
        return None
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, received_hash):
        return None
    return data  # {'user': '{...}', 'auth_date': '...', 'query_id': '...', ...}


def _build_valid_init_data(bot_token: str, user_id: int) -> str:
    """Тестовая утилита: генерирует валидный init_data тем же алгоритмом."""
    import urllib.parse
    data = {
        "auth_date": "1700000000",
        "query_id": "test_query",
        "user": f'{{"id":{user_id},"first_name":"Tester"}}',
    }
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    h = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    data["hash"] = h
    return urllib.parse.urlencode(data)
