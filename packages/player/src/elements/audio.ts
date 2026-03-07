import type { MiseElement } from "@mise/core";
import type { ElementRenderer } from "./renderer";

export class AudioElement implements ElementRenderer {
  private readonly element: MiseElement;
  private audioEl: HTMLAudioElement | null = null;
  readonly syncWithClock: boolean;

  constructor(element: MiseElement) {
    this.element = element;
    this.syncWithClock = element.playback?.syncWithClock ?? false;
  }

  mount(): void {
    const el = this.element;

    const audio = document.createElement("audio");
    audio.src = el.src ?? "";

    if (el.playback?.loop) {
      audio.loop = true;
    }
    if (el.audio?.initial === "off") {
      audio.muted = true;
    }

    this.audioEl = audio;

    if (el.playback?.initial === "playing") {
      audio.play().catch(() => {});
    }
  }

  unmount(): void {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = "";
      this.audioEl = null;
    }
  }

  seek(elementTime: number): void {
    if (!this.syncWithClock || !this.audioEl) return;
    this.audioEl.currentTime = Math.max(0, elementTime);
  }

  pause(): void {
    if (!this.syncWithClock || !this.audioEl) return;
    this.audioEl.pause();
  }

  resume(): void {
    if (!this.syncWithClock || !this.audioEl) return;
    this.audioEl.play().catch(() => {});
  }
}
