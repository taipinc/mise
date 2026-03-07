import { Clock } from "@mise/core";
import type { MiseComposition, MiseElement } from "@mise/core";
import { Stage } from "./stage";
import { VideoElement } from "./elements/video";
import { PlaybackBar } from "./playback-bar";

export class MisePlayer {
  private readonly stage: Stage;
  private readonly clock: Clock;
  private readonly composition: MiseComposition;
  private readonly mountedElements: Map<string, VideoElement> = new Map();
  private readonly playbackBar: PlaybackBar | null = null;

  constructor(host: HTMLElement, composition: MiseComposition) {
    this.composition = composition;
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
        (seconds) => this.seek(seconds)
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
    this.clock.play();
    this.playbackBar?.syncPlayState(true);
  }

  pause(): void {
    this.clock.pause();
    this.playbackBar?.syncPlayState(false);
  }

  seek(seconds: number): void {
    this.clock.seek(seconds);
    this.reconcileElements(seconds);
  }

  private reconcileElements(time: number): void {
    for (const el of this.composition.elements) {
      if (el.open.mode === "link") continue;

      const shouldBeOpen =
        el.open.at <= time &&
        (el.close.mode === "none" || el.close.at === null || el.close.at > time);

      const isMounted = this.mountedElements.has(el.id);

      if (shouldBeOpen && !isMounted) {
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
    this.playbackBar?.destroy();
    this.clock.destroy();
    this.stage.destroy();
  }

  private onElementOpen(elementId: string): void {
    if (this.mountedElements.has(elementId)) return;

    const el = this.findElement(elementId);
    if (!el) return;

    if (el.type === "video") {
      const renderer = new VideoElement(el, this.stage.root, () => {
        this.mountedElements.delete(elementId);
      });
      renderer.mount();
      this.mountedElements.set(elementId, renderer);
    }
  }

  private onElementClose(elementId: string): void {
    const renderer = this.mountedElements.get(elementId);
    if (!renderer) return;
    renderer.unmount();
    this.mountedElements.delete(elementId);
  }


  private findElement(id: string): MiseElement | undefined {
    return this.composition.elements.find((el) => el.id === id);
  }
}
