import type { MiseElement } from "@mise/core";
import type { ElementRenderer } from "./renderer";
import { createMuteButton, type MuteButton } from "./controls";
import { applyFlags, type FlagsCleanup } from "./flags";
import { applyAnimation } from "./animation";

export class AudioElement implements ElementRenderer {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private readonly onCloseCallback: (() => void) | null;
  private audioEl: HTMLAudioElement | null = null;
  private wrapper: HTMLDivElement | null = null;
  private muteButton: MuteButton | null = null;
  private flagsCleanup: FlagsCleanup | null = null;
  readonly syncWithClock: boolean;

  constructor(element: MiseElement, stageRoot: HTMLDivElement, onClose?: () => void) {
    this.element = element;
    this.stageRoot = stageRoot;
    this.onCloseCallback = onClose ?? null;
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

    // If audio.audienceControl is true, render a visible wrapper with the mute button
    if (el.audio?.audienceControl) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("mise-element", "mise-type-audio");
      wrapper.style.left = `${el.position.x}px`;
      wrapper.style.top = `${el.position.y}px`;
      wrapper.style.width = `${el.size.width}px`;
      wrapper.style.height = `${el.size.height}px`;
      wrapper.dataset.miseId = el.id;

      if (el.zIndex !== null) {
        wrapper.style.zIndex = String(el.zIndex);
      }

      const body = document.createElement("div");
      body.classList.add("mise-body");
      for (const cls of el.classNames) {
        body.classList.add(cls);
      }
      wrapper.appendChild(body);

      this.muteButton = createMuteButton(
        el.audio.initial === "off",
        (muted) => {
          if (this.audioEl) this.audioEl.muted = muted;
        }
      );
      wrapper.appendChild(this.muteButton.element);

      this.stageRoot.appendChild(wrapper);
      this.wrapper = wrapper;

      applyAnimation(wrapper, el.animation.enter);

      this.flagsCleanup = applyFlags(wrapper, el, this.stageRoot, () => {
        this.unmount();
        this.onCloseCallback?.();
      });
    }
  }

  unmount(): void {
    if (this.muteButton) {
      this.muteButton.destroy();
      this.muteButton = null;
    }
    if (this.flagsCleanup) {
      this.flagsCleanup.destroy();
      this.flagsCleanup = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = "";
      this.audioEl = null;
    }
    if (this.wrapper) {
      applyAnimation(this.wrapper, this.element.animation.exit, () => {
        this.wrapper?.remove();
        this.wrapper = null;
      });
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
