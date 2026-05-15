import { z } from "zod";

const ActionBase = z.object({
  comment: z.string().optional(),
  pauseAfterMs: z.number().int().min(0).max(10_000).optional(),
});

export const Action = z.discriminatedUnion("type", [
  ActionBase.extend({ type: z.literal("navigate"), url: z.string() }),
  ActionBase.extend({ type: z.literal("login"), emailEnv: z.string().default("BWP_DEMO_EMAIL"), passwordEnv: z.string().default("BWP_DEMO_PASSWORD") }),
  ActionBase.extend({ type: z.literal("click"), selector: z.string() }),
  ActionBase.extend({ type: z.literal("hover"), selector: z.string() }),
  ActionBase.extend({ type: z.literal("type"), selector: z.string(), text: z.string(), delayMs: z.number().int().min(0).max(500).default(60) }),
  ActionBase.extend({ type: z.literal("press"), key: z.string() }),
  ActionBase.extend({ type: z.literal("wait"), ms: z.number().int().min(0).max(15_000) }),
  ActionBase.extend({ type: z.literal("waitFor"), selector: z.string(), timeoutMs: z.number().int().min(0).max(30_000).default(10_000) }),
  ActionBase.extend({ type: z.literal("highlight"), selector: z.string(), durationMs: z.number().int().min(300).max(5_000).default(1200) }),
]);
export type Action = z.infer<typeof Action>;

export const Caption = z.object({
  text: z.string(),
  position: z.enum(["bottom", "top", "center"]).default("bottom"),
});

export const Scene = z.object({
  id: z.string(),
  title: z.string(),
  narration: z.string(),
  caption: Caption.optional(),
  actions: z.array(Action),
  minDurationMs: z.number().int().min(1000).default(4000),
});
export type Scene = z.infer<typeof Scene>;

export const DemoScript = z.object({
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  intro: z.object({ title: z.string(), subtitle: z.string().optional(), durationMs: z.number().int().default(2500) }).optional(),
  outro: z.object({ title: z.string(), cta: z.string().optional(), durationMs: z.number().int().default(2500) }).optional(),
  scenes: z.array(Scene).min(1),
});
export type DemoScript = z.infer<typeof DemoScript>;

export type SceneTiming = {
  sceneId: string;
  videoPath: string;
  audioPath: string;
  durationFrames: number;
};
