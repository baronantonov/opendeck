# Dockerfile: Python 3.11, ставит зависимости, запускает от непривилегированного пользователя.
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 appuser \
    && mkdir -p /app/data \
    && chown -R appuser:appuser /app
USER appuser

# по умолчанию бэкенд; в compose переопределяем command для bot/caddy
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
