# Mise — Project Context Document

> **Name:** Mise *(from mise-en-scène — the arrangement of everything within the frame)*
> **Status:** Pre-development / Planning
> **Last updated:** March 2026
> **Author:** Shabtai Pinchevsky

---

## What Is This?

Mise is an open-source platform for creating and playing **web-based interactive timeline compositions**. Think of it as a video editor whose output is not a rendered video file, but a living, interactive webpage.

The name comes from *mise-en-scène* — the art of placing and arranging everything within the frame. The author *mises* a composition: places elements in time and space, arranges their relationships, and sets the stage.

The core idea: a sequence of independent media and UI elements — video, audio, image, text, graphics, and custom UI components — arranged on a timeline and displayed on a stage. Because the output runs in a browser, elements remain independent objects that can be interactive, resizable, movable, and fully styleable with CSS. Nothing gets "baked" into a flat file.

The result is somewhere between a video editor, a presentation tool, and an interactive art platform.

---

## Terminology

| Term | Definition |
|---|---|
| **Author** | The person who uses the editor to create and publish a composition |
| **Audience** | A person who experiences the composition through the player |
| **Composition** | A complete authored work — the project file and everything it defines |
| **Stage** | The visual canvas on which a composition plays |
| **Element** | An independent media or UI object placed on the stage |
| **The Clock** | The internal time engine — counts time, fires cue events. No UI. |
| **Playback Bar** | The optional audience-facing timeline UI rendered on the stage |
| **Edit Timeline** | The author's drag-and-drop track editor (editor app only, not in player/schema) |
| **Cue** | A scheduled event on the Clock (open element X at T, close element Y at T) |
| **Project file** | The JSON document that fully describes a composition |

---

## Core Mental Models

### The Stage

A full-screen (or bounded) web canvas that is the runtime environment for a composition.

**Coordinate system:**
The stage uses a `viewBox` model borrowed from SVG. The author defines a coordinate space — e.g. `{ width: 1920, height: 1080 }` — but these are *coordinate units*, not pixels. The player scales the stage to fill its container while preserving the aspect ratio. Authors place elements using those units; the browser handles the actual pixels. This is the only sizing mode — fluid scaling within a defined aspect ratio. A "1920 × 1080" stage and a "16 × 9" stage are the same thing.

