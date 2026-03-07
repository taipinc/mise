# Mise — Claude Code Context

## What This Project Is

Mise is an open-source platform for creating and playing web-based interactive timeline compositions. Think of it as a video editor whose output is a living webpage, not a rendered file. The name comes from *mise-en-scène* — the arrangement of everything within the frame.

There are two user roles:
- **Author** — uses the editor to create and publish compositions
- **Audience** — experiences the composition through the player

Full project context and design decisions are documented in `CONTEXT.md` at the repo root. Read it before making architectural decisions. If `CONTEXT.md` is conflicting with this document, or project's code, or your intuition, ask for clarification before proceeding.

---

## Monorepo Structure

```
mise/
├── packages/
│   ├── core/        # Schema types, Zod validation, The Clock engine
│   │   └── src/
│   │       ├── index.ts         # Public exports (schemas, types, Clock)
│   │       ├── schema.ts        # Zod schemas + inferred types
│   │       ├── types.ts         # Type re-exports
│   │       └── clock.ts         # Clock engine
│   ├── player/      # Vanilla TS runtime — reads project JSON, renders to browser
│   │   └── src/
│   │       ├── main.ts          # Dev harness entry point
│   │       ├── player.ts        # MisePlayer — orchestrates Clock, Stage, elements
│   │       ├── stage.ts         # Shadow DOM stage with viewBox scaling
│   │       ├── playback-bar.ts  # Audience-facing transport controls
│   │       └── elements/
│   │           ├── renderer.ts  # Common ElementRenderer interface
│   │           ├── animation.ts # CSS enter/exit animation injection
│   │           ├── video.ts     # Vimeo video element renderer
│   │           ├── audio.ts     # Native <audio> element renderer
│   │           ├── image.ts     # <img> element renderer
│   │           ├── text.ts      # DOMPurify-sanitized HTML content renderer
│   │           ├── component.ts # HTML content + data-mise-action link handling
│   │           └── flags.ts     # Movable, resizable, closable, zIndexable behaviors
│   └── editor/      # React authoring tool — not started yet
├── compositions/    # Hand-written test JSON files
│   ├── schema.json  # Reference schema document (not a real composition)
│   ├── test01.json  # First test composition (two Vimeo videos)
│   └── test02.json  # Second test (image, text, component, video, background)
├── CONTEXT.md       # Full project context and design decisions
└── TODO.md          # Tracked future work items
```

Package names: `@mise/core`, `@mise/player`, `@mise/editor`.

---

## Current Phase: Phase 1 — Core & Player

We are building in this order:
1. ✅ Define the JSON schema (`compositions/schema.json`)
2. ✅ Write test compositions by hand (`compositions/test01.json`)
3. ✅ TypeScript types + Zod validation in `@mise/core`
4. ✅ The Clock engine in `@mise/core`
5. 🔧 The player runtime in `@mise/player` (in progress — see below)

### What's built so far

**`@mise/core`** — complete:
- `schema.ts` — Zod schemas for the full composition structure, types inferred via `z.infer<>`
- `types.ts` — re-exports all inferred types
- `clock.ts` — Clock class: `play()`, `pause()`, `seek()`, `currentTime`, event system (`open`, `close`, `tick`, `end`), loop support

**`@mise/player`** — functional, not yet complete:
- `stage.ts` — Shadow DOM stage with viewBox scaling via CSS transform, ResizeObserver, author styles injection. Background supports CSS values, image URLs, and video URLs (auto-detected by file extension).
- `player.ts` — MisePlayer class: wires Clock to element lifecycle, mounts/unmounts elements on cue, reconciles element state on seek. Tracks `userClosedElements` so manually-closed elements don't reappear on seek (reset when seeking before the element's open cue). Handles `data-mise-action` dispatching (`open:id`, `close:id`). Background pinning sets z-index 0 on `background: true` elements.
- `elements/renderer.ts` — `ElementRenderer` interface: `mount()`, `unmount()`, `seek()`, `syncWithClock`
- `elements/animation.ts` — `applyAnimation()`: adds enter class (removes after 500ms), adds exit class (waits for `animationend` or 600ms timeout before DOM removal)
- `elements/video.ts` — VideoElement: Vimeo iframe embeds with `@vimeo/player` SDK, autoplay/mute handling, `autopause=0` for simultaneous playback, `syncWithClock` seek support, enter/exit animation
- `elements/audio.ts` — AudioElement: headless native `<audio>` element, no DOM wrapper, supports loop/mute/syncWithClock seek
- `elements/image.ts` — ImageElement: `<img>` with `object-fit: cover`, flags, classNames, enter/exit animation
- `elements/text.ts` — TextElement: DOMPurify-sanitized HTML content, flags, classNames, enter/exit animation
- `elements/component.ts` — ComponentElement: DOMPurify-sanitized HTML (preserves `data-mise-action` attr), click listener dispatches actions to player, flags, classNames, enter/exit animation
- `elements/flags.ts` — `applyFlags()`: movable (title bar drag handle), resizable (corner handle), closable (× button), zIndexable (click to front). Uses `setPointerCapture` to avoid disrupting iframe playback. Controls fade in on hover via CSS class toggle.
- `playback-bar.ts` — PlaybackBar: play/pause button, scrub track with draggable playhead, known-horizon calculation (latest cue when duration is null), ∞ state beyond horizon, hover-to-reveal near stage bottom

