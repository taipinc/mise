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
│   ├── core/        # Schema types, Zod validation, Clock engine
│   │   └── src/
│   │       ├── index.ts         # Public exports (schemas, types, Clock)
│   │       ├── schema.ts        # Zod schemas + inferred types
│   │       ├── types.ts         # Type re-exports
│   │       └── clock.ts         # Clock engine
│   ├── player/      # Vanilla TS runtime — renders compositions in the browser
│   │   └── src/
│   │       ├── main.ts              # Dev harness + editor load command listener
│   │       ├── player.ts            # MisePlayer — orchestrates Clock, Stage, elements
│   │       ├── stage.ts             # Shadow DOM stage with viewBox scaling
│   │       ├── playback-bar.ts      # Audience-facing transport controls
│   │       ├── post-message-bridge.ts  # postMessage bridge (editor ↔ player)
│   │       ├── intro-screen.ts      # Click-to-start overlay with metadata
│   │       └── elements/
│   │           ├── renderer.ts  # ElementRenderer interface
│   │           ├── animation.ts # CSS enter/exit animation injection
│   │           ├── controls.ts  # Mute button, play/pause button, element playbar utilities
│   │           ├── video.ts     # Vimeo + YouTube + native <video> renderer
│   │           ├── audio.ts     # Native <audio> renderer with fade support
│   │           ├── image.ts     # <img> renderer with object-fit
│   │           ├── text.ts      # DOMPurify-sanitized HTML renderer
│   │           ├── component.ts # HTML + data-mise-action link handling
│   │           └── flags.ts     # Movable, resizable, closable, zIndexable behaviors
│   └── editor/      # React authoring tool (early stage)
│       └── src/
│           ├── main.tsx         # React root mount
│           ├── App.tsx          # Four-zone resizable panel layout
│           ├── store.ts         # Zustand store (composition as source of truth)
│           ├── env.d.ts         # File System Access API type declarations
│           ├── index.css        # Tailwind v4 + dark theme variables
│           ├── lib/
│           │   ├── cn.ts            # clsx + tailwind-merge utility
│           │   └── player-bridge.ts # Typed postMessage wrappers (sendCommand, listenToPlayer)
│           └── components/
│               ├── Toolbar.tsx      # Open/Save file + Play/Pause transport
│               ├── StageView.tsx    # Left panel — element list
│               ├── StagePreview.tsx # Center — player iframe + postMessage wiring
│               ├── Inspector.tsx    # Right panel — composition metadata
│               └── Timeline.tsx     # Bottom panel — element tracks + playhead
├── compositions/    # Hand-written test JSON files
│   ├── schema.json  # Reference schema document (not a real composition)
│   ├── test01.json  # Two Vimeo videos
│   ├── test02.json  # Image, text, component, video, background
│   ├── test03.json  # Audio, component, image, text, video
│   └── test04.json  # All element types + visibility field + styled playback bar
├── CONTEXT.md       # Full project context and design decisions
└── TODO.md          # Tracked future work items
```

**Package names**: `@mise/core`, `@mise/player`, `@mise/editor`.

**Tooling**: pnpm workspaces, Turborepo (root), Vite for player and editor dev servers.

**Dev servers**: Player runs on port 5173 (`pnpm dev` from `packages/player`). Editor runs on port 5180 (`pnpm dev` from `packages/editor`).

---

## Current Phase

Phase 1 (Core & Player) is substantially complete. Phase 2 (Editor) has begun.

### `@mise/core` — complete

- `schema.ts` — Zod schemas for the full composition structure, types inferred via `z.infer<>`
- `types.ts` — re-exports all inferred types
- `clock.ts` — Clock class: `play()`, `pause()`, `seek()`, `currentTime`, event system (`open`, `close`, `tick`, `end`), loop support, 16ms tick interval

### `@mise/player` — functional

- `main.ts` — Dev harness entry point. Fetches `test04.json` and mounts the player. Also listens for `mise:command` `load` messages from a parent frame so the editor can send new compositions without page reload.
- `player.ts` — `MisePlayer` class: wires Clock to element lifecycle, mounts/unmounts elements on cue, reconciles element state on seek. Tracks `userClosedElements` so manually-closed elements don't reappear on seek (reset when seeking before the element's open cue). Handles `data-mise-action` dispatching (`open:id`, `close:id`, `seek:N`). Background pinning sets z-index 0 on `background: true` elements. Creates a `PostMessageBridge` for editor communication.
- `post-message-bridge.ts` — Listens for inbound `mise:command` messages (play/pause/seek), emits outbound `mise:tick` (~10fps, 100ms throttle) and `mise:stateChange` (playing/paused) to `window.parent`.
- `stage.ts` — Shadow DOM stage with viewBox scaling via CSS transform, ResizeObserver, author styles injection. Background supports CSS values, image URLs, and video URLs.
- `playback-bar.ts` — PlaybackBar: play/pause, scrub track, current/total time display, global mute button, known-horizon calculation (latest cue when duration is null), ∞ state beyond horizon.
- `intro-screen.ts` — Click-to-start overlay showing title/author/description from composition metadata.
- `elements/video.ts` — Supports three providers: Vimeo (via `@vimeo/player` SDK), YouTube (via IFrame API), and native `<video>` (direct URLs). Provider auto-detected from URL. Aspect ratio preservation, mute control, element playbar, fade in/out, Clock sync.
- `elements/audio.ts` — Native `<audio>`, loop/mute/fadeIn/fadeOut, mute button, element playbar, Clock seek sync, global/per-element mute.
- `elements/image.ts` — `<img>` with object-fit cover/contain via `mediaFit`, flags, classNames, enter/exit animation.
- `elements/text.ts` — DOMPurify-sanitized HTML content, flags, classNames, enter/exit animation.
- `elements/component.ts` — DOMPurify-sanitized HTML (preserves `data-mise-action`), click listener dispatches actions to player, flags, classNames, enter/exit animation.
- `elements/controls.ts` — Shared UI utilities: `createMuteButton()`, `createPlayPauseButton()`, `createElementPlaybar()`.
- `elements/flags.ts` — `applyFlags()`: movable (title bar drag), resizable (corner handle), closable (× button), zIndexable (click to front). Uses `setPointerCapture` to avoid disrupting iframe playback. Controls fade in on hover.
- `elements/animation.ts` — `applyAnimation()`: enter class (removed after 500ms), exit class (waits for `animationend` or 600ms timeout before DOM removal).
- `elements/renderer.ts` — `ElementRenderer` interface: `mount()`, `unmount()`, `seek()`, `pause()`, `resume()`, `setGlobalMuted()`, `syncWithClock` property.

### `@mise/editor` — early stage (scaffolded, functional)

- **Stack**: React 19, Vite, TypeScript, Tailwind CSS v4, Zustand 5, react-resizable-panels, lucide-react.
- **Layout**: Four-zone resizable panel architecture (see "Editor Architecture" below).
- **State**: Zustand store with composition JSON as single source of truth.
- **Player integration**: Embeds `@mise/player` in an iframe, communicates via postMessage.
- **File I/O**: Open/Save via File System Access API (`showOpenFilePicker`/`showSaveFilePicker`).
- Loads `compositions/test04.json` as the default composition on startup.

### What's still TODO

**Player remaining work:**
- Render `graphic` element type
- Author CSS customization of the Playback Bar via `classNames`

**Editor next steps:**
- Drag-and-drop timeline editing
- Element property editing in the Inspector
- Stage view with visual element positioning
- Undo/redo

---

## postMessage Protocol (Editor ↔ Player)

This is a cross-package contract. The editor (`@mise/editor`) embeds the player (`@mise/player`) in an iframe. All messages are namespaced with `mise:` to avoid collisions.

### Inbound: Editor → Player

All inbound messages use `type: "mise:command"`.

| Command | Payload | Handler |
|---------|---------|---------|
| `play` | `{ type: "mise:command", command: "play" }` | `PostMessageBridge` in `player.ts` calls `player.play()` |
| `pause` | `{ type: "mise:command", command: "pause" }` | `PostMessageBridge` in `player.ts` calls `player.pause()` |
| `seek` | `{ type: "mise:command", command: "seek", time: number }` | `PostMessageBridge` in `player.ts` calls `player.seek(time)` |
| `load` | `{ type: "mise:command", command: "load", composition: MiseComposition }` | Top-level listener in `main.ts` — validates with Zod, destroys current player, creates new one with `skipIntro: true` |

**Why `load` is handled in `main.ts`, not `PostMessageBridge`**: The load command destroys and recreates the entire `MisePlayer` instance (and its bridge). It must be handled outside the player lifecycle.

### Outbound: Player → Editor

Sent to `window.parent` only when the player is inside an iframe (`window.parent !== window`).

| Message | Payload | Frequency |
|---------|---------|-----------|
| `mise:tick` | `{ type: "mise:tick", time: number }` | ~10fps (100ms throttle via `performance.now()`) |
| `mise:stateChange` | `{ type: "mise:stateChange", state: "playing" \| "paused" }` | On every `play()` / `pause()` call |

### Implementation files

- **Player side**: `packages/player/src/post-message-bridge.ts` (play/pause/seek + tick/stateChange), `packages/player/src/main.ts` (load command)
- **Editor side**: `packages/editor/src/lib/player-bridge.ts` (typed `sendCommand()` + `listenToPlayer()` wrappers), `packages/editor/src/components/StagePreview.tsx` (wires bridge to Zustand store)

---

## Editor Architecture

### Panel Layout

```
┌──────────────────────────────────────────────────┐
│ Toolbar (Open, Save, Play/Pause, filename)       │
├────────┬─────────────────────────┬───────────────┤
│ Stage  │                         │   Inspector   │
│ View   │   Stage Preview         │               │
│        │   (player iframe)       │   - Title     │
│ - List │                         │   - ViewBox   │
│   of   │                         │   - Duration  │
│   els  │                         │   - Count     │
├────────┴─────────────────────────┴───────────────┤
│ Timeline                                         │
│ ┌─label──┬─────track─────────────────────────┐   │
│ │ el-id  │ ██████████████  (type)            │   │
│ │ el-id  │      ████████████████████████     │   │
│ └────────┴───────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

