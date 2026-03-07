# Mise Schema Reference

**Version:** 0.1

A Mise composition is described by a single JSON file. This document defines every field in that file, its type, its default value, and what it does.

---

## Top-level

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | `string` | ✅ | Schema version. Always `"0.1"`. Used by the player to parse the file correctly as the format evolves. |
| `meta` | `Meta` | — | Human-readable information about the composition. Has no effect on playback. |
| `stage` | `Stage` | ✅ | Defines the canvas, background, playback behavior, and Playback Bar. |
| `elements` | `Element[]` | ✅ | The list of media and UI objects that appear on the stage. May be empty. |

---

## Meta

Optional block for author-facing metadata. None of these fields affect playback.

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Display name of the composition. |
| `author` | `string` | Name of the author. |
| `description` | `string` | A short description. |
| `created` | `string` | ISO 8601 date string. |
| `modified` | `string` | ISO 8601 date string. |

---

## Stage

| Field | Type | Default | Description |
|---|---|---|---|
| `viewBox` | `ViewBox` | — | Defines the coordinate space of the stage. Elements are positioned and sized in these units. |
| `scaling` | `boolean` | `true` | When `true`, the stage scales to fill its container while preserving aspect ratio. When `false`, the stage renders at its natural coordinate size. |
| `background` | `string` | `""` | The stage background. Accepts a CSS color value (e.g. `"#000"`, `"rgb(0,0,0)"`), an image URL, or a video URL (`.mp4`, `.webm`, `.ogg`). |
| `poster` | `string` | `""` | A thumbnail image URL shown before the composition begins — the composition's cover image. |
| `styles` | `string` | `""` | A CSS string scoped to the stage via Shadow DOM. Authors write all element styling here using the class names assigned to elements. Host page CSS cannot affect the stage, and stage CSS cannot affect the host page. |
| `playback` | `StagePlayback` | — | Clock and loop configuration. |
| `playbackBar` | `PlaybackBar` | — | The audience-facing timeline UI. |

### ViewBox

| Field | Type | Description |
|---|---|---|
| `width` | `number` | Horizontal extent of the coordinate space. |
| `height` | `number` | Vertical extent of the coordinate space. |

A `viewBox` of `{ width: 1920, height: 1080 }` and `{ width: 16, height: 9 }` define the same aspect ratio. Authors position elements using these coordinate units — the player handles the mapping to actual screen pixels.

### StagePlayback

| Field | Type | Default | Description |
|---|---|---|---|
| `duration` | `number \| null` | `null` | The length of the composition in seconds. When `null`, the composition is open-ended: the Clock runs indefinitely after the last cue. |
| `loop` | `boolean` | `false` | When `true` and `duration` is set, the Clock resets to zero when it reaches `duration` and all cues replay. Elements with `persistOnLoop: true` are not closed and reopened on loop. |
| `sync.withClock` | `boolean` | `true` | Global default for element sync behavior. When `true`, all elements sync their playback position to the Clock when seeking or pausing. Individual elements can override this with their own `playback.syncWithClock` flag. |

### PlaybackBar

The optional audience-facing transport control rendered at the bottom of the stage.

| Field | Type | Default | Description |
|---|---|---|---|
| `visible` | `boolean` | `true` | Whether the Playback Bar is rendered at all. |
| `interactive` | `boolean` | `true` | When `true`, the audience can click to seek and drag the playhead. When `false`, the bar is a read-only progress indicator. |
| `classNames` | `string[]` | `[]` | CSS class names applied to the `.mise-playback-bar` element. Use these in the `stage.styles` CSS string to style the bar. |

---

## Elements

Each object in the `elements` array defines one media or UI object on the stage.

### Common Fields

These fields apply to all element types.

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | — | **Required.** A unique identifier for this element within the composition. Used to reference the element in links and actions. |
| `type` | `ElementType` | — | **Required.** The kind of element. One of: `"video"`, `"audio"`, `"image"`, `"text"`, `"graphic"`, `"component"`. |
| `src` | `string \| null` | `null` | The media source URL. Used by `video`, `audio`, and `image` types. |
| `content` | `string \| null` | `null` | An HTML string. Used by `text` and `component` types. Sanitized with DOMPurify before rendering. |
| `open` | `ElementOpen` | — | When and how the element appears on the stage. |
| `close` | `ElementClose` | — | When and how the element leaves the stage. |
| `persistOnLoop` | `boolean` | `false` | When `true` and the stage loops, this element is not closed and reopened at loop reset — it stays on stage. |
| `position` | `Position` | — | The top-left corner of the element in stage coordinate units. |
| `size` | `Size` | — | The width and height of the element in stage coordinate units. |
| `zIndex` | `number \| null` | `null` | Stacking order. `null` means auto: elements stack in the order their `open` cues fire. An integer overrides this. |
| `background` | `boolean` | `false` | When `true`, this element is pinned behind all others regardless of `zIndex`. Useful for a full-stage background layer. |
| `classNames` | `string[]` | `[]` | CSS class names applied to the element's wrapper div. Use these in `stage.styles` to style the element. |
| `flags` | `Flags` | — | Interaction behaviors available to the audience. |
| `animation` | `Animation` | — | CSS class names injected at mount and unmount for enter/exit transitions. |