**Stage properties:**
- `viewBox` — coordinate space definition (e.g. `{ width: 1920, height: 1080 }`)
- `background` — a color, image URL, or video URL applied to the stage itself (not an element)
- `poster` — a thumbnail/preview image shown before the composition begins (the composition's "cover image")
- `styles` — the author's CSS string, scoped to the stage via Shadow DOM

### The Three Timelines

These are three distinct concepts that share a single underlying clock. Naming them clearly is important.

**1. The Clock**
The internal time engine. Lives in `@mise/core`. Counts elapsed seconds, fires `open` and `close` events when cue timestamps are reached. Has no visual representation. Knows nothing about the audience, the UI, or the editor. This is the only concept that exists in all three contexts (core, player, editor).

**2. The Playback Bar**
The optional audience-facing UI component rendered on the stage by the player. Visualizes the current position on the Clock. Is itself a styled stage element — it belongs to the author's design and can be fully styled via CSS. Properties:
- `visible` — whether the audience can see it at all
- `interactive` — whether the audience can pause, scrub, or seek
- `classNames` — CSS classes applied to the Playback Bar
- `loop` — whether the composition restarts when the Clock reaches the end
- `duration` — optional. If not set, the Clock runs indefinitely after the last cue.

**3. The Edit Timeline**
The drag-and-drop track editor in the author's editor app. A visual representation of all elements and their cues across time. Used to place, move, and trim element entry/exit timestamps. This component exists only in the editor application — it does not exist in the player and has no presence in the project file schema.

**Key rule:** The Clock only fires two event types: `open` and `close`. Everything happening inside an element after it opens is the element's own business. The Clock does not track or control internal media state.

**Playback bar hierarchy:**
There are two distinct levels of playback bar in Mise — do not confuse them:
- The **stage Playback Bar** — controls the Clock (the composition's time position). Configured at the stage level.
- The **element playback bar** — controls an individual media element's play/pause state. Configured per-element under `playback.bar`. Each video or audio element can have its own.

**Clock/element synchronization:**
By default, element playback is linked to the Clock: when the Clock plays, media elements play; when it pauses, they pause; when it seeks, they seek to the corresponding position. This is the expected behavior for most compositions.

Authors can break this link at two levels:
- **Globally** — a stage-level flag that decouples all elements from the Clock
- **Per-element** — `playback.syncWithClock: false` on a specific element, allowing it to manage its own playback state independently

A decoupled element is useful for ambient loops, background audio, or elements the audience controls entirely on their own terms. This distinction needs to be formally resolved in Phase 1, as it directly affects the Clock engine architecture.

**Open-ended compositions:**
When `duration` is not set, the composition has no end. The Clock runs indefinitely after the last cue fires. A composition with zero cues is valid — the stage opens and waits for audience interaction entirely.

**Looping:**
When `loop: true` and the Clock reaches `duration`, it resets to zero and replays all cues. Each element has a `persistOnLoop` flag — if `true`, the element is not closed and reopened on loop; it stays on stage.

### Elements

Independent objects placed on the stage. Elements can be opened by the Clock (via a cue) or by a **link trigger** from another element, or both.

**Element types:**

| Type | Description |
|---|---|
| `video` | An embedded video from any URL. Has `muted` flag to suppress audio independently of the system. |
| `audio` | An audio source. Can be looped independently. |
| `image` | A static or animated image (GIF, WebP, PNG, SVG file). |
| `text` | A text container. Supports rich HTML content including inline links that can trigger other elements. |
| `graphic` | An SVG-based graphic element. Scalable, interactive, animatable via CSS. |
| `component` | A raw HTML/CSS container. Content is an HTML string. The author uses this to build buttons, custom window chrome, panels, and any UI that doesn't fit another type. Fully styled via CSS classes — no media dependency. |

**Element properties:**

Available in /composition/schema.md

**Notes:**
- `playback` applies to `video` and `audio` elements only. `playback.initial` sets whether the element starts playing or paused when it opens. `playback.audienceControl` determines whether the audience can play/pause the element. `playback.bar` gives each media element its own independent playback bar — separate from the stage-level Playback Bar, which controls the Clock. The element playback bar is fully CSS-styleable via `classNames`.
- `audio.initial` sets whether the element starts with audio on or off. `audio.audienceControl` determines whether the audience can toggle it. This gives four configurations: author-silenced with no control, author-silenced but audience can unmute, playing with no control, and playing with audience toggle. When `audienceControl: true`, the player renders a mute/unmute button whose appearance is fully CSS-controlled by the author.
- `position` and `size` values are in stage coordinate units (not pixels)
- `background: true` pins the element's z-index to always sit behind all other elements, effectively making it a stage background layer. The stage also has its own `background` property for a color/image/video — both approaches are supported.
- `animation.enter` and `animation.exit` are CSS class names injected by the player at mount and unmount. The author defines the transition in their stylesheet (e.g. a `fadeIn` keyframe on `.entering`).
- `muted` on a video element allows video content with audio that the author has chosen to silence independently of element-level controls.

### The Style Block

A CSS string embedded in the project JSON. The author writes CSS classes (`.window`, `.titlebar`, `.entering`, `.button`, etc.) applied to elements by class name. The Playback Bar is also styleable. All styles are scoped to the stage via **Shadow DOM** — author CSS cannot bleed into the host page, and host page CSS cannot affect the composition.

### Element Links (Open Question — needs schema design)

Elements can open other elements when the audience interacts with them. The trigger could be:
- Clicking the entire element
- Clicking a specific part of a `text` or `component` element (e.g. a `<span>` or `<button>` inside the content HTML)

The mechanism — how the link from a trigger to a target element ID is defined in the JSON and authored in the editor — is an open design question. This will be addressed when designing Phase 4 interactivity, but the element `open.mode: "link"` flag is reserved for it in Phase 1.

---

## Architecture

### Three Packages (Monorepo)

```
mise/
├── packages/
│   ├── core/        # Schema types, Zod validation, The Clock engine
│   ├── player/      # Runtime that reads project JSON and performs it
│   └── editor/      # Authoring tool (Edit Timeline, stage canvas, inspector)
```

### `@mise/core`
- TypeScript types for all schema entities
- Zod schemas for runtime validation
- The Clock — time engine, cue scheduling, loop handling, open-ended playback
- No UI, no framework — pure logic

### `@mise/player`
- Reads a project JSON and renders it in a browser
- Vanilla TypeScript, no framework dependency
- Mounts the stage inside a **Shadow DOM** for CSS isolation
- Renders the Playback Bar if configured
- Embeddable via `<script>` tag or iframe
- As small and portable as possible

### `@mise/editor`
- React-based authoring environment
- Loads the player in a preview iframe — what you see is what plays
- Contains the Edit Timeline, stage canvas, element property inspector, CSS editor
- **Tech stack is provisional** — the player and core are the stable foundation

---

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Clean package separation, fast builds |
| Language | TypeScript throughout | Schema is the core artifact |
| Schema validation | Zod | Single source for types + runtime validation |
| Player | Vanilla TypeScript | Maximum portability, no framework lock-in |
| CSS isolation | Shadow DOM | Bidirectional style isolation |
| Audio | Tone.js | Precise Web Audio scheduling |
| Editor (planned) | React + TypeScript | Best ecosystem for complex editor UIs |
| Editor state | Zustand + XState | UI state vs. playback state machine |
| Build | Vite | Standard, fast, works with Turborepo |

> The editor stack is provisional. Build and prove the player first.

---

## Development Stages

### Phase 1 — Core & Player ← *Start here*

**Goal:** A working player that reads a project JSON and renders elements on a stage.

**Phase 1 test composition** (written by hand as JSON):
A composition with multiple video elements (each with `muted` toggled differently), audio elements, and text elements. Multiple cue types: some elements open/close on timestamps, some are set to `userClose`. Some CSS styling for element windows. A looping element. A `persistOnLoop` element. This will exercise all core schema and Clock functionality.

**Tasks:**
- [x] Define and finalize the project JSON schema (`@mise/core`)
- [x] Implement Zod validation for schema
- [x] Build The Clock (cue scheduling, loop, open-ended)
- [x] Implement the player runtime (Shadow DOM stage, viewBox scaling)
- [x] Render: video (with muted flag), audio, image, text, component elements
- [x] Implement movable, resizable, closable flags
- [x] Implement CSS enter/exit animation class injection
- [x] Implement stage `background` property (color, image, video)
- [x] Implement element `background: true` z-index pinning
- [x] Render the Playback Bar (visible, interactive properties)
- [x] Basic README and schema documentation (`SCHEMA.md`)
- [x] Implement full CSS style block with Shadow DOM injection
- [ ] Style the Playback Bar via CSS `classNames`
- [ ] Style the default video/audio controls via CSS `classNames`
- [ ] Provide a default CSS theme for the all elements (default.css)
- [ ] Build and test audio elements with Tone.js
- [ ] Support for additional video and audio providers (YouTube, direct URLs)

### Phase 2 — Minimal Editor

**Goal:** A usable authoring tool that writes valid project JSON.

- [ ] Set up React editor app (`@mise/editor`)
- [ ] Stage preview pane (iframe running the player)
- [ ] Edit Timeline track UI with drag-to-reorder
- [ ] Element property inspector
- [ ] CSS code editor (Monaco or CodeMirror)
- [ ] Visual CSS property shortcuts (background, border, font, etc.)
- [ ] Asset management (link to external URLs — no upload)

### Phase 3 — Interactivity & Links

**Goal:** Elements can respond to audience input and trigger the Clock or other elements.

- [x] Design element link schema (trigger → target element ID)
- [x] Implement link-triggered element opening in the player
- [ ] State variables in project JSON
- [ ] Conditional element visibility

### Phase 4 — Platform & Community

**Goal:** Self-hostable and publicly accessible.

- [ ] Standalone player embed documentation
- [ ] Self-hosting guide
- [ ] Hosted platform (no media storage — authors link to Vimeo, CDN, etc.)
- [ ] `CONTRIBUTING.md` and plugin/theme ecosystem

### For Reconsideration in Future Phases

- [ ] Audience input handlers: hover, keypress
- [ ] Branching Clock support (jump to timestamp on event) (calcelled for later consideration)
- [ ] Develop the OS desktop aesthetic as a reference CSS theme (pushed for later consideration)
- [ ] Publish community CSS theme format spec (pushed for later consideration)
- [ ] Add `graphic` element type (SVG-based) (pushed for later consideration)

---

## Storage & Hosting Model

Mise does **not** host media. All assets are externally linked:
- Video: Vimeo, YouTube, any direct URL
- Audio, images: any CDN, Cloudflare R2, S3, etc.

The project file (JSON) is small and can live anywhere — a GitHub Gist, a CDN, a personal server. The player is a static bundle. Self-hosting requires no server-side infrastructure.

---

## Open Source Development

### Repository
- Public GitHub repository from day one
- License: **MIT** (recommended)
- Clear `README.md` from the start — it doubles as architectural documentation

### Git Workflow

> **Context for the author:** Currently working on `main` only without branching. This project is a good forcing function to learn proper open source workflow. The core rule: **never commit directly to `main`**. All work happens on branches, merged via Pull Requests.

**Branch structure:**
- `main` — stable, releasable code only
- `develop` — integration branch; features merge here first
- `feature/[name]` — one branch per unit of work (e.g. `feature/clock-engine`, `feature/player-video-element`)
- `fix/[name]` — bug fixes

**Workflow for each piece of work:**
```bash
# Always start from an up-to-date develop
git checkout develop
git pull

# Create a feature branch
git checkout -b feature/clock-engine

# Work and commit often with clear messages
git add .
git commit -m "feat: implement cue scheduling and loop in Clock"

# Push and open a Pull Request: feature/... → develop
git push origin feature/clock-engine
```

**Why PRs even as a solo developer:** Opening a PR forces you to read your own diff before merging. You will catch things you missed while writing. It also makes the project legible and contributable from day one — any outside contributor can immediately understand the workflow.

**Commit message convention** (Conventional Commits):
```
feat: add video element renderer to player
fix: correct timestamp offset in Clock cue firing
docs: update SCHEMA.md with component element type
chore: configure Turborepo build pipeline
refactor: extract Clock into standalone module
```

### Contributing Infrastructure (Phase 1 deliverables)
- `README.md` — what the project is, how to run it locally
- `CONTRIBUTING.md` — branch model, PR process, commit conventions
- `packages/core/SCHEMA.md` — full documentation of the project JSON format
- GitHub Issues for feature tracking and bugs
- GitHub Discussions for community conversation

---

## Synchronization Philosophy

Mise targets **expressive and narrative synchronization, not frame-accurate sync**. Authors should design compositions with this in mind — loose relationships between media elements, rather than tight frame-locked alignment.

The fundamental constraints of the web platform are real and permanent:
- Streaming video (Vimeo, YouTube, CDN) introduces variable buffering latency outside Mise's control
- The browser's `HTMLVideoElement.currentTime` API is not sample-accurate — seeking is approximate and varies across browsers
- The Web Audio API is precise for locally controlled audio, but streaming audio inherits the same latency problems as video
- Mise works in seconds (not frames), and frame rates vary anyway across sources

Best-effort synchronization — seeking all synced elements as close together as the browser allows — is the goal. In practice this lands within a few hundred milliseconds, which is appropriate for ambient, narrative, and interactive work. Frame-locked multi-screen sync requires dedicated hardware (Dataton Watchout, timecode generators) and is out of scope for a web-based platform.

This is not a limitation to engineer around. It is a characteristic of the medium to design with.

---

**Resolved:**
- ~~Poster image~~ — project-level only (`stage.poster`), not per-element.
- ~~Should entrance/exit animations be supported?~~ Yes — CSS class injection (`entering`/`exiting`).
- ~~Who is responsible for responsive sizing?~~ Coordinate units + aspect ratio, scales via CSS transform. Author-defined viewBox.
- ~~Can compositions have no defined end?~~ Yes — `duration` optional; Clock runs indefinitely.
- ~~Can a composition have no cues at all?~~ Yes — valid; fully audience-triggered.
- ~~Should background be a stage property or an element?~~ Both: `stage.background` for color/image/video, and `element.background: true` to pin any element to the back.
- ~~Should `video` support `muted`?~~ Yes — replaced by a full `audio` control model: `initial` state (`on`/`off`) and `audienceControl` flag. When audience control is enabled, a CSS-styleable toggle button is rendered by the player.
- ~~Three types of "timeline" — are they distinct?~~ Yes: The Clock, The Playback Bar, The Edit Timeline. Defined and named above.
- ~~Clock/element sync when seeking~~ — Default rule: when the Clock seeks to T, each synced element seeks to `T - element.open.at` seconds into its own media. If negative, element stays closed. If beyond element duration, shows last frame (or loops if `loop: true`). Authors set `playback.syncWithClock: false` for ambient/independent elements.
- ~~Multiple instances on one page~~ — Each player instance gets its own isolated Clock and Web Audio context. Shadow DOM handles CSS. Treat each instance like an independent iframe-equivalent.
- ~~Element links: how defined?~~ — Custom HTML data attribute inside `text` and `component` content: `<button data-mise-open="target-element-id">`. The player watches for clicks on any element with `data-mise-open` and opens the matching element. No JavaScript needed in the content.
- ~~Security: HTML content in `component` and `text`~~ — HTML-without-JS still carries risks (form submission, CSS exfiltration, meta redirects). Use DOMPurify to sanitize against a safe allowlist. Self-hosted authors can opt into trust mode. This is equivalent to running user-generated content on any web platform, not merely browsing a website.
- ~~Schema versioning~~ — Add `"version": "0.1"` to every project file from day one. No migration logic needed yet — just reserve the field so the player can read it when schema changes happen later.
- ~~How does the player load a project?~~ — Three supported modes, all valid: (1) HTML embed via data attribute on a div; (2) standalone URL with `?project=https://...` query param; (3) JavaScript API `new Mise('#container').load('https://...')`. These cover self-hosting, link-sharing, and developer integration.

**Still open:**
1. What is the minimum viable Phase 1 test composition JSON? Likely a small set of compositions: one testing all element types and their property combinations, one testing global playback/loop options, one testing audience interactivity (closable elements, audio controls). To be written by hand before any player code is written.
2. DOMPurify integration — does it go in `@mise/core` (sanitize at parse time) or `@mise/player` (sanitize at render time)? Render time is safer since it's closer to the DOM. Decide at the start of Phase 1.

**Resolved — interaction model:**
- ~~`data-mise-open` scope~~ — Use `data-mise-action` from the start for extensibility. Initial supported values: `"open:element-id"`, with `"close:element-id"` and `"seek:90"` reserved for Phase 4. The editor will build UI around generating these attributes so authors don't need to write them by hand.

**Resolved — player loading:**
All three loading modes will be supported, prioritizing ease of use for non-developers:
1. **HTML data attribute** (simplest — works in any website builder like Cargo): `<div data-mise-project="https://..."></div>` plus a script tag. No coding required.
2. **Standalone URL** (for sharing): `https://mise.app/play?project=https://...`
3. **JavaScript API** (for developers): `new Mise('#container').load('https://...')`

**Resolved — versioning:**
Add `"version": "0.1"` to every project file. Goal is linear, additive schema growth so all versions remain forever playable. New features add new optional fields; nothing is ever removed. Breaking changes are a last resort and will be clearly documented.

---

## Reference Projects to Study

- **Theatre.js** — open source animation editor/runtime, closest architectural cousin
- **Resolume Avenue** — VJ software, useful mental model for cue-based timeline
- **Ren'Py** — for thinking about branching narrative and link-trigger logic
- **GreenSock (GSAP)** — study its sequencing and timeline API design
- **SVG viewBox spec** — the coordinate system model used for the stage
