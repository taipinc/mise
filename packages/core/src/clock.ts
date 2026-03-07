import type { MiseComposition, MiseElement } from "./types";

export type ClockEvent = "open" | "close" | "tick" | "end";

export interface ClockOpenEvent {
  type: "open";
  elementId: string;
  time: number;
}

export interface ClockCloseEvent {
  type: "close";
  elementId: string;
  time: number;
}

export interface ClockTickEvent {
  type: "tick";
  time: number;
}

export interface ClockEndEvent {
  type: "end";
  time: number;
}

export type ClockEventData =
  | ClockOpenEvent
  | ClockCloseEvent
  | ClockTickEvent
  | ClockEndEvent;

type ClockHandler = (event: ClockEventData) => void;

interface Cue {
  elementId: string;
  time: number;
  action: "open" | "close";
}

const TICK_INTERVAL_MS = 16;

export class Clock {
  private readonly duration: number | null;
  private readonly loop: boolean;
  private readonly cues: Cue[];
  private readonly handlers: Map<ClockEvent, Set<ClockHandler>> = new Map();

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTimestamp: number = 0;
  private elapsed: number = 0;
  private firedCues: Set<number> = new Set();
  private playing: boolean = false;

  constructor(composition: MiseComposition) {
    this.duration = composition.stage.playback.duration;
    this.loop = composition.stage.playback.loop;
    this.cues = this.buildCues(composition.elements);
  }

  get currentTime(): number {
    if (!this.playing) {
      return this.elapsed;
    }
    return this.elapsed + (performance.now() - this.startTimestamp) / 1000;
  }

  on(event: ClockEvent, handler: ClockHandler): void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
  }

  off(event: ClockEvent, handler: ClockHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.startTimestamp = performance.now();
    this.intervalId = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  pause(): void {
    if (!this.playing) return;
    this.elapsed = this.currentTime;
    this.playing = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  seek(seconds: number): void {
    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.pause();
    }

    this.elapsed = Math.max(0, seconds);
    this.firedCues.clear();

    // Mark cues before the seek position as already fired
    for (let i = 0; i < this.cues.length; i++) {
      if (this.cues[i].time <= this.elapsed) {
        this.firedCues.add(i);
      }
    }

    if (wasPlaying) {
      this.play();
    }
  }

  destroy(): void {
    this.pause();
    this.handlers.clear();
  }

  private buildCues(elements: MiseElement[]): Cue[] {
    const cues: Cue[] = [];

    for (const el of elements) {
      if (el.open.mode === "cue" || el.open.mode === "both") {
        cues.push({ elementId: el.id, time: el.open.at, action: "open" });
      }

      if (el.close.mode === "cue" && el.close.at !== null) {
        cues.push({ elementId: el.id, time: el.close.at, action: "close" });
      }
    }

    cues.sort((a, b) => a.time - b.time);
    return cues;
  }

  private tick(): void {
    const time = this.currentTime;

    // Fire cues that have been reached
    for (let i = 0; i < this.cues.length; i++) {
      if (this.firedCues.has(i)) continue;
      const cue = this.cues[i];
      if (cue.time <= time) {
        this.firedCues.add(i);
        this.emit({
          type: cue.action,
          elementId: cue.elementId,
          time,
        } as ClockOpenEvent | ClockCloseEvent);
      }
    }

    this.emit({ type: "tick", time });

    // Check for end / loop
    if (this.duration !== null && time >= this.duration) {
      if (this.loop) {
        this.elapsed = 0;
        this.startTimestamp = performance.now();
        this.firedCues.clear();
      } else {
        this.pause();
        this.elapsed = this.duration;
        this.emit({ type: "end", time: this.duration });
      }
    }
  }

  private emit(event: ClockEventData): void {
    const set = this.handlers.get(event.type);
    if (!set) return;
    for (const handler of set) {
      handler(event);
    }
  }
}
