import type { MiseElement } from "@mise/core";
import Player from "@vimeo/player";

function extractVimeoId(src: string): string {
  const match = src.match(/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Cannot extract Vimeo ID from: ${src}`);
  }
  return match[1];
}

export class VideoElement {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private iframe: HTMLIFrameElement | null = null;
  private vimeoPlayer: Player | null = null;
  readonly syncWithClock: boolean;

  constructor(element: MiseElement, stageRoot: HTMLDivElement) {
    this.element = element;
    this.stageRoot = stageRoot;
    this.syncWithClock = element.playback?.syncWithClock ?? false;
  }

  mount(): void {
    const el = this.element;
    const videoId = extractVimeoId(el.src ?? "");

    const wantsAutoplay = el.playback?.initial === "playing";
    const wantsMuted = el.audio?.initial === "off";

    const params = new URLSearchParams();
    if (wantsAutoplay) {
      params.set("autoplay", "1");
    }
    // Browsers block unmuted autoplay — start muted to guarantee playback starts
    if (wantsAutoplay || wantsMuted) {
      params.set("muted", "1");
    }
    if (el.playback?.loop) {
      params.set("loop", "1");
    }
    params.set("controls", el.playback?.audienceControl ? "1" : "0");

    const iframe = document.createElement("iframe");
    iframe.src = `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
    iframe.style.position = "absolute";
    iframe.style.left = `${el.position.x}px`;
    iframe.style.top = `${el.position.y}px`;
    iframe.style.width = `${el.size.width}px`;
    iframe.style.height = `${el.size.height}px`;
    iframe.style.border = "none";
    iframe.setAttribute("allow", "autoplay; fullscreen");
    iframe.dataset.miseId = el.id;

    if (el.zIndex !== null) {
      iframe.style.zIndex = String(el.zIndex);
    }

    this.stageRoot.appendChild(iframe);
    this.iframe = iframe;

    const player = new Player(iframe);
    this.vimeoPlayer = player;

    player.ready().then(() => {
      if (wantsAutoplay) {
        player.play().catch(() => {});
      }
      // Unmute after playback starts if audio.initial is "on"
      if (!wantsMuted) {
        player.setMuted(false).catch(() => {});
      }
    }).catch(() => {});
  }

  unmount(): void {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.destroy().catch(() => {});
      this.vimeoPlayer = null;
    }
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  seek(elementTime: number): void {
    if (!this.syncWithClock || !this.vimeoPlayer) return;
    this.vimeoPlayer.setCurrentTime(Math.max(0, elementTime)).catch(() => {});
  }
}