### What's still TODO in Phase 1
- Render `graphic` element type
- Author CSS customization of the Playback Bar via `classNames`
- Element-level playback bars (`playback.bar`)
- Audio mute/unmute toggle UI when `audio.audienceControl: true`
- Support multiple video providers (direct URLs, YouTube) — currently Vimeo only
- Build custom video controls to replace Vimeo's native controls
- `seek:N` action support in `data-mise-action` links

Do not start work on `@mise/editor` yet. The editor stack is not decided.

---

## Key Concepts

### The Three Timelines (do not confuse these)

- **The Clock** — internal time engine in `@mise/core`. Counts seconds, fires `open`/`close` events at cue timestamps. No UI. No framework.
- **The Playback Bar** — optional audience-facing UI rendered by the player on the stage. Controlled by `stage.playbackBar` in the project JSON.
- **The Edit Timeline** — drag-and-drop track editor in the editor app. Does not exist yet. Has no presence in the schema or player.

### The Stage

Uses a `viewBox` coordinate system (borrowed from SVG). Author defines units like `{ width: 1920, height: 1080 }` — these are coordinate units, not pixels. The player scales the stage to fill its container via CSS transform while preserving aspect ratio.

### Elements

Six types: `video`, `audio`, `image`, `text`, `graphic`, `component`.

Each element has:
- `open` — `{ mode: "cue" | "link" | "both", at: number }`
- `close` — `{ mode: "cue" | "userClose" | "none", at: number | null }`
- `playback` — for `video` and `audio` only: initial state, audience control, element-level playback bar
- `audio` — for `video` and `audio`: initial on/off state, audience control
- `flags` — `movable`, `resizable`, `closable`, `zIndexable`
- `animation` — `enter` and `exit` are CSS class names injected at mount/unmount

### Clock/Element Sync

By default, media elements are synced to the Clock (play/pause/seek together). This can be broken globally (`stage.playback.sync.withClock: false`) or per-element (`playback.syncWithClock: false`). When synced and the Clock seeks to T, each element seeks to `T - element.open.at` seconds into its own media.

### Element Links

Inside `text` and `component` HTML content, use `data-mise-action="open:element-id"` to trigger another element. The player watches for clicks on any element with `data-mise-action`. Also reserve `"close:element-id"` and `"seek:90"` for Phase 4.

### CSS & Shadow DOM

The `stage.styles` field is a CSS string. The player injects it into a Shadow DOM root, giving full isolation — author CSS cannot affect the host page and vice versa. Element `classNames` arrays reference classes defined in `stage.styles`.

---

## Coding Conventions

- **TypeScript everywhere.** No `any`. No implicit returns.
- **Zod for all schema validation.** Types should be inferred from Zod schemas, not declared separately: `type Element = z.infer<typeof ElementSchema>`.
- **`@mise/core` has zero UI dependencies.** No DOM, no browser APIs, no framework. Pure logic only.
- **`@mise/player` is vanilla TypeScript.** No React, no Vue, no framework. Must be embeddable as a `<script>` tag.
- Use named exports, not default exports, in `@mise/core`.
- All source files go in `packages/[name]/src/`. Entry point is `packages/[name]/src/index.ts`.

---

## Git Workflow

- **Never commit directly to `main`.**
- Branch from `develop` for all work: `git checkout -b feature/[name] develop`
- One branch per logical unit of work (e.g. `feature/core-schema`, `feature/clock-engine`)
- Open a Pull Request to merge back into `develop`
- Commit messages use Conventional Commits:
  ```
  feat: add Zod schema for Element type
  fix: correct cue firing order when timestamps are equal
  docs: add SCHEMA.md to packages/core
  chore: add tsconfig to @mise/core
  refactor: extract Clock tick logic into separate function
  ```

---

## What To Work On Next

Continue Phase 1 — polish and remaining features. See "What's still TODO in Phase 1" above for the full list. Priorities:
1. Support direct video URLs (native `<video>` element) alongside Vimeo embeds
2. Author CSS customization of the Playback Bar via `classNames`
3. Element-level playback bars

Refer to `compositions/schema.json` as the source of truth for field names and types. Any ambiguity should be resolved against `CONTEXT.md`.

---

## Synchronization Philosophy (important)

Mise targets **expressive and narrative synchronization, not frame-accurate sync**. Streaming video over the web cannot guarantee frame-level alignment. Best-effort seeking (within ~200–500ms) is the goal and is appropriate for the intended use cases. Do not over-engineer the sync system chasing precision the browser cannot provide.

---

## What To Avoid

- Do not add a framework dependency to `@mise/player`
- Do not start `@mise/editor` until the player is working end-to-end
- Do not add media hosting — all assets are external URLs
- Do not sanitize HTML in `@mise/core` — DOMPurify belongs in `@mise/player` at render time
- Do not invent new schema fields without checking `CONTEXT.md` first
