# Деплой на VPS без Docker (чистый systemd + Caddy).
# Подходит, если не хочешь возиться с Docker. Один раз на сервере.

## 1. Установка (Debian/Ubuntu)
#   sudo apt update && sudo apt install -y python3-venv python3-pip caddy
#   sudo useradd -m -s /bin/bash djapp
#   sudo mkdir -p /opt/dj-school && sudo chown djapp:djapp /opt/dj-school

## 2. Залить код
#   scp -r . djapp@VPS:/opt/dj-school/

## 3. venv + зависимости
#   sudo -u djapp bash -c 'cd /opt/dj-school && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'

## 4. Секреты
#   sudo -u djapp nano /opt/dj-school/.env
#   BOT_TOKEN=...
#   MINI_APP_URL=https://dj-school.ВАШ-ДОМЕН.tld

## 5. systemd-юниты (от root)
#   sudo tee /etc/systemd/system/dj-backend.service >/dev/null <<'EOF'
#   [Unit]
#   Description=DJ School Backend
#   After=network.target
#   [Service]
#   User=djapp
#   WorkingDirectory=/opt/dj-school
#   EnvironmentFile=/opt/dj-school/.env
#   ExecStart=/opt/dj-school/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
#   Restart=always
#   [Install]
#   WantedBy=multi-user.target
#   EOF

#   sudo tee /etc/systemd/system/dj-bot.service >/dev/null <<'EOF'
#   [Unit]
#   Description=DJ School Bot
#   After=network.target dj-backend.service
#   [Service]
#   User=djapp
#   WorkingDirectory=/opt/dj-school
#   EnvironmentFile=/opt/dj-school/.env
#   ExecStart=/opt/dj-school/.venv/bin/python -m bot.main
#   Restart=always
#   [Install]
#   WantedBy=multi-user.target
#   EOF

#   sudo systemctl daemon-reload
#   sudo systemctl enable --now dj-backend dj-bot

## 6. Caddy (HTTPS автоматом)
#   sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
#   dj-school.ВАШ-ДОМЕН.tld {
#       reverse_proxy 127.0.0.1:8000
#   }
#   EOF
#   sudo systemctl restart caddy

## 7. В @BotFather -> /newapp -> Web App URL = https://dj-school.ВАШ-ДОМЕН.tld
