"""TON Connect — нативно для TMA, комиссия сети ~0.1%.

Юзер платит из TON-кошелька (Tonkeeper и т.п.) прямо в Mini App.
После перевода проверяем транзакцию через TON RPC (toncenter).
"""
from __future__ import annotations
import httpx
from bot.payments.base import PaymentProvider, PaymentInvoice
from bot import config

# Сумма в TON за курс (курс можно брать из оракула; тут — фикса для примера)
TON_PRICE = 1.5


class TonProvider(PaymentProvider):
    @property
    def name(self) -> str:
        return "ton"

    async def create_invoice(self, user_id: int, course_id: str, amount_label: str) -> PaymentInvoice:
        # В Mini App фронт дёрнет TON Connect SDK:
        #   tonConnectUI.sendTransaction({ validUntil, messages:[{address: WALLET, amount: toNano(TON_PRICE)}] })
        # url_or_payload здесь — адрес получателя + сумма (для фронта).
        return PaymentInvoice(
            provider=self.name,
            url_or_payload=config.TON_MERCHANT_WALLET,
            meta={"wallet": config.TON_MERCHANT_WALLET, "amount_ton": TON_PRICE, "course": course_id},
        )

    async def verify(self, payload: dict) -> bool:
        # payload = {tx_hash: "..."} — проверяем в блокчейне через RPC
        tx_hash = payload.get("tx_hash")
        if not tx_hash:
            return False
        async with httpx.AsyncClient() as c:
            r = await c.post(config.TON_RPC, json={
                "jsonrpc": "2.0", "id": 1, "method": "getTransactions",
                "params": {"address": config.TON_MERCHANT_WALLET, "limit": 20},
            })
            data = r.json()
        # Упрощённо: ищем tx_hash среди последних транзакций.
        # В проде — сверять сумму и from-адрес юзера.
        txs = data.get("result", [])
        return any(t.get("transaction_id", {}).get("hash") == tx_hash for t in txs)
