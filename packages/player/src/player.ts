import { Clock } from "@mise/core";
import type { MiseComposition, MiseElement } from "@mise/core";
import { Stage } from "./stage";
import type { ElementRenderer } from "./elements/renderer";
import { VideoElement } from "./elements/video";
import { AudioElement } from "./elements/audio";
import { ImageElement } from "./elements/image";
import { TextElement } from "./elements/text";
import { ComponentElement } from "./elements/component";
import { PlaybackBar } from "./playback-bar";
import { IntroScreen } from "./intro-screen";
import { PostMessageBridge } from "./post-message-bridge";

export interface MisePlayerOptions {
  skipIntro?: boolean;
}

export class MisePlayer {
  private readonly stage: Stage;
  private readonly clock: Clock;
  private readonly composition: MiseComposition;
  private readonly mountedElements: Map<string, ElementRenderer> = new Map();
  private readonly userClosedElements: Set<string> = new Set();
  private readonly playbackBar: PlaybackBar | null = null;
  private introScreen: IntroScreen | null = null;
  private globalMuted: boolean = false;
  private readonly skipIntro: boolean;
  private readonly postMessageBridge: PostMessageBridge;

  constructor(
    host: HTMLElement,
    composition: MiseComposition,
    options?: MisePlayerOptions
  ) {
    this.composition = composition;
    this.skipIntro = options?.skipIntro ?? false;
    this.stage = new Stage(composition, host);
    this.clock = new Clock(composition);

    this.clock.on("open", (e) => {
      if (e.type === "open") this.onElementOpen(e.elementId);
    });

    this.clock.on("close", (e) => {
      if (e.type === "close") this.onElementClose(e.elementId);
    });

    if (composition.stage.playbackBar.visible) {
      this.playbackBar = new PlaybackBar(
        this.stage.root,
        this.clock,
        composition,
        (seconds) => this.seek(seconds),
        () => this.play(),
        () => this.pause(),
        (muted) => this.setGlobalMuted(muted)
      );
    }

    this.postMessageBridge = new PostMessageBridge(this);

    const introEnabled = composition.stage.intro?.enabled ?? true;
    if (introEnabled && !this.skipIntro) {
      this.introScreen = new IntroScreen(
        this.stage.root,
        composition,
        () => this.play()
      );
    }
  }

  get currentTime(): number {
    return this.clock.currentTime;
  }

  getClock(): Clock {
    return this.clock;
  }

  play(): void {
    if (this.introScreen) {
      this.introScreen.dismiss();
      this.introScreen = null;
    }
    this.clock.play();
    this.playbackBar?.syncPlayState(true);
    this.postMessageBridge.notifyStateChange("playing");
    this.resumeSyncedElements();
  }

  pause(): void {
    this.clock.pause();
    this.playbackBar?.syncPlayState(false);
    this.postMessageBridge.notifyStateChange("paused");
    this.pauseSyncedElements();
  }

  seek(seconds: number): void {
    this.clock.seek(seconds);
    this.reconcileElements(seconds);
  }

  private reconcileElements(time: number): void {
    for (const el of this.composition.elements) {
      if (el.open.mode === "link") continue;

      // If we seeked before this element's open cue, reset its user-closed state
      if (time < el.open.at) {
        this.userClosedElements.delete(el.id);
      }

      const shouldBeOpen =
        el.open.at <= time &&
        (el.close.mode === "none" || el.close.at === null || el.close.at > time);

      const isMounted = this.mountedElements.has(el.id);

      if (shouldBeOpen && !isMounted && !this.userClosedElements.has(el.id)) {
        this.onElementOpen(el.id);
      } else if (!shouldBeOpen && isMounted) {
        this.onElementClose(el.id);
      }

      // Seek synced elements to their local time
      if (shouldBeOpen && isMounted) {
        const renderer = this.mountedElements.get(el.id);
        if (renderer && renderer.syncWithClock) {
          renderer.seek(time - el.open.at);
        }
      }
    }
  }

  destroy(): void {
    for (const renderer of this.mountedElements.values()) {
      renderer.unmount();
    }
    this.mountedElements.clear();
    this.introScreen?.destroy();
    this.playbackBar?.destroy();
    this.postMessageBridge.destroy();
    this.clock.destroy();
    this.stage.destroy();
  }

  private onElementOpen(elementId: string): void {
    if (this.mountedElements.has(elementId)) return;

    const el = this.findElement(elementId);
    if (!el) return;

    const onClose = (): void => {
      this.userClosedElements.add(elementId);
      this.mountedElements.delete(elementId);
    };
    const onAction = (action: string): void => {
      this.handleAction(action);
    };

    let renderer: ElementRenderer | null = null;

    switch (el.type) {
      case "video":
        renderer = new VideoElement(el, this.stage.root, onClose);
        break;
      case "audio":
        renderer = new AudioElement(el, this.stage.root, onClose);
        break;
      case "image":
        renderer = new ImageElement(el, this.stage.root, onClose);
        break;
      case "text":
        renderer = new TextElement(el, this.stage.root, onClose);
        break;
      case "component":
        renderer = new ComponentElement(el, this.stage.root, onClose, onAction);
        break;
    }

    if (!renderer) return;

    renderer.mount();
    if (this.globalMuted) {
      renderer.setGlobalMuted(true);
    }
    this.mountedElements.set(elementId, renderer);

    const wrapper = this.stage.root.querySelector(
      `[data-mise-id="${elementId}"]`
    ) as HTMLElement | null;

    if (wrapper && el.visible === false) {
      // Strip any enter animation class so it can't flash visible
      if (el.animation.enter) {
        wrapper.classList.remove(el.animation.enter);
      }
      wrapper.style.opacity = "0";
      wrapper.style.pointerEvents = "none";
    }

    if (wrapper) {
      if (el.background) {
        // Background pinning: force z-index 0, prevent zIndexable from raising
        wrapper.style.zIndex = "0";
      } else if (el.zIndex === null) {
        // Auto z-index: place above all currently visible elements
        let max = 0;
        for (const child of this.stage.root.children) {
          const z = parseInt((child as HTMLElement).style.zIndex || "0", 10);
          if (z > max) max = z;
        }
        wrapper.style.zIndex = String(max + 1);
      }
    }
  }

  private onElementClose(elementId: string): void {
    const renderer = this.mountedElements.get(elementId);
    if (!renderer) return;
    renderer.unmount();
    this.mountedElements.delete(elementId);
  }


  private handleAction(action: string): void {
    const match = action.match(/^(open|close|seek):(.+)$/);
    if (!match) return;

    const [, verb, value] = match;
    if (verb === "open") {
      this.onElementOpen(value);
    } else if (verb === "close") {
      this.onElementClose(value);
    } else if (verb === "seek") {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) {
        this.seek(seconds);
      }
    }
  }

  private pauseSyncedElements(): void {
    for (const renderer of this.mountedElements.values()) {
      if (renderer.syncWithClock) {
        renderer.pause();
      }
    }
  }

  private resumeSyncedElements(): void {
    for (const renderer of this.mountedElements.values()) {
      if (renderer.syncWithClock) {
        renderer.resume();
      }
    }
  }

  private setGlobalMuted(muted: boolean): void {
    this.globalMuted = muted;
    for (const renderer of this.mountedElements.values()) {
      renderer.setGlobalMuted(muted);
    }
  }

  private findElement(id: string): MiseElement | undefined {
    return this.composition.elements.find((el) => el.id === id);
  }
}
