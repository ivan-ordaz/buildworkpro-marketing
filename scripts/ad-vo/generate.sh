#!/usr/bin/env bash
#
# Adds a sound-on voiceover to the Meta ad video crops (9:16 Reels/Stories + 4:5 feed).
#
# Why: Meta's "Adopt Reels Performant Creative" recommendation flags that Reels/Stories
# favor 9:16 video WITH audio; our crops were silent screen-recordings. A spoken
# hook + value prop + CTA reinforces the on-screen captions for sound-on placements.
#
# How: ElevenLabs TTS (voice "Brian", model eleven_multilingual_v2, fixed seed for
# reproducibility) -> mastered for mobile (loudnorm + light EQ/compression) ->
# muxed over the EXISTING crops (video copied losslessly; only an audio track is added).
#
# Idempotent: re-running re-fetches the VO and re-muxes. Because it maps only the
# video stream of the input (0:v:0), running it again over an already-voiced crop
# just replaces the audio — the video is never re-encoded.
#
# Requires: ffmpeg, curl, python3, and an ElevenLabs API key at ~/.elevenlabs_key
# (key must have text_to_speech permission). The key is never printed.
#
# Usage: scripts/ad-vo/generate.sh            # all clips
#        scripts/ad-vo/generate.sh create-bid # one clip
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VID="$ROOT/public/videos"
VODIR="$ROOT/scripts/ad-vo"
KEYFILE="$HOME/.elevenlabs_key"

VOICE_ID="nPczCjzI2devNBz1zQrb"   # Brian — deep, authoritative American male
MODEL="eleven_multilingual_v2"
SEED=42                            # deterministic output for license-clean regeneration

[ -f "$KEYFILE" ] || { echo "ERROR: missing $KEYFILE" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ERROR: ffmpeg not found" >&2; exit 1; }

CLIPS=("create-bid" "pay-app-demo" "product-tour")
[ "$#" -gt 0 ] && CLIPS=("$@")

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

probe_dur () { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }

for clip in "${CLIPS[@]}"; do
  txt="$VODIR/$clip.txt"
  [ -f "$txt" ] || { echo "skip $clip: no $txt" >&2; continue; }
  echo "==> $clip"

  # --- 1. TTS via ElevenLabs (JSON-escape the script text with python3) ---
  body="$(python3 -c "import json,sys; print(json.dumps({
    'text': open(sys.argv[1]).read().strip(),
    'model_id': sys.argv[2],
    'seed': int(sys.argv[3]),
    'voice_settings': {'stability':0.45,'similarity_boost':0.8,'style':0.15,'use_speaker_boost':True}
  }))" "$txt" "$MODEL" "$SEED")"

  raw="$TMP/$clip.raw.mp3"
  http=$(curl -s -w "%{http_code}" -o "$raw" \
    -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID?output_format=mp3_44100_128" \
    -H "xi-api-key: $(cat "$KEYFILE")" -H "Content-Type: application/json" \
    -d "$body")
  if [ "$http" != "200" ]; then
    echo "  TTS FAILED (http $http): $(head -c 300 "$raw")" >&2; exit 1
  fi
  vodur=$(probe_dur "$raw")
  echo "  VO generated: ${vodur}s"

  # --- 2. Master for mobile: de-rumble, gentle compression, loudnorm, 0.15s lead-in ---
  master="$TMP/$clip.master.m4a"
  ffmpeg -v error -y -i "$raw" \
    -af "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=120,loudnorm=I=-14:TP=-1.0:LRA=11,adelay=150|150" \
    -c:a aac -b:a 192k -ar 44100 -ac 2 "$master"

  # --- 3. Mux into each crop (video copied; only audio added) ---
  for ratio in 9x16 4x5; do
    src="$VID/$clip-$ratio.mp4"
    [ -f "$src" ] || { echo "  WARN: $src missing, skipping" >&2; continue; }
    viddur=$(probe_dur "$src")
    out="$TMP/$clip-$ratio.out.mp4"
    ffmpeg -v error -y -i "$src" -i "$master" \
      -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k \
      -movflags +faststart "$out"
    mv "$out" "$src"
    printf "  muxed %-6s video=%ss vo=%ss\n" "$ratio" "${viddur%.*}" "${vodur%.*}"
  done
done

echo ""
echo "Done. Verify with:"
echo "  for f in $VID/{create-bid,pay-app-demo,product-tour}-{4x5,9x16}.mp4; do echo \"\$f\"; ffprobe -v error -show_entries stream=codec_type -of csv=p=0 \"\$f\"; done"
