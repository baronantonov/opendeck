# Запуск MVP локально (Windows + WSL2)

## 1. Окружение
```bash
cd dj-school-tma
python -m venv .venv && source .venv/bin/activate   # или .venv\Scripts\activate на Windows
pip install "aiogram>=3" fastapi uvicorn httpx
```

## 2. Тесты (без сети)
```bash
python tests/test_backend.py   # 12 PASS — доступ, init_data, webhook Prodamus
python tests/test_bot.py       # провайдеры + выдача доступа
```

## 3. Запуск бэкенда (отдаёт Mini App + уроки)
```bash
export BOT_TOKEN=ВАШ_ТОКЕН
python -m uvicorn backend.main:app --port 8000
# Mini App: http://localhost:8000/
```

## 4. Публичный HTTPS для Telegram (ngrok — тест)
```bash
ngrok http 8000
# скопируй https-URL из вывода в bot/config.py -> MINI_APP_URL
```

## 5. Запуск бота
В @BotFather: /newapp -> привязать к боту -> Web App URL = ngrok-https
```bash
export BOT_TOKEN=ВАШ_ТОКЕН
export MINI_APP_URL=https://abc123.ngrok-free.app
python -m bot.main
```
В Telegram: /start -> «Открыть курс» или «Купить за Stars».

## 6. Что проверено (реально)
- Раздача Mini App, валидация init_data (HMAC), скрытие/открытие уроков
- Webhook Prodamus с HMAC-подписью
- Фабрика платежей (Stars/TON/Prodamus) и выдача доступа после оплаты

## 7. Что нужно добавить для продакшна
- Реальные ключи TON / Prodamus
- HLS-видео (ffmpeg) + nginx secure_link
- Геймификация (стрики/тесты) в miniapp/index.html
- HTTPS-домен (не ngrok) для стабильной работы
