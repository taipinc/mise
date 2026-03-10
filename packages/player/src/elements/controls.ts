// --- Mute Button ---

export interface MuteButton {
  element: HTMLDivElement;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export function createMuteButton(
  initialMuted: boolean,
  onToggle: (muted: boolean) => void
): MuteButton {
  let muted = initialMuted;

  const btn = document.createElement("div");
  btn.classList.add("mise-mute-btn");
  btn.textContent = muted ? "M" : "\u266A";

  const onClick = (e: Event): void => {
    e.stopPropagation();
    muted = !muted;
    btn.textContent = muted ? "M" : "\u266A";
    onToggle(muted);
  };

  btn.addEventListener("click", onClick);

  return {
    element: btn,
    setMuted(value: boolean): void {
      muted = value;
      btn.textContent = muted ? "M" : "\u266A";
    },
    destroy(): void {
      btn.removeEventListener("click", onClick);
      btn.remove();
    },
  };
}

// --- Play/Pause Button ---

export interface PlayPauseButton {
  element: HTMLDivElement;
  setPlaying(playing: boolean): void;
  destroy(): void;
}

export function createPlayPauseButton(
  initialPlaying: boolean,
  onToggle: (playing: boolean) => void
): PlayPauseButton {
  let playing = initialPlaying;

  const btn = document.createElement("div");
  btn.classList.add("mise-play-pause-btn");
  btn.textContent = playing ? "\u23F8" : "\u25B6";

  const onClick = (e: Event): void => {
    e.stopPropagation();
    playing = !playing;
    btn.textContent = playing ? "\u23F8" : "\u25B6";
    onToggle(playing);
  };

  btn.addEventListener("click", onClick);

  return {
    element: btn,
    setPlaying(value: boolean): void {
      playing = value;
      btn.textContent = playing ? "\u23F8" : "\u25B6";
    },
    destroy(): void {
      btn.removeEventListener("click", onClick);
      btn.remove();
    },
  };
}

// --- Element Playbar ---

export interface ElementPlaybar {
  element: HTMLDivElement;
  update(fraction: number): void;
  setPlaying(playing: boolean): void;
  destroy(): void;
}

export function createElementPlaybar(
  initialPlaying: boolean,
  classNames: string[],
  onPlayPause: (playing: boolean) => void,
  onSeek: (fraction: number) => void
): ElementPlaybar {
  const bar = document.createElement("div");
  bar.classList.add("mise-element-playbar");
  for (const cls of classNames) {
    bar.classList.add(cls);
  }

  const ppBtn = createPlayPauseButton(initialPlaying, onPlayPause);
  bar.appendChild(ppBtn.element);

  const scrub = createScrubTrack(onSeek);
  bar.appendChild(scrub.element);

  return {
    element: bar,
    update(fraction: number): void {
      scrub.update(fraction);
    },
    setPlaying(playing: boolean): void {
      ppBtn.setPlaying(playing);
    },
    destroy(): void {
      ppBtn.destroy();
      scrub.destroy();
      bar.remove();
    },
  };
}

// --- Scrub Track ---

export interface ScrubTrack {
  element: HTMLDivElement;
  update(fraction: number): void;
  destroy(): void;
}

export function createScrubTrack(
  onSeek: (fraction: number) => void
): ScrubTrack {
  const track = document.createElement("div");
  track.classList.add("mise-scrub-track");

  const playhead = document.createElement("div");
  playhead.classList.add("mise-playhead");
  track.appendChild(playhead);

  let dragging = false;

  const fractionFromEvent = (e: PointerEvent): number => {
    const rect = track.getBoundingClientRect();
    const scale = rect.width / (track.offsetWidth || rect.width);
    const phW = playhead.offsetWidth || 20;
    const maxLeft = track.offsetWidth - phW;
    if (maxLeft <= 0) return 0;
    const x = (e.clientX - rect.left) / scale;
    return Math.max(0, Math.min(1, x / maxLeft));
  };

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    playhead.setPointerCapture(e.pointerId);
    dragging = true;
    const f = fractionFromEvent(e);
    updatePosition(f);
    onSeek(f);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    e.preventDefault();
    const f = fractionFromEvent(e);
    updatePosition(f);
    onSeek(f);
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    playhead.releasePointerCapture(e.pointerId);
  };

  const updatePosition = (fraction: number): void => {
    const phW = playhead.offsetWidth || 20;
    const maxLeft = track.offsetWidth - phW;
    playhead.style.left = `${Math.max(0, fraction * maxLeft)}px`;
  };

  track.addEventListener("pointerdown", onPointerDown);
  track.addEventListener("pointermove", onPointerMove);
  track.addEventListener("pointerup", onPointerUp);

  return {
    element: track,
    update(fraction: number): void {
      if (!dragging) updatePosition(fraction);
    },
    destroy(): void {
      track.removeEventListener("pointerdown", onPointerDown);
      track.removeEventListener("pointermove", onPointerMove);
      track.removeEventListener("pointerup", onPointerUp);
      track.remove();
    },
  };
}
