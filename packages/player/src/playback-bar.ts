import type { Clock, MiseComposition } from "@mise/core";

const BAR_HEIGHT = 20;
const PLAYHEAD_SIZE = 20;
const PLAY_BTN_WIDTH = 40;
const HOVER_ZONE = 60;

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
  private readonly interactive: boolean;
  private readonly horizon: number;
  private readonly stageHeight: number;

  private barEl: HTMLDivElement;
  private playPauseBtn: HTMLDivElement;
  private scrubTrack: HTMLDivElement;
  private playhead: HTMLDivElement;

  private isPlaying = false;
  private isDragging = false;
  private wasPlayingBeforeDrag = false;
  private barVisible = false;

  constructor(
    stageRoot: HTMLDivElement,
    clock: Clock,
    composition: MiseComposition,
    onSeek: (seconds: number) => void
  ) {
    this.stageRoot = stageRoot;
    this.clock = clock;
    this.onSeek = onSeek;
    this.interactive = composition.stage.playbackBar.interactive;
    this.horizon = computeHorizon(composition);
    this.stageHeight = composition.stage.viewBox.height;

    // Build DOM
    this.barEl = document.createElement("div");
    this.barEl.classList.add("mise-playback-bar");

    this.playPauseBtn = document.createElement("div");
    this.playPauseBtn.classList.add("mise-play-pause-btn");
    this.playPauseBtn.textContent = "\u25B6";
    this.barEl.appendChild(this.playPauseBtn);

    this.scrubTrack = document.createElement("div");
    this.scrubTrack.classList.add("mise-scrub-track");
    this.barEl.appendChild(this.scrubTrack);

    this.playhead = document.createElement("div");
    this.playhead.classList.add("mise-playhead");
    this.scrubTrack.appendChild(this.playhead);

    stageRoot.appendChild(this.barEl);

    // Wire events
    this.playPauseBtn.addEventListener("click", this.onPlayPauseClick);

    if (this.interactive) {
      this.scrubTrack.addEventListener("pointerdown", this.onTrackPointerDown);
      this.playhead.addEventListener("pointerdown", this.onPlayheadPointerDown);
      this.playhead.addEventListener("pointermove", this.onPlayheadPointerMove);
      this.playhead.addEventListener("pointerup", this.onPlayheadPointerUp);
      this.playhead.style.touchAction = "none";
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
      this.clock.pause();
      this.isPlaying = false;
    } else {
      this.clock.play();
      this.isPlaying = true;
    }
    this.updatePlayPauseButton();
  };

  private updatePlayPauseButton(): void {
    this.playPauseBtn.textContent = this.isPlaying ? "\u23F8" : "\u25B6";
  }

  // --- Playhead position ---

  private updatePlayhead(time: number): void {
    const trackWidth = this.scrubTrack.offsetWidth;
    if (this.horizon <= 0 || trackWidth <= 0) return;

    if (time >= this.horizon) {
      this.playhead.style.left = `${trackWidth - PLAYHEAD_SIZE}px`;
      this.playhead.textContent = "\u221E";
    } else {
      const ratio = time / this.horizon;
      const maxLeft = trackWidth - PLAYHEAD_SIZE;
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
      this.clock.pause();
      this.isPlaying = false;
      this.updatePlayPauseButton();
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
      this.clock.play();
      this.isPlaying = true;
      this.updatePlayPauseButton();
    }
  };

  private pointerToTime(e: PointerEvent): number {
    const rect = this.scrubTrack.getBoundingClientRect();
    const scale = rect.width / this.scrubTrack.offsetWidth;
    const trackWidth = this.scrubTrack.offsetWidth;
    const x = (e.clientX - rect.left) / scale;
    const ratio = Math.max(0, Math.min(1, x / (trackWidth - PLAYHEAD_SIZE)));
    return ratio * this.horizon;
  }

  // --- Hover show/hide ---

  private onStagePointerMove = (e: PointerEvent): void => {
    const rect = this.stageRoot.getBoundingClientRect();
    const scale = rect.width / this.stageRoot.offsetWidth;
    const stageY = (e.clientY - rect.top) / scale;

    const shouldShow = stageY >= this.stageHeight - HOVER_ZONE;
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