- **Splits**: `react-resizable-panels`. Vertical split: top (70%) / bottom (30%). Top has horizontal split: left (20%) / center (55%) / right (25%).
- **Toolbar**: Not a panel — fixed `h-10` bar at top. Contains Open/Save (File System Access API) and Play/Pause (sends postMessage to player iframe).
- **Stage View** (left): Lists elements by type badge + ID. Placeholder for future visual stage manipulation.
- **Stage Preview** (center): `<iframe src="http://localhost:5173">`. On load and on composition change, sends `mise:command` `load` with the current Zustand composition. Listens for `mise:tick` → `setCurrentTime`, `mise:stateChange` → `setPlaying`.
- **Inspector** (right): Displays composition metadata (title, viewBox, duration, element count). Placeholder for future per-element property editing.
- **Timeline** (bottom): One row per element. Each row has a label column (7rem) and a track area showing the element's open/close range as a percentage bar. Red playhead line tracks `currentTime`.

### Zustand Store (`store.ts`)

```ts
interface EditorState {
  composition: MiseComposition;   // The single source of truth
  currentTime: number;            // From player tick messages
  playing: boolean;               // From player stateChange messages
  fileName: string | null;        // Name of loaded file

  setComposition: (composition: MiseComposition, fileName?: string) => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
}
```

