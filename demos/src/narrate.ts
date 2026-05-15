import fs from "node:fs/promises";
import path from "node:path";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { parseFile } from "music-metadata";
import { DemoScript, type SceneTiming } from "./types.js";
import { loadEnv } from "./env.js";

const DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"; // Adam pre-made
const DEFAULT_MODEL = "eleven_multilingual_v2";

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function narrateScript(scriptPath: string): Promise<{ outDir: string; clips: Array<{ sceneId: string; audioPath: string; durationMs: number }> }> {
  loadEnv();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing — set it in demos/.env");
  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
  const modelId = process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;

  const raw = JSON.parse(await fs.readFile(scriptPath, "utf8"));
  const script = DemoScript.parse(raw);
  const outDir = path.resolve("output", script.slug);
  await fs.mkdir(outDir, { recursive: true });

  const client = new ElevenLabsClient({ apiKey });
  const clips: Array<{ sceneId: string; audioPath: string; durationMs: number }> = [];
  const transcriptLines: string[] = [];

  for (const scene of script.scenes) {
    process.stdout.write("[narrate] " + JSON.stringify({ id: scene.id }) + "\n");
    const audio = await client.textToSpeech.convert(voiceId, {
      text: scene.narration,
      modelId,
      outputFormat: "mp3_44100_128",
      voiceSettings: {
        stability: 0.45,
        similarityBoost: 0.78,
        style: 0.25,
        useSpeakerBoost: true,
      },
    });
    const buffer = await streamToBuffer(audio as ReadableStream<Uint8Array>);
    const audioPath = path.join(outDir, `${scene.id}.mp3`);
    await fs.writeFile(audioPath, buffer);

    const meta = await parseFile(audioPath);
    const durationMs = Math.round((meta.format.duration ?? scene.minDurationMs / 1000) * 1000);

    clips.push({ sceneId: scene.id, audioPath, durationMs });
    transcriptLines.push(scene.narration);
  }

  await fs.writeFile(path.join(outDir, "transcript.txt"), transcriptLines.join("\n\n") + "\n");

  // Write a timings file the Remotion composition can consume.
  const timings: SceneTiming[] = clips.map((c) => {
    const scene = script.scenes.find((s) => s.id === c.sceneId)!;
    const fps = Number(process.env.DEMO_FPS || 30);
    // Use whichever is longer: scene minimum or narration + 600ms breathing room
    const ms = Math.max(scene.minDurationMs, c.durationMs + 600);
    return {
      sceneId: c.sceneId,
      videoPath: path.join(outDir, `${c.sceneId}.webm`),
      audioPath: c.audioPath,
      durationFrames: Math.ceil((ms / 1000) * fps),
    };
  });
  await fs.writeFile(path.join(outDir, "timings.json"), JSON.stringify({ script, timings }, null, 2));

  return { outDir, clips };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const scriptArg = process.argv[2];
  if (!scriptArg) {
    process.stderr.write("Usage: tsx src/narrate.ts <script.json>\n");
    process.exit(1);
  }
  narrateScript(scriptArg).then(({ outDir }) => {
    process.stdout.write("[narrate] done " + JSON.stringify({ outDir }) + "\n");
  });
}
