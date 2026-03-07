import { Clock } from "@mise/core";
import type { MiseComposition } from "@mise/core";
import { Stage } from "./stage";

export class MisePlayer {
  private readonly stage: Stage;
  private readonly clock: Clock;

  constructor(host: HTMLElement, composition: MiseComposition) {
    this.stage = new Stage(composition, host);
    this.clock = new Clock(composition);
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
  }

  destroy(): void {
    this.clock.destroy();
    this.stage.destroy();
  }
}
