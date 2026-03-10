import type { MiseElement } from "@mise/core";
import type { ElementRenderer } from "./renderer";
import {
  createMuteButton,
  createPlayPauseButton,
  createScrubTrack,
  type MuteButton,
  type PlayPauseButton,
  type ScrubTrack,
} from "./controls";
import { applyFlags, type FlagsCleanup } from "./flags";
import { applyAnimation } from "./animation";

const FADE_STEP_MS = 50;

export class AudioElement implements ElementRenderer {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private readonly onCloseCallback: (() => void) | null;
  private audioEl: HTMLAudioElement | null = null;
  private wrapper: HTMLDivElement | null = null;
  private muteButton: MuteButton | null = null;
  private playPauseButton: PlayPauseButton | null = null;
  private scrubTrack: ScrubTrack | null = null;
  private flagsCleanup: FlagsCleanup | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;
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
    audio.preload = "auto";
    if (el.playback?.loop) audio.loop = true;
    if (el.audio?.initial === "off") audio.muted = true;
    this.audioEl = audio;

    // Set initial volume for fade-in: start at 0 so the ramp is audible
    const fadeInMs = el.audio?.fadeIn ?? 0;
    if (fadeInMs > 0) {
      audio.volume = 0;
    }

    const wantsPlay = el.playback?.initial === "playing";

    // Visible wrapper
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

    // Icon
    const icon = document.createElement("div");
    icon.classList.add("mise-audio-icon");
    icon.textContent = "\u266A";
    body.appendChild(icon);

    // Controls row
    const hasPlayPause = el.playback?.audienceControl;
    const hasScrub = el.playback?.bar?.visible;
    const hasMute = el.audio?.audienceControl;

    if (hasPlayPause || hasScrub || hasMute) {
      const controls = document.createElement("div");
      controls.classList.add("mise-audio-controls");

      if (hasPlayPause || hasScrub) {
        this.playPauseButton = createPlayPauseButton(wantsPlay, (playing) => {
          if (!this.audioEl) return;
          if (playing) {
            this.audioEl.play().catch(() => {});
          } else {
            this.audioEl.pause();
          }
        });
        controls.appendChild(this.playPauseButton.element);
      }

      if (hasScrub) {
        this.scrubTrack = createScrubTrack((fraction) => {
          if (!this.audioEl || !this.audioEl.duration) return;
          this.audioEl.currentTime = fraction * this.audioEl.duration;
        });
        controls.appendChild(this.scrubTrack.element);

        // Poll currentTime to update scrub position
        this.pollTimer = setInterval(() => {
          if (!this.audioEl || !this.scrubTrack || !this.audioEl.duration) return;
          this.scrubTrack.update(this.audioEl.currentTime / this.audioEl.duration);
        }, 250);
      }

      if (hasMute) {
        this.muteButton = createMuteButton(
          el.audio?.initial === "off",
          (muted) => {
            if (this.audioEl) this.audioEl.muted = muted;
          }
        );
        controls.appendChild(this.muteButton.element);
      }

      body.appendChild(controls);
    }

    wrapper.appendChild(body);
    this.stageRoot.appendChild(wrapper);
    this.wrapper = wrapper;

    applyAnimation(wrapper, el.animation.enter);

    this.flagsCleanup = applyFlags(wrapper, el, this.stageRoot, () => {
      this.unmount();
      this.onCloseCallback?.();
    });

    if (wantsPlay) {
      // Wait for enough data before playing — some browsers won't load
      // audio that isn't in the DOM until explicitly triggered
      audio.load();
      const tryPlay = (): void => {
        audio.play().catch(() => {});
        this.startFadeIn();
      };
      if (audio.readyState >= 2) {
        tryPlay();
      } else {
        audio.addEventListener("canplay", tryPlay, { once: true });
      }
    } else if (fadeInMs > 0) {
      // Not autoplaying but fade-in is set — ramp will start when
      // audience manually hits play (volume is already at 0)
      this.startFadeIn();
    }
  }

  unmount(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.muteButton) {
      this.muteButton.destroy();
      this.muteButton = null;
    }
    if (this.playPauseButton) {
      this.playPauseButton.destroy();
      this.playPauseButton = null;
    }
    if (this.scrubTrack) {
      this.scrubTrack.destroy();
      this.scrubTrack = null;
    }
    if (this.flagsCleanup) {
      this.flagsCleanup.destroy();
      this.flagsCleanup = null;
    }

    const fadeOutMs = this.element.audio?.fadeOut ?? 0;

    const cleanupAudio = (): void => {
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.src = "";
        this.audioEl = null;
      }
    };

    if (fadeOutMs > 0 && this.audioEl) {
      this.startFadeOut(() => {
        cleanupAudio();
      });
    } else {
      cleanupAudio();
    }

    // CSS exit animation runs in parallel with volume fade
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
    this.playPauseButton?.setPlaying(false);
  }

  resume(): void {
    if (!this.syncWithClock || !this.audioEl) return;
    this.audioEl.play().catch(() => {});
    this.playPauseButton?.setPlaying(true);
  }

  // --- Volume fade helpers ---

  private cancelFade(): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private startFadeIn(): void {
    const fadeInMs = this.element.audio?.fadeIn ?? 0;
    if (fadeInMs <= 0 || !this.audioEl) return;

    this.cancelFade();

    const audio = this.audioEl;
    const steps = Math.max(1, Math.floor(fadeInMs / FADE_STEP_MS));
    const stepDuration = fadeInMs / steps;
    const volumeStep = 1 / steps;
    let currentStep = 0;

    this.fadeTimer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps || !this.audioEl) {
        if (this.audioEl) this.audioEl.volume = 1;
        this.cancelFade();
        return;
      }
      audio.volume = Math.min(1, volumeStep * currentStep);
    }, stepDuration);
  }

  private startFadeOut(onComplete: () => void): void {
    this.cancelFade();

    const fadeOutMs = this.element.audio?.fadeOut ?? 0;
    if (fadeOutMs <= 0 || !this.audioEl) {
      onComplete();
      return;
    }

    const audio = this.audioEl;
    const startVolume = audio.volume;
    if (startVolume <= 0) {
      onComplete();
      return;
    }

    const steps = Math.max(1, Math.floor(fadeOutMs / FADE_STEP_MS));
    const stepDuration = fadeOutMs / steps;
    const volumeStep = startVolume / steps;
    let currentStep = 0;
    let done = false;

    const finish = (): void => {
      if (done) return;
      done = true;
      this.cancelFade();
      if (this.audioEl) this.audioEl.volume = 0;
      onComplete();
    };

    this.fadeTimer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps || !this.audioEl) {
        finish();
        return;
      }
      audio.volume = Math.max(0, startVolume - volumeStep * currentStep);
    }, stepDuration);

    // Safety timeout — same pattern as animation.exit
    setTimeout(finish, fadeOutMs + 100);
  }
}