### ElementOpen

| Field | Type | Description |
|---|---|---|
| `mode` | `"cue" \| "link" \| "both"` | `"cue"`: element opens when the Clock reaches `at`. `"link"`: element opens only when triggered by a `data-mise-action` on another element. `"both"`: either condition can open it. |
| `at` | `number \| null` | The Clock time in seconds at which this element opens. Required when `mode` is `"cue"` or `"both"`. |

### ElementClose

| Field | Type | Description |
|---|---|---|
| `mode` | `"cue" \| "userClose" \| "none"` | `"cue"`: element closes when the Clock reaches `at`. `"userClose"`: element stays open until the audience closes it via the close button. `"none"`: element never closes. |
| `at` | `number \| null` | The Clock time in seconds at which this element closes. Required when `mode` is `"cue"`. |

### Playback

Applies to `video` and `audio` elements only.

| Field | Type | Default | Description |
|---|---|---|---|
| `initial` | `"playing" \| "paused"` | `"playing"` | Whether the element starts playing or paused when it opens. |
| `loop` | `boolean` | `false` | Whether the media loops when it reaches its end. |
| `syncWithClock` | `boolean` | `true` | When `true`, this element's playback position syncs to the Clock on seek and pause/resume. When `false`, the element manages its own playback independently. Overrides the stage-level `sync.withClock` default. |
| `audienceControl` | `boolean` | `true` | Whether the audience can play and pause this element. |
| `bar.visible` | `boolean` | `false` | Whether this element has its own playback bar (separate from the stage Playback Bar). |
| `bar.classNames` | `string[]` | `[]` | CSS class names for this element's playback bar. |

### Audio

Applies to `video` and `audio` elements only.

| Field | Type | Default | Description |
|---|---|---|---|
| `initial` | `"on" \| "off"` | `"on"` | Whether the element starts with audio on or muted. |
| `audienceControl` | `boolean` | `false` | When `true`, the player renders a mute/unmute toggle button on the element. The button is fully styleable via CSS. |

### Position

| Field | Type | Description |
|---|---|---|
| `x` | `number` | Distance from the left edge of the stage in coordinate units. Represents the top-left corner of the element. |
| `y` | `number` | Distance from the top edge of the stage in coordinate units. Represents the top-left corner of the element. |

### Size

| Field | Type | Description |
|---|---|---|
| `width` | `number` | Element width in stage coordinate units. |
| `height` | `number` | Element height in stage coordinate units. |

### Flags

Controls what interaction behaviors the audience has on this element.

| Field | Type | Default | Description |
|---|---|---|---|
| `movable` | `boolean` | `false` | The audience can drag the element around the stage. |
| `resizable` | `boolean` | `false` | The audience can resize the element via a drag handle. |
| `closable` | `boolean` | `false` | The audience can close (dismiss) the element via a close button. |
| `zIndexable` | `boolean` | `false` | Clicking the element brings it to the front of the stacking order. |

### Animation

CSS class names injected by the player at mount and unmount. Authors define the actual animations in `stage.styles`.

| Field | Type | Description |
|---|---|---|
| `enter` | `string` | Class name added to the element immediately on mount. Removed after 500ms. |
| `exit` | `string` | Class name added to the element on unmount. The player waits for a `transitionend` event (or 600ms timeout) before removing the element from the DOM. |

**Example:**
```css
/* In stage.styles */
.entering {
  animation: fadeIn 0.3s ease forwards;
}
.exiting {
  animation: fadeOut 0.3s ease forwards;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
```

---

## Element Interactions (`data-mise-action`)

Inside the `content` HTML of `text` and `component` elements, any element with a `data-mise-action` attribute will be watched by the player for click events.

| Value | Effect |
|---|---|
| `"open:element-id"` | Opens the element with the matching `id`. |
| `"close:element-id"` | *(Phase 4)* Closes the element with the matching `id`. |
| `"seek:90"` | *(Phase 4)* Seeks the Clock to the given time in seconds. |

**Example:**
```html
<button data-mise-action="open:my-panel">Open Panel</button>
```

---

## Player CSS Classes

These class names are applied by the player to its rendered UI elements. Authors can target them in `stage.styles`.

| Class | Element |
|---|---|
| `.mise-element` | Wrapper div for every element on the stage |
| `.mise-close-btn` | The close button added when `flags.closable` is `true` |
| `.mise-playback-bar` | The stage Playback Bar container |
| `.mise-scrub-track` | The scrub track inside the Playback Bar |
| `.mise-playhead` | The playhead inside the Playback Bar |
| `.mise-play-pause-btn` | The play/pause button inside the Playback Bar |
