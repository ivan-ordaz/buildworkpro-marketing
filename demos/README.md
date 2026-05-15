# BuildWorkPro Demos

Programmatic marketing-video pipeline. One JSON script → captured app footage → AI narration → finished MP4.

```
scripts/*.json          # Demo script (scenes, actions, narration)
   │
   ├─► capture.ts       # Playwright drives the app, records each scene
   │       └── output/<slug>/scene-N.webm
   │
   ├─► narrate.ts       # ElevenLabs TTS, one mp3 per scene
   │       └── output/<slug>/scene-N.mp3
   │
   └─► remotion render  # Composes scene clips + audio + captions
           └── output/<slug>/final.mp4
```

## Setup

```bash
cd demos
npm install
npx playwright install chromium
cp .env.example .env       # fill in ELEVENLABS_API_KEY, demo creds
```

## Run

```bash
npm run build -- scripts/01-create-contact.json     # full pipeline
npm run capture -- scripts/01-create-contact.json   # just record
npm run narrate -- scripts/01-create-contact.json   # just TTS
npm run studio                                       # interactive Remotion editor
```

## Adding a new demo

1. Copy `scripts/01-create-contact.json` to `scripts/02-<your-demo>.json`.
2. Edit `scenes[]`: each scene has `actions` (Playwright steps) and a `narration` line.
3. `npm run build -- scripts/02-<your-demo>.json`.

## Voice

Default voice is the ElevenLabs "Adam" pre-made voice. To use a cloned brand voice:

1. Clone your voice in the ElevenLabs UI (6+ seconds of clean audio).
2. Copy the voice_id into `.env` as `ELEVENLABS_VOICE_ID`.

## Outputs

- `final.mp4` — the marketing video (1080p, 30fps by default).
- `transcript.txt` — concatenated narration text for YouTube descriptions, blog posts, captions.
- Per-scene `.webm` and `.mp3` files for inspection or re-editing.
