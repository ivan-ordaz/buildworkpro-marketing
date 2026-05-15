import { AbsoluteFill, Audio, OffthreadVideo, Sequence, Series, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const demoVideoSchema = z.object({ slug: z.string() });

type Timing = { sceneId: string; videoPath: string; audioPath: string; durationFrames: number };
type Caption = { text: string; position: "top" | "bottom" | "center" };
type Scene = { id: string; title: string; narration: string; caption?: Caption };
type ScriptData = {
  script: {
    title: string;
    subtitle?: string;
    intro?: { title: string; subtitle?: string; durationMs: number };
    outro?: { title: string; cta?: string; durationMs: number };
    scenes: Scene[];
  };
  timings: Timing[];
};

function loadData(slug: string): ScriptData | null {
  const file = path.resolve("output", slug, "timings.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export const DemoVideo: React.FC<{ slug: string }> = ({ slug }) => {
  const data = loadData(slug);
  const { fps } = useVideoConfig();

  if (!data) {
    return (
      <AbsoluteFill style={{ background: "#0f172a", color: "white", alignItems: "center", justifyContent: "center", fontSize: 56, fontFamily: "Inter, sans-serif" }}>
        Run capture + narrate first
      </AbsoluteFill>
    );
  }

  const introFrames = Math.ceil(((data.script.intro?.durationMs ?? 0) / 1000) * fps);
  const outroFrames = Math.ceil(((data.script.outro?.durationMs ?? 0) / 1000) * fps);

  return (
    <AbsoluteFill style={{ background: "#0b1220" }}>
      <Series>
        {data.script.intro && (
          <Series.Sequence durationInFrames={introFrames}>
            <TitleCard title={data.script.intro.title} subtitle={data.script.intro.subtitle} />
          </Series.Sequence>
        )}
        {data.timings.map((t, i) => {
          const scene = data.script.scenes.find((s) => s.id === t.sceneId);
          return (
            <Series.Sequence key={t.sceneId} durationInFrames={t.durationFrames}>
              <SceneClip timing={t} caption={scene?.caption} />
            </Series.Sequence>
          );
        })}
        {data.script.outro && (
          <Series.Sequence durationInFrames={outroFrames}>
            <TitleCard title={data.script.outro.title} subtitle={data.script.outro.cta} accent />
          </Series.Sequence>
        )}
      </Series>
    </AbsoluteFill>
  );
};

const SceneClip: React.FC<{ timing: Timing; caption?: Caption }> = ({ timing, caption }) => {
  return (
    <AbsoluteFill>
      <OffthreadVideo src={`file://${timing.videoPath}`} muted />
      <Audio src={`file://${timing.audioPath}`} />
      {caption && <CaptionOverlay {...caption} />}
    </AbsoluteFill>
  );
};

const CaptionOverlay: React.FC<Caption> = ({ text, position }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 12 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const translateY = interpolate(enter, [0, 1], [20, 0]);
  const top = position === "top" ? "8%" : position === "center" ? "44%" : "auto";
  const bottom = position === "bottom" ? "8%" : "auto";
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top,
          bottom,
          transform: `translate(-50%, ${translateY}px)`,
          opacity,
          background: "rgba(15, 23, 42, 0.82)",
          color: "white",
          padding: "18px 32px",
          borderRadius: 14,
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 38,
          fontWeight: 600,
          letterSpacing: 0.2,
          boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ title: string; subtitle?: string; accent?: boolean }> = ({ title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: 30, config: { damping: 14 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.96, 1]);
  return (
    <AbsoluteFill
      style={{
        background: accent
          ? "linear-gradient(135deg, #f97316 0%, #b45309 100%)"
          : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <div style={{ transform: `scale(${scale})`, textAlign: "center", color: "white", fontFamily: "Inter, system-ui, sans-serif" }}>
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -1.5 }}>{title}</div>
        {subtitle && <div style={{ marginTop: 24, fontSize: 40, opacity: 0.85 }}>{subtitle}</div>}
      </div>
    </AbsoluteFill>
  );
};
