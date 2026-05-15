import { Composition, staticFile } from "remotion";
import fs from "node:fs";
import path from "node:path";
import { DemoVideo, demoVideoSchema } from "./DemoVideo.js";

const FPS = Number(process.env.DEMO_FPS || 30);
const WIDTH = Number(process.env.DEMO_WIDTH || 1920);
const HEIGHT = Number(process.env.DEMO_HEIGHT || 1080);

function loadTimings(slug: string) {
  const file = path.resolve("output", slug, "timings.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export const RemotionRoot: React.FC = () => {
  // Default composition pulls from the demo slug passed via DEMO_SLUG env var,
  // or the first folder under output/ if not set. Falls back to placeholder.
  const slug = process.env.DEMO_SLUG || firstOutputSlug() || "demo";
  const data = loadTimings(slug);

  const totalFrames = data
    ? data.timings.reduce((acc: number, t: { durationFrames: number }) => acc + t.durationFrames, 0) +
      Math.ceil(((data.script.intro?.durationMs ?? 0) / 1000) * FPS) +
      Math.ceil(((data.script.outro?.durationMs ?? 0) / 1000) * FPS)
    : FPS * 10;

  return (
    <Composition
      id="DemoVideo"
      component={DemoVideo}
      durationInFrames={Math.max(totalFrames, FPS)}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      schema={demoVideoSchema}
      defaultProps={{ slug }}
    />
  );
};

function firstOutputSlug(): string | null {
  const out = path.resolve("output");
  if (!fs.existsSync(out)) return null;
  const dirs = fs.readdirSync(out, { withFileTypes: true }).filter((d) => d.isDirectory());
  return dirs[0]?.name ?? null;
}
