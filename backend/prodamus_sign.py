"""Общая логика подписи/проверки webhook Prodamus.

Мануал: https://help.prodamus.ru/payform/integracii/rest-api/instrukcii-dlya-samostoyatelnaya-integracii-servisov
Webhook от Prodamus приходит как POST form-data + заголовок `Sign`.
Подпись формируется по тем же правилам, что и при создании ссылки:
  Hmac::verify(POST, secret_key, headers['Sign'])
  -> берём все поля КРОМЕ signature/Sign, приводим к строкам, сортируем ключи,
     json, экранируем '/', HMAC-SHA256 секретом, сравниваем с заголовком.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from typing import Mapping


def _flatten(d: Mapping, prefix: str = "") -> dict:
    out: dict = {}
    for k, v in d.items():
        key = f"{prefix}[{k}]" if prefix else str(k)
        if isinstance(v, dict):
            out.update(_flatten(v, key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    out.update(_flatten(item, f"{key}[{i}]"))
                else:
                    out[f"{key}[{i}]"] = item
        else:
            out[key] = v
    return out


def _compute_signature(fields: Mapping, secret: str) -> str:
    flat = _flatten(dict(fields))
    str_vals = {k: ("" if v is None else str(v)) for k, v in flat.items()}
    ordered = dict(sorted(str_vals.items()))
    raw = json.dumps(ordered, ensure_ascii=False, separators=(",", ":"))
    raw_escaped = raw.replace("/", "\\/")
    return hmac.new(
        secret.encode("utf-8"),
        raw_escaped.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def sign_params(params: Mapping, secret: str) -> str:
    """Подпись для формирования платёжной ссылки (без поля signature)."""
    clean = {k: v for k, v in params.items() if k != "signature"}
    return _compute_signature(clean, secret)


def verify_webhook(form_data: Mapping, secret: str, signature_header: str | None) -> bool:
    """Проверка подписи входящего webhook от Prodamus.

    form_data — словарь полей POST (form-data). Исключаем заголовок `Sign`
    и любое поле `signature`, оставшиеся поля подписываем секретом.
    """
    if not signature_header:
        return False
    clean = {k: v for k, v in form_data.items() if k not in ("signature", "Sign")}
    expected = _compute_signature(clean, secret)
    return hmac.compare_digest(expected, signature_header)
