import type { MiseElement } from "@mise/core";
import Player from "@vimeo/player";
import type { ElementRenderer } from "./renderer";
import { applyFlags, type FlagsCleanup } from "./flags";
import { applyAnimation } from "./animation";

function extractVimeoId(src: string): string {
  const match = src.match(/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Cannot extract Vimeo ID from: ${src}`);
  }
  return match[1];
}

export class VideoElement implements ElementRenderer {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private readonly onCloseCallback: (() => void) | null;
  private wrapper: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private vimeoPlayer: Player | null = null;
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
    params.set("autopause", "0");

    // Wrapper div holds the iframe + flag UI (close btn, resize handle)
    const wrapper = document.createElement("div");
    wrapper.classList.add("mise-element");
    wrapper.style.position = "absolute";
    wrapper.style.left = `${el.position.x}px`;
    wrapper.style.top = `${el.position.y}px`;
    wrapper.style.width = `${el.size.width}px`;
    wrapper.style.height = `${el.size.height}px`;
    wrapper.dataset.miseId = el.id;

    if (el.zIndex !== null) {
      wrapper.style.zIndex = String(el.zIndex);
    }

    // Clip container for mediaFit — iframe can't receive object-fit directly
    const clipContainer = document.createElement("div");
    clipContainer.style.width = "100%";
    clipContainer.style.height = "100%";
    clipContainer.style.overflow = "hidden";
    clipContainer.style.position = "relative";

    const iframe = document.createElement("iframe");
    iframe.src = `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
    iframe.style.border = "none";
    iframe.style.display = "block";
    iframe.setAttribute("allow", "autoplay; fullscreen");

    if (el.mediaFit === "fit") {
      // Contain: iframe fits within the box, no crop
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    } else {
      // Cover (default): oversized iframe centered, clipped by container
      iframe.style.position = "absolute";
      iframe.style.top = "50%";
      iframe.style.left = "50%";
      iframe.style.width = "177.78vh";
      iframe.style.height = "56.25vw";
      iframe.style.minWidth = "100%";
      iframe.style.minHeight = "100%";
      iframe.style.transform = "translate(-50%, -50%)";
    }

    clipContainer.appendChild(iframe);
    wrapper.appendChild(clipContainer);
    this.stageRoot.appendChild(wrapper);
    this.wrapper = wrapper;
    this.iframe = iframe;

    applyAnimation(wrapper, el.animation.enter);

    this.flagsCleanup = applyFlags(wrapper, el, this.stageRoot, () => {
      this.unmount();
      this.onCloseCallback?.();
    });

    for (const cls of el.classNames) {
      wrapper.classList.add(cls);
    }

    const player = new Player(iframe);
    this.vimeoPlayer = player;

    player.ready().then(() => {
      if (wantsAutoplay) {
        player.play().catch(() => {});
      }
      if (!wantsMuted) {
        player.setMuted(false).catch(() => {});
      }
    }).catch(() => {});
  }

  unmount(): void {
    if (this.flagsCleanup) {
      this.flagsCleanup.destroy();
      this.flagsCleanup = null;
    }
    const vp = this.vimeoPlayer;
    this.vimeoPlayer = null;
    if (this.wrapper) {
      applyAnimation(this.wrapper, this.element.animation.exit, () => {
        if (vp) {
          vp.destroy().catch(() => {});
        }
        this.wrapper?.remove();
        this.wrapper = null;
        this.iframe = null;
      });
    } else if (vp) {
      vp.destroy().catch(() => {});
    }
  }

  seek(elementTime: number): void {
    if (!this.syncWithClock || !this.vimeoPlayer) return;
    this.vimeoPlayer.setCurrentTime(Math.max(0, elementTime)).catch(() => {});
  }

  pause(): void {
    if (!this.syncWithClock || !this.vimeoPlayer) return;
    this.vimeoPlayer.pause().catch(() => {});
  }

  resume(): void {
    if (!this.syncWithClock || !this.vimeoPlayer) return;
    this.vimeoPlayer.play().catch(() => {});
  }
}
