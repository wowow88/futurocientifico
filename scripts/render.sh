#!/usr/bin/env bash
set -euo pipefail

# Inputs
IMAGE_URL="${1:-}"
OUT_NAME="${2:-output.mp4}"
TEXT1="${3:-'FuturoCientífico 🚀 Ciencia en 1 minuto'}"
TEXT2="${4:-'Descripción del artículo'}"
TEXT3="${5:-'#Ciencia #Curiosidades #FuturoCientífico'}"
TEXT4="${6:-'IG: @futurocientifico2025 • TikTok: @futurocientifico • X: @futuro100tico • YouTube: @futurocientifico'}"
MUSIC_URL="${7:-}"          # opcional
DURATION="${8:-15}"         # duración en segundos (Shorts/Stories)

# Archivos temporales
WORKDIR="$(pwd)"
IMG="$WORKDIR/bg.jpg"
MUSIC="$WORKDIR/music.mp3"
VIDEO_BG="$WORKDIR/bg1080x1920.mp4"
OUT="$WORKDIR/$OUT_NAME"

# Descargas
curl -L "$IMAGE_URL" -o "$IMG"
if [[ -n "$MUSIC_URL" ]]; then
  curl -L "$MUSIC_URL" -o "$MUSIC" || true
fi

# Asegura ffmpeg en GH Actions ubuntu-latest (ya viene), si corres local:
# sudo apt-get update && sudo apt-get install -y ffmpeg

# Prepara fondo (Ken Burns suave + blur para cubrir 1080x1920 sin bordes)
# 1) Escala la imagen y rellena a 1080x1920
ffmpeg -y -loop 1 -t "$DURATION" -i "$IMG" \
  -filter_complex "\
    scale=1080:1920:force_original_aspect_ratio=cover,\
    zoompan=z='min(zoom+0.0015,1.05)':d=25*${DURATION}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',\
    boxblur=5" \
  -r 30 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 18 "$VIDEO_BG"

# Fuentes (DejaVu suele estar en /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf)
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Función para escapar texto para drawtext
esc() { echo "$1" | sed "s/:/\\\:/g; s/'/\\\'/g; s/\\[/\\\\[/g; s/\\]/\\\\]/g"; }

E1=$(esc "$TEXT1")
E2=$(esc "$TEXT2")
E3=$(esc "$TEXT3")
E4=$(esc "$TEXT4")

# Overlays de texto
# Colocación:
#  - T1 arriba (título fijo)
#  - T2 centro (descripción)
#  - T3 abajo-izq (hashtags)
#  - T4 abajo (redes)
TEXT_FILTER="\
[0:v]drawtext=fontfile=${FONT}:text='${E1}':x=(w-text_w)/2:y=80:fontsize=56:fontcolor=white:box=1:boxcolor=0x00000088:line_spacing=8,\
drawtext=fontfile=${FONT}:text='${E2}':x=60:y=(h/2-text_h/2):fontsize=48:fontcolor=white:box=1:boxcolor=0x00000088:line_spacing=10:wrap=1:fix_bounds=1,\
drawtext=fontfile=${FONT}:text='${E3}':x=60:y=h-320:fontsize=44:fontcolor=white:box=1:boxcolor=0x00000088:line_spacing=8,\
drawtext=fontfile=${FONT}:text='${E4}':x=(w-text_w)/2:y=h-160:fontsize=40:fontcolor=white:box=1:boxcolor=0x00000088"

if [[ -f "$MUSIC" ]]; then
  ffmpeg -y -i "$VIDEO_BG" -stream_loop -1 -i "$MUSIC" \
    -filter_complex "$TEXT_FILTER[a];[1:a]volume=0.8,atrim=0:${DURATION},asetpts=PTS-STARTPTS[aud]" \
    -map "[a]" -map "[aud]" \
    -shortest -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 128k "$OUT"
else
  ffmpeg -y -i "$VIDEO_BG" -vf "$TEXT_FILTER" \
    -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p "$OUT"
fi

echo "OK :: $OUT"
