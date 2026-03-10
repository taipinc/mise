import { z } from "zod";

// --- Nested schemas ---

export const ViewBoxSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export const SyncSchema = z.object({
  withClock: z.boolean(),
});

export const StagePlaybackSchema = z.object({
  duration: z.number().nullable(),
  loop: z.boolean(),
  sync: SyncSchema,
});

export const PlaybackBarSchema = z
  .object({
    visible: z.boolean(),
    interactive: z.boolean(),
    classNames: z.array(z.string()),
    showCurrentTime: z.boolean().default(false),
    showTotalTime: z.boolean().default(false),
    timeCurrentClassNames: z.array(z.string()).default([]),
    timeTotalClassNames: z.array(z.string()).default([]),
    globalMute: z.boolean().default(false),
  })
  .passthrough();

export const StageSchema = z
  .object({
    viewBox: ViewBoxSchema,
    scaling: z.boolean(),
    background: z.string(),
    poster: z.string(),
    styles: z.string(),
    playback: StagePlaybackSchema,
    playbackBar: PlaybackBarSchema,
  })
  .passthrough();

export const MetaSchema = z.object({
  title: z.string(),
  author: z.string(),
  description: z.string(),
  created: z.string(),
  modified: z.string(),
});

// --- Element sub-schemas ---

export const ElementOpenSchema = z.object({
  mode: z.union([z.literal("cue"), z.literal("link"), z.literal("both")]),
  at: z.number(),
});

export const ElementCloseSchema = z.object({
  mode: z.union([
    z.literal("cue"),
    z.literal("userClose"),
    z.literal("none"),
  ]),
  at: z.number().nullable(),
});

export const ElementPlaybackBarSchema = z
  .object({
    visible: z.boolean(),
    classNames: z.array(z.string()),
  })
  .passthrough();

export const ElementPlaybackSchema = z.object({
  initial: z.union([z.literal("playing"), z.literal("paused")]),
  loop: z.boolean(),
  syncWithClock: z.boolean(),
  audienceControl: z.boolean(),
  bar: ElementPlaybackBarSchema,
});

export const ElementAudioSchema = z.object({
  initial: z.union([z.literal("on"), z.literal("off")]),
  audienceControl: z.boolean(),
  fadeIn: z.number().default(0).optional(),
  fadeOut: z.number().default(0).optional(),
});

export const PositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .passthrough();

export const SizeSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export const FlagsSchema = z.object({
  movable: z.boolean(),
  resizable: z.boolean(),
  closable: z.boolean(),
  zIndexable: z.boolean(),
});

export const AnimationSchema = z.object({
  enter: z.string(),
  exit: z.string(),
});

export const ElementTypeSchema = z.union([
  z.literal("video"),
  z.literal("audio"),
  z.literal("image"),
  z.literal("text"),
  z.literal("graphic"),
  z.literal("component"),
]);

export const ElementSchema = z
  .object({
    id: z.string(),
    type: ElementTypeSchema,
    src: z.string().nullable(),
    content: z.string().nullable(),
    open: ElementOpenSchema,
    close: ElementCloseSchema,
    persistOnLoop: z.boolean(),
    playback: ElementPlaybackSchema.optional(),
    audio: ElementAudioSchema.optional(),
    position: PositionSchema,
    size: SizeSchema,
    zIndex: z.number().nullable(),
    background: z.boolean(),
    classNames: z.array(z.string()),
    flags: FlagsSchema,
    animation: AnimationSchema,
    mediaFit: z.enum(["fit", "fill"]).default("fill").optional(),
    visible: z.boolean().default(true).optional(),
  })
  .passthrough();

// --- Root composition schema ---

export const CompositionSchema = z
  .object({
    version: z.string(),
    meta: MetaSchema,
    stage: StageSchema,
    elements: z.array(ElementSchema),
  })
  .passthrough();

// --- Inferred types ---

export type ViewBox = z.infer<typeof ViewBoxSchema>;
export type Sync = z.infer<typeof SyncSchema>;
export type StagePlayback = z.infer<typeof StagePlaybackSchema>;
export type PlaybackBar = z.infer<typeof PlaybackBarSchema>;
export type MiseStage = z.infer<typeof StageSchema>;
export type MiseMeta = z.infer<typeof MetaSchema>;
export type ElementOpen = z.infer<typeof ElementOpenSchema>;
export type ElementClose = z.infer<typeof ElementCloseSchema>;
export type ElementPlaybackBar = z.infer<typeof ElementPlaybackBarSchema>;
export type ElementPlayback = z.infer<typeof ElementPlaybackSchema>;
export type ElementAudio = z.infer<typeof ElementAudioSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Size = z.infer<typeof SizeSchema>;
export type Flags = z.infer<typeof FlagsSchema>;
export type Animation = z.infer<typeof AnimationSchema>;
export type ElementType = z.infer<typeof ElementTypeSchema>;
export type MiseElement = z.infer<typeof ElementSchema>;
export type MiseComposition = z.infer<typeof CompositionSchema>;
