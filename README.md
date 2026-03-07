# Mise

**Mise** is an open-source platform for creating and playing web-based interactive timeline compositions.

The name comes from *mise-en-scène* — the art of placing and arranging everything within the frame. An author *mises* a composition: places elements in time and space, arranges their relationships, and sets the stage.

Think of it as a video editor whose output is not a rendered video file, but a living, interactive webpage. A sequence of independent media and UI elements — video, audio, image, text, and custom components — arranged on a timeline and displayed on a stage. Because the output runs in a browser, elements remain independent objects: interactive, resizable, movable, and fully styleable with CSS. Nothing gets baked into a flat file.

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
| `@mise/editor` | The authoring tool *(planned — Phase 3)* |

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

### Run the player

```bash
cd packages/player
pnpm dev
```

Open `http://localhost:5173` in your browser. The player loads `compositions/test02.json` by default.

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

Mise is in early development. Phase 1 (core schema, Clock engine, and player runtime) is complete. See the [project context document](./CONTEXT.md) for the full roadmap.

---

## Contributing

Mise is open source under the MIT license. Contributions are welcome.

Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a pull request.

---

## License

MIT
