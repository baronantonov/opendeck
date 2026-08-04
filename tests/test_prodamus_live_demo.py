"""РЕАЛЬНЫЙ тест интеграции Prodamus на демо-форме.

Использует публичную демо-платёжную страницу Prodamus из мануала:
  URL:  https://demo.payform.ru/
  KEY:  2y2aw4oknnke80bp1a8fniwuuq7tdkwmmuq7vwi4nzbr8z1182ftbn6p8mhw3bhz
  SYS:  (любой, для демо не валидируется жёстко)

Проверяет, что наша функция sign_params() даёт подпись, которую demo.payform.ru
ПРИНИМАЕТ, и возвращает реальную платёжную ссылку (не заглушку).

Запуск: .venv/bin/python tests/test_prodamus_live_demo.py
"""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from bot.payments.prodamus import ProdamusProvider, sign_params
from bot import config

DEMO_URL = "https://demo.payform.ru/"
DEMO_KEY = "2y2aw4oknnke80bp1a8fniwuuq7tdkwmmuq7vwi4nzbr8z1182ftbn6p8mhw3bhz"

async def main():
    # подменяем конфиг на демо-значения (без трогания .env)
    config.PRODAMUS_PAYFORM_URL = DEMO_URL
    config.PRODAMUS_SECRET_KEY = DEMO_KEY
    config.PRODAMUS_SYS_CODE = "demo"
    config.BACKEND_URL = "http://localhost:8000"

    prov = ProdamusProvider()
    print(f"➡️  Отправляем реальный POST на {DEMO_URL} ...")
    inv = await prov.create_invoice(123456, "dj-basics", "100 RUB")
    print("   meta:", inv.meta)
    if inv.url_or_payload and inv.url_or_payload.startswith("http"):
        print("✅ РЕАЛЬНЫЙ ОТВЕТ Prodamus ПОЛУЧЕН:")
        print("   🔗", inv.url_or_payload)
        print("   (открой в браузере — это настоящая демо-страница оплаты)")
        return 0
    else:
        print("❌ Ссылка не получена. Ответ Prodamus:")
        print("   ", inv.meta)
        return 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
