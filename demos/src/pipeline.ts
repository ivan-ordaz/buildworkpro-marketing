import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { captureScript } from "./capture.js";
import { narrateScript } from "./narrate.js";
import { DemoScript } from "./types.js";
import { loadEnv } from "./env.js";

async function renderRemotion(slug: string): Promise<string> {
  const outFile = path.resolve("output", slug, "final.mp4");
  const args = ["remotion", "render", "src/remotion/index.ts", "DemoVideo", outFile, `--props=${JSON.stringify({ slug })}`];
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npx", args, {
      stdio: "inherit",
      env: { ...process.env, DEMO_SLUG: slug },
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("remotion render failed: " + JSON.stringify({ code })))));
  });
  return outFile;
}

async function main() {
  loadEnv();
  const scriptArg = process.argv[2];
  if (!scriptArg) {
    process.stderr.write("Usage: tsx src/pipeline.ts <script.json>\n");
    process.exit(1);
  }
  const raw = JSON.parse(await fs.readFile(scriptArg, "utf8"));
  const script = DemoScript.parse(raw);

  process.stdout.write("[pipeline] start " + JSON.stringify({ slug: script.slug, scenes: script.scenes.length }) + "\n");

  await captureScript(scriptArg);
  await narrateScript(scriptArg);
  const finalMp4 = await renderRemotion(script.slug);

  process.stdout.write("[pipeline] done " + JSON.stringify({ output: finalMp4 }) + "\n");
}

main().catch((err) => {
  process.stderr.write("[pipeline] error: " + (err instanceof Error ? err.message : String(err)) + "\n");
  process.exit(1);
});
