export interface ElementRenderer {
  readonly syncWithClock: boolean;
  mount(): void;
  unmount(): void;
  seek(elementTime: number): void;
  pause(): void;
  resume(): void;
  setGlobalMuted(muted: boolean): void;
}
