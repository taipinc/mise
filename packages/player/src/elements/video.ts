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

const ASSUMED_VIDEO_ASPECT = 16 / 9;

function applyCoverSize(iframe: HTMLIFrameElement, containerW: number, containerH: number): void {
  const containerAspect = containerW / containerH;
  let iframeW: number;
  let iframeH: number;

  if (containerAspect > ASSUMED_VIDEO_ASPECT) {
    // Container is wider than video — match width, overflow height
    iframeW = containerW;
    iframeH = containerW / ASSUMED_VIDEO_ASPECT;
  } else {
    // Container is taller than video — match height, overflow width
    iframeH = containerH;
    iframeW = containerH * ASSUMED_VIDEO_ASPECT;
  }

  iframe.style.width = `${iframeW}px`;
  iframe.style.height = `${iframeH}px`;
}

export class VideoElement implements ElementRenderer {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private readonly onCloseCallback: (() => void) | null;
  private wrapper: HTMLDivElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private vimeoPlayer: Player | null = null;
  private flagsCleanup: FlagsCleanup | null = null;
  private resizeObserver: ResizeObserver | null = null;
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
    wrapper.classList.add("mise-element", "mise-type-video");
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

    // Clip container for mediaFit — iframe can't receive object-fit directly
    const clipContainer = document.createElement("div");
    clipContainer.classList.add("mise-video-clip");

    const iframe = document.createElement("iframe");
    iframe.src = `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
    iframe.setAttribute("allow", "autoplay; fullscreen");

    if (el.mediaFit === "fit") {
      // Contain: iframe fits within the box, no crop
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    } else {
      // Cover (default): iframe sized to cover container, centered and clipped
      iframe.style.position = "absolute";
      iframe.style.top = "50%";
      iframe.style.left = "50%";
      iframe.style.transform = "translate(-50%, -50%)";
      applyCoverSize(iframe, el.size.width, el.size.height);

      // Recompute on resize (user drag-resize)
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          applyCoverSize(iframe, entry.contentRect.width, entry.contentRect.height);
        }
      });
      this.resizeObserver.observe(clipContainer);
    }

    clipContainer.appendChild(iframe);
    body.appendChild(clipContainer);
    wrapper.appendChild(body);
    this.stageRoot.appendChild(wrapper);
    this.wrapper = wrapper;
    this.iframe = iframe;

    applyAnimation(wrapper, el.animation.enter);

    this.flagsCleanup = applyFlags(wrapper, el, this.stageRoot, () => {
      this.unmount();
      this.onCloseCallback?.();
    });

    const player = new Player(iframe);
    this.vimeoPlayer = player;

    player.ready().then(async () => {
      if (wantsAutoplay) {
        player.play().catch(() => {});
      }
      if (!wantsMuted) {
        player.setMuted(false).catch(() => {});
      }

      // For "fit" mode, shrink wrapper to the video's native aspect ratio
      // so controls match the visible video area (no letterbox padding)
      if (el.mediaFit === "fit" && wrapper) {
        try {
          const [nativeW, nativeH] = await Promise.all([
            player.getVideoWidth(),
            player.getVideoHeight(),
          ]);
          if (nativeW && nativeH) {
            const videoAspect = nativeW / nativeH;
            const boxW = el.size.width;
            const boxH = el.size.height;
            const boxAspect = boxW / boxH;

            let fitW: number;
            let fitH: number;
            if (videoAspect > boxAspect) {
              // Video is wider — width-limited
              fitW = boxW;
              fitH = boxW / videoAspect;
            } else {
              // Video is taller — height-limited
              fitH = boxH;
              fitW = boxH * videoAspect;
            }

            wrapper.style.width = `${fitW}px`;
            wrapper.style.height = `${fitH}px`;
          }
        } catch {
          // Unable to get dimensions — keep authored size
        }
      }
    }).catch(() => {});
  }

  unmount(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
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