Initial state loads `compositions/test04.json` via static import, validated through `CompositionSchema.safeParse()`.

`usePlayerRef` is a separate tiny Zustand store in `StagePreview.tsx` that holds the iframe element ref so `Toolbar.tsx` can send commands to it.

### File I/O

- **Open**: `window.showOpenFilePicker()` → read file → `JSON.parse` → `CompositionSchema.safeParse()` → `setComposition()`. This triggers a re-render of StagePreview which sends the new composition to the player iframe via `mise:command` `load`.
- **Save**: `window.showSaveFilePicker()` → `JSON.stringify(composition, null, 2)` → write blob. Saves the current Zustand store state.
- Both use the File System Access API (Chromium only). Types declared in `env.d.ts`.

---

## Key Concepts

### The Three Timelines (do not confuse these)

- **The Clock** — internal time engine in `@mise/core`. Counts seconds, fires `open`/`close` events at cue timestamps. No UI. No framework.
- **The Playback Bar** — optional audience-facing UI rendered by the player on the stage. Controlled by `stage.playbackBar` in the project JSON.
- **The Edit Timeline** — track-based timeline in the editor's bottom panel. Currently read-only (shows element ranges + playhead). Future: drag-and-drop editing.

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
- `visible` — boolean, when false the element is mounted but hidden (opacity 0, no pointer events)

### Clock/Element Sync

By default, media elements are synced to the Clock (play/pause/seek together). This can be broken globally (`stage.playback.sync.withClock: false`) or per-element (`playback.syncWithClock: false`). When synced and the Clock seeks to T, each element seeks to `T - element.open.at` seconds into its own media.

### Element Links

Inside `text` and `component` HTML content, use `data-mise-action="open:element-id"` to trigger another element. The player watches for clicks on any element with `data-mise-action`. Supported actions: `open:id`, `close:id`, `seek:N`.

### CSS & Shadow DOM

The `stage.styles` field is a CSS string. The player injects it into a Shadow DOM root, giving full isolation — author CSS cannot affect the host page and vice versa. Element `classNames` arrays reference classes defined in `stage.styles`.

---

## Coding Conventions

- **TypeScript everywhere.** No `any`. No implicit returns.
- **Zod for all schema validation.** Types should be inferred from Zod schemas, not declared separately: `type Element = z.infer<typeof ElementSchema>`.
- **`@mise/core` has zero UI dependencies.** No DOM, no browser APIs, no framework. Pure logic only.
- **`@mise/player` is vanilla TypeScript.** No React, no Vue, no framework. Must be embeddable as a `<script>` tag.
- **`@mise/editor` uses React + Zustand.** Composition JSON in Zustand is the single source of truth. Player is embedded via iframe, never imported directly.
- Use named exports, not default exports, in `@mise/core`.
- All source files go in `packages/[name]/src/`. Entry point is `packages/[name]/src/index.ts` (core) or `packages/[name]/src/main.ts[x]` (player/editor).

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

## Synchronization Philosophy (important)

Mise targets **expressive and narrative synchronization, not frame-accurate sync**. Streaming video over the web cannot guarantee frame-level alignment. Best-effort seeking (within ~200–500ms) is the goal and is appropriate for the intended use cases. Do not over-engineer the sync system chasing precision the browser cannot provide.

---

## What To Avoid

- Do not add a framework dependency to `@mise/player`
- Do not import `@mise/player` code directly into `@mise/editor` — communicate only via iframe + postMessage
- Do not add media hosting — all assets are external URLs
- Do not sanitize HTML in `@mise/core` — DOMPurify belongs in `@mise/player` at render time
- Do not invent new schema fields without checking `CONTEXT.md` first

Refer to `compositions/schema.json` as the source of truth for field names and types. Any ambiguity should be resolved against `CONTEXT.md`.
