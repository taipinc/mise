import type { Clock, MiseComposition } from "@mise/core";

const HOVER_MARGIN = 40;

function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? "0" : ""}${rem}`;
}

function computeHorizon(composition: MiseComposition): number {
  if (composition.stage.playback.duration !== null) {
    return composition.stage.playback.duration;
  }
  let max = 0;
  for (const el of composition.elements) {
    if (el.open.at > max) max = el.open.at;
    if (el.close.at !== null && el.close.at > max) max = el.close.at;
  }
  return max;
}

export class PlaybackBar {
  private readonly stageRoot: HTMLDivElement;
  private readonly clock: Clock;
  private readonly onSeek: (seconds: number) => void;
  private readonly onPlay: () => void;
  private readonly onPause: () => void;
  private readonly interactive: boolean;
  private readonly horizon: number;
  private readonly stageHeight: number;

  private barEl: HTMLDivElement;
  private playPauseBtn: HTMLDivElement;
  private scrubTrack: HTMLDivElement;
  private playhead: HTMLDivElement;
  private timeCurrentEl: HTMLSpanElement | null = null;
  private timeTotalEl: HTMLSpanElement | null = null;
  private readonly duration: number | null;

  private isPlaying = false;
  private isDragging = false;
  private wasPlayingBeforeDrag = false;
  private barVisible = false;

  constructor(
    stageRoot: HTMLDivElement,
    clock: Clock,
    composition: MiseComposition,
    onSeek: (seconds: number) => void,
    onPlay: () => void,
    onPause: () => void
  ) {
    this.stageRoot = stageRoot;
    this.clock = clock;
    this.onSeek = onSeek;
    this.onPlay = onPlay;
    this.onPause = onPause;
    this.interactive = composition.stage.playbackBar.interactive;
    this.horizon = computeHorizon(composition);
    this.stageHeight = composition.stage.viewBox.height;
    this.duration = composition.stage.playback.duration;

    // Build DOM
    this.barEl = document.createElement("div");
    this.barEl.classList.add("mise-playback-bar");
    for (const cls of composition.stage.playbackBar.classNames) {
      this.barEl.classList.add(cls);
    }

    this.playPauseBtn = document.createElement("div");
    this.playPauseBtn.classList.add("mise-play-pause-btn");
    this.playPauseBtn.textContent = "\u25B6";
    this.barEl.appendChild(this.playPauseBtn);

    const pbBar = composition.stage.playbackBar;

    if (pbBar.showCurrentTime) {
      this.timeCurrentEl = document.createElement("span");
      this.timeCurrentEl.classList.add("mise-time-current");
      for (const cls of pbBar.timeCurrentClassNames ?? []) {
        this.timeCurrentEl.classList.add(cls);
      }
      this.timeCurrentEl.textContent = "0:00";
      this.barEl.appendChild(this.timeCurrentEl);
    }

    this.scrubTrack = document.createElement("div");
    this.scrubTrack.classList.add("mise-scrub-track");
    this.barEl.appendChild(this.scrubTrack);

    this.playhead = document.createElement("div");
    this.playhead.classList.add("mise-playhead");
    this.scrubTrack.appendChild(this.playhead);

    if (pbBar.showTotalTime) {
      this.timeTotalEl = document.createElement("span");
      this.timeTotalEl.classList.add("mise-time-total");
      for (const cls of pbBar.timeTotalClassNames ?? []) {
        this.timeTotalEl.classList.add(cls);
      }
      this.timeTotalEl.textContent = this.duration !== null ? formatTime(this.duration) : "\u221E";
      this.barEl.appendChild(this.timeTotalEl);
    }

    stageRoot.appendChild(this.barEl);

    // Wire events
    this.playPauseBtn.addEventListener("click", this.onPlayPauseClick);

    if (this.interactive) {
      this.scrubTrack.addEventListener("pointerdown", this.onTrackPointerDown);
      this.playhead.addEventListener("pointerdown", this.onPlayheadPointerDown);
      this.playhead.addEventListener("pointermove", this.onPlayheadPointerMove);
      this.playhead.addEventListener("pointerup", this.onPlayheadPointerUp);
    }

    stageRoot.addEventListener("pointermove", this.onStagePointerMove);
    stageRoot.addEventListener("pointerleave", this.onStagePointerLeave);

    // Sync playhead on tick
    clock.on("tick", (e) => {
      if (e.type !== "tick") return;
      if (!this.isPlaying) {
        this.isPlaying = true;
        this.updatePlayPauseButton();
      }
      if (!this.isDragging) {
        this.updatePlayhead(e.time);
      }
      if (this.timeCurrentEl) {
        this.timeCurrentEl.textContent = formatTime(e.time);
      }
    });
  }

  destroy(): void {
    this.playPauseBtn.removeEventListener("click", this.onPlayPauseClick);
    this.scrubTrack.removeEventListener("pointerdown", this.onTrackPointerDown);
    this.playhead.removeEventListener("pointerdown", this.onPlayheadPointerDown);
    this.playhead.removeEventListener("pointermove", this.onPlayheadPointerMove);
    this.playhead.removeEventListener("pointerup", this.onPlayheadPointerUp);
    this.stageRoot.removeEventListener("pointermove", this.onStagePointerMove);
    this.stageRoot.removeEventListener("pointerleave", this.onStagePointerLeave);
    this.barEl.remove();
  }

  /** Called by the player to sync the button state when play/pause is triggered externally. */
  syncPlayState(playing: boolean): void {
    this.isPlaying = playing;
    this.updatePlayPauseButton();
  }

  // --- Play / Pause ---

  private onPlayPauseClick = (): void => {
    if (this.isPlaying) {
      this.onPause();
    } else {
      this.onPlay();
    }
  };

  private updatePlayPauseButton(): void {
    this.playPauseBtn.textContent = this.isPlaying ? "\u23F8" : "\u25B6";
  }

  // --- Playhead position ---

  private updatePlayhead(time: number): void {
    const trackWidth = this.scrubTrack.offsetWidth;
    const playheadWidth = this.playhead.offsetWidth || 20;
    if (this.horizon <= 0 || trackWidth <= 0) return;

    if (time >= this.horizon) {
      this.playhead.style.left = `${trackWidth - playheadWidth}px`;
      this.playhead.textContent = "\u221E";
    } else {
      const ratio = time / this.horizon;
      const maxLeft = trackWidth - playheadWidth;
      this.playhead.style.left = `${ratio * maxLeft}px`;
      this.playhead.textContent = "";
    }
  }

  // --- Scrub track click-to-seek ---

  private onTrackPointerDown = (e: PointerEvent): void => {
    if (e.target === this.playhead) return;
    e.preventDefault();
    const time = this.pointerToTime(e);
    this.onSeek(time);
    this.updatePlayhead(time);
  };

  // --- Playhead drag ---

  private onPlayheadPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.playhead.setPointerCapture(e.pointerId);
    this.isDragging = true;
    this.wasPlayingBeforeDrag = this.isPlaying;
    if (this.isPlaying) {
      this.onPause();
    }
  };

  private onPlayheadPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    e.preventDefault();
    const time = this.pointerToTime(e);
    this.onSeek(time);
    this.updatePlayhead(time);
  };

  private onPlayheadPointerUp = (e: PointerEvent): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.playhead.releasePointerCapture(e.pointerId);
    if (this.wasPlayingBeforeDrag) {
      this.onPlay();
    }
  };

  private pointerToTime(e: PointerEvent): number {
    const rect = this.scrubTrack.getBoundingClientRect();
    const scale = rect.width / this.scrubTrack.offsetWidth;
    const trackWidth = this.scrubTrack.offsetWidth;
    const playheadWidth = this.playhead.offsetWidth || 20;
    const x = (e.clientX - rect.left) / scale;
    const ratio = Math.max(0, Math.min(1, x / (trackWidth - playheadWidth)));
    return ratio * this.horizon;
  }

  // --- Hover show/hide ---

  private onStagePointerMove = (e: PointerEvent): void => {
    const stageRect = this.stageRoot.getBoundingClientRect();
    const scale = stageRect.width / this.stageRoot.offsetWidth;
    const stageY = (e.clientY - stageRect.top) / scale;

    // Derive hover zone from the bar's actual rendered position and height
    const barTop = this.barEl.offsetTop;
    const barHeight = this.barEl.offsetHeight;
    const hoverStart = barTop - HOVER_MARGIN;
    const hoverEnd = barTop + barHeight;

    const shouldShow = stageY >= hoverStart && stageY <= hoverEnd;
    if (shouldShow && !this.barVisible) {
      this.barVisible = true;
      this.barEl.classList.add("mise-playback-bar-visible");
    } else if (!shouldShow && this.barVisible && !this.isDragging) {
      this.barVisible = false;
      this.barEl.classList.remove("mise-playback-bar-visible");
    }
  };

  private onStagePointerLeave = (): void => {
    if (this.isDragging) return;
    this.barVisible = false;
    this.barEl.classList.remove("mise-playback-bar-visible");
  };
}
