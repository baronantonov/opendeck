#!/usr/bin/env bash
# ============================================================
# Oracle VPS — перекодировка урока в HLS (защищённый формат)
# Запуск:  ./transcode.sh <входной_файл.mp4> <номер_урока>
# Пример: ./transcode.sh ~/Downloads/urok1.mp4 1
# Результат: /srv/dj-school/video/1/index.m3u8
# ============================================================
set -e
IN="$1"
N="$2"
OUT="/srv/dj-school/video/$N"
mkdir -p "$OUT"

# HLS: один master + качество 720p, сегменты по 6 сек, ключ каждые 6 сегментов
ffmpeg -y -i "$IN" \
  -profile:v main -level 3.1 -s 1280x720 -start_number 0 \
  -hls_time 6 -hls_list_size 0 -hls_flags independent_segments \
  -hls_key_info_file /srv/dj-school/keys/keyinfo.txt \
  -f hls "$OUT/index.m3u8"

echo "Готово: $OUT/index.m3u8"
