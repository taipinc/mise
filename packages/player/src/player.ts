import { Clock } from "@mise/core";
import type { MiseComposition, MiseElement } from "@mise/core";
import { Stage } from "./stage";
import { VideoElement } from "./elements/video";

export class MisePlayer {
  private readonly stage: Stage;
  private readonly clock: Clock;
  private readonly composition: MiseComposition;
  private readonly mountedElements: Map<string, VideoElement> = new Map();

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
  }

  get currentTime(): number {
    return this.clock.currentTime;
  }

  getClock(): Clock {
    return this.clock;
  }

  play(): void {
    this.clock.play();
  }

  pause(): void {
    this.clock.pause();
  }

  seek(seconds: number): void {
    this.clock.seek(seconds);

    for (const [id, renderer] of this.mountedElements) {
      if (!renderer.syncWithClock) continue;
      const el = this.findElement(id);
      if (!el) continue;
      renderer.seek(seconds - el.open.at);
    }
  }

  destroy(): void {
    for (const renderer of this.mountedElements.values()) {
      renderer.unmount();
    }
    this.mountedElements.clear();
    this.clock.destroy();
    this.stage.destroy();
  }

  private onElementOpen(elementId: string): void {
    if (this.mountedElements.has(elementId)) return;

    const el = this.findElement(elementId);
    if (!el) return;

    if (el.type === "video") {
      const renderer = new VideoElement(el, this.stage.root);
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
