# Mise

**Mise** is an open-source platform for creating and playing web-based interactive timeline compositions.

The name comes from *mise-en-scène* — the art of placing and arranging everything within the frame. An author *mises* a composition: places elements in time and space, arranges their relationships, and sets the stage.

Think of it as a video editor whose output is not a rendered video file, but a living, interactive webpage. A sequence of independent media and UI elements — video, audio, image, text, and custom components — arranged on a timeline and displayed on a stage. Because the output runs in a browser, elements remain independent objects: interactive, resizable, movable, and fully styleable with CSS. Nothing gets baked into a flat file.

**Mise** is inspired by the works of artists such as Basel Abbas and Ruanne Abou-Rahme ([May amensia never kiss us on the mouth](https://mayamnesia.diaart.org/postscript)), Camille Henrot ([Grosse Fatigue](https://vk.com/video-136471876_456241753)), Lawrence Abu Hamdan ([Air Pressure](https://www.airpressure.info/on-the-ground/)), Zach Blas ([576 Tears](https://576tears.ai/)), Lama Suleiman ([Parallax Haifa](https://palestineinbetween.com/PARALLAX-HAIFA)), and others.

---

## How It Works

An author writes (or generates) a **project JSON file** that describes a composition: the stage dimensions, background, CSS styles, and a list of elements with their positions, sizes, cue times, and behaviors. The **player** reads that file and performs it in a browser.

Elements appear and disappear on cue. The audience can interact with them — drag, resize, close, play, pause — depending on what the author has enabled. A Playback Bar lets the audience scrub through the composition's timeline.

---

## Packages

Mise is a pnpm monorepo with three packages:

| Package | Description |
|---|---|
| `@mise/core` | TypeScript types, Zod validation schemas, and the Clock engine |
| `@mise/player` | The runtime that reads a project JSON and renders it in a browser |
| `@mise/editor` | The visual authoring tool for creating and editing compositions |

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Install

```bash
git clone https://github.com/taipinc/mise.git
cd mise
pnpm install
```

### Run the player (standalone)

```bash
cd packages/player
pnpm dev
```

Open `http://localhost:5173` in your browser. The player loads `compositions/test04.json` by default.

### Run the editor

The editor embeds the player in an iframe, so **both dev servers must be running**.

**Terminal 1** — start the player:
```bash
cd packages/player
pnpm dev
```

**Terminal 2** — start the editor:
```bash
cd packages/editor
pnpm dev
```

Open `http://localhost:5180` in a Chromium-based browser (Chrome, Edge, Arc, Brave — required for file open/save).

---

## The Editor

The editor is a four-panel authoring environment built with React, Zustand, and Tailwind CSS.

```
┌──────────────────────────────────────────────────┐
│ Toolbar (Open, Save, Play/Pause, filename)       │
├────────┬─────────────────────────┬───────────────┤
│ Stage  │                         │   Inspector   │
│ View   │   Stage Preview         │               │
│        │   (live player)         │               │
│        │                         │               │
├────────┴─────────────────────────┴───────────────┤
│ Timeline                                         │
└──────────────────────────────────────────────────┘
```

- **Toolbar** — Open/save composition JSON files via the File System Access API. Play/pause transport controls.
- **Stage View** (left) — Element list grouped by past/present/future based on the current clock time. Add new elements with the "+" button, delete with the trash icon on hover. Click to select.
- **Stage Preview** (center) — Live player preview that updates in real time as you edit. Aspect-ratio fitted to the composition's viewBox.
- **Inspector** (right) — When no element is selected: edit stage settings (viewBox, playback, playback bar) and author CSS styles in a CodeMirror editor. When an element is selected: edit cues, position, size, flags, source URL, HTML content, playback, and audio settings.
- **Timeline** (bottom) — Interactive timeline with a draggable playhead, zoom (Ctrl+scroll or buttons), color-coded element blocks, and auto-scroll during playback. Click a block to select the element.

---

## Project File

A Mise composition is a single JSON file. Here is a minimal example:

```json
{
  "version": "0.1",
  "meta": {
    "title": "My Composition",
    "author": "Your Name"
  },
  "stage": {
    "viewBox": { "width": 1920, "height": 1080 },
    "scaling": true,
    "background": "#000000",
    "playback": {
      "duration": 120,
      "loop": false
    },
    "playbackBar": {
      "visible": true,
      "interactive": true
    }
  },
  "elements": [
    {
      "id": "intro-video",
      "type": "video",
      "src": "https://vimeo.com/your-video-id",
      "open": { "mode": "cue", "at": 0 },
      "close": { "mode": "cue", "at": 30 },
      "position": { "x": 640, "y": 360 },
      "size": { "width": 640, "height": 360 },
      "playback": { "initial": "playing", "audienceControl": false }
    }
  ]
}
```

See [`SCHEMA.md`](./packages/core/SCHEMA.md) for the full schema reference.

---

## Status

Phase 1 (core schema, Clock engine, and player runtime) is complete. Phase 2 (editor) is in progress — the authoring tool is functional with live preview, property editing, element management, and file I/O. See the [project context document](./CONTEXT.md) for the full roadmap.

---

## Contributing

Mise is open source under the MIT license. Contributions are welcome.

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request.

---

## License

MIT
