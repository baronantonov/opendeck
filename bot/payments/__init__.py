"""Фабрика провайдеров. Добавляешь новый — регистрируй тут, бот не меняется."""
from bot.payments.base import PaymentProvider
from bot.payments.stars import StarsProvider
from bot.payments.ton import TonProvider
from bot.payments.prodamus import ProdamusProvider

_PROVIDERS = {
    "stars": StarsProvider,
    "ton": TonProvider,
    "prodamus": ProdamusProvider,
}


def get_provider(name: str) -> PaymentProvider:
    if name not in _PROVIDERS:
        raise ValueError(f"Unknown provider: {name}. Available: {list(_PROVIDERS)}")
    return _PROVIDERS[name]()
