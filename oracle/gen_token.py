#!/usr/bin/env python3
# ============================================================
# Oracle VPS — генератор ПОДПИСАННЫХ ссылок на видео.
# Видео отдаётся nginx ТОЛЬКО с валидным md5-токеном + сроком.
# Запуск:  python3 gen_token.py <номер_урока> [часы_жизни]
# Пример:  python3 gen_token.py 1 24
# Вывод:   полную ссылку, которую впишем в miniapp/index.html
# ============================================================
import sys, hashlib, time

import os
SECRET = os.environ.get("VIDEO_SECRET", "")
if not SECRET:
    print("❌ Установи VIDEO_SECRET!")
    sys.exit(1)          # ДОЛЖЕН совпадать с nginx.conf (secure_link_md5)
URI    = "/video/{n}/index.m3u8"    # путь как в nginx root (/srv/dj-school/video/{n}/index.m3u8)
BASE   = "https://video.TVOY-DOMEN.tld"

def gen(n, hours=24):
    uri = URI.format(n=n)
    expires = int(time.time()) + hours*3600
    # nginx считает md5(SECRET+uri+expires) в hex
    md5 = hashlib.md5(f"{SECRET}{uri}{expires}".encode()).hexdigest()
    return f"{BASE}{uri}?md5={md5}&expires={expires}"

if __name__ == "__main__":
    n = sys.argv[1] if len(sys.argv) > 1 else "1"
    hrs = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    print(gen(n, hrs))
