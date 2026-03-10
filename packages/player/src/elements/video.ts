import type { MiseElement } from "@mise/core";
import VimeoPlayer from "@vimeo/player";
import type { ElementRenderer } from "./renderer";
import { applyFlags, type FlagsCleanup } from "./flags";
import { applyAnimation } from "./animation";
import { createMuteButton, createElementPlaybar, type MuteButton, type ElementPlaybar } from "./controls";

// --- Provider detection ---
// TODO: YouTube support is a future provider branch following the same pattern as Vimeo.

type VideoProvider = "vimeo" | "youtube" | "native";

function detectProvider(src: string): VideoProvider {
  if (/vimeo\.com\//i.test(src)) return "vimeo";
  if (/youtube\.com|youtu\.be/i.test(src)) return "youtube";
  return "native";
}

function extractVimeoId(src: string): string {
  const match = src.match(/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Cannot extract Vimeo ID from: ${src}`);
  }
  return match[1];
}

function extractYouTubeId(src: string): string {
  // youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  let match = src.match(/[?&]v=([^&#]+)/);
  if (match) return match[1];
  match = src.match(/youtu\.be\/([^?&#]+)/);
  if (match) return match[1];
  match = src.match(/\/embed\/([^?&#]+)/);
  if (match) return match[1];
  throw new Error(`Cannot extract YouTube ID from: ${src}`);
}

// --- YouTube IFrame API loader (singleton) ---

interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

interface YTPlayerConstructor {
  new (element: HTMLElement, options: {
    videoId: string;
    width?: number;
    height?: number;
    playerVars?: Record<string, number | string>;
    events?: {
      onReady?: (event: { target: YTPlayerInstance }) => void;
      onStateChange?: (event: { data: number }) => void;
    };
  }): YTPlayerInstance;
}

declare global {
  interface Window {
    YT?: { Player: YTPlayerConstructor };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (ytApiPromise) return ytApiPromise;
  if (window.YT?.Player) {
    ytApiPromise = Promise.resolve();
    return ytApiPromise;
  }

  ytApiPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return ytApiPromise;
}

// --- Shared cover-size helper (for iframe-based providers) ---

const ASSUMED_VIDEO_ASPECT = 16 / 9;

function applyCoverSize(el: HTMLElement, containerW: number, containerH: number): void {
  const containerAspect = containerW / containerH;
  let w: number;
  let h: number;

  if (containerAspect > ASSUMED_VIDEO_ASPECT) {
    w = containerW;
    h = containerW / ASSUMED_VIDEO_ASPECT;
  } else {
    h = containerH;
    w = containerH * ASSUMED_VIDEO_ASPECT;
  }

  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
}

// --- VideoElement ---

const FADE_STEP_MS = 50;

export class VideoElement implements ElementRenderer {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private readonly onCloseCallback: (() => void) | null;
  private wrapper: HTMLDivElement | null = null;
  private vimeoPlayer: VimeoPlayer | null = null;
  private ytPlayer: YTPlayerInstance | null = null;
  private nativeVideo: HTMLVideoElement | null = null;
  private provider: VideoProvider = "native";
  private flagsCleanup: FlagsCleanup | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private muteButton: MuteButton | null = null;
  private elementPlaybar: ElementPlaybar | null = null;
  private playbarPollTimer: ReturnType<typeof setInterval> | null = null;
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
    this.provider = detectProvider(el.src ?? "");

    const wantsAutoplay = el.playback?.initial === "playing";
    const wantsMuted = el.audio?.initial === "off";

    // Shared wrapper + body + clipContainer
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

    const clipContainer = document.createElement("div");
    clipContainer.classList.add("mise-video-clip");

    body.appendChild(clipContainer);
    wrapper.appendChild(body);
    this.stageRoot.appendChild(wrapper);
    this.wrapper = wrapper;

    applyAnimation(wrapper, el.animation.enter);

    this.flagsCleanup = applyFlags(wrapper, el, this.stageRoot, () => {
      this.unmount();
      this.onCloseCallback?.();
    });

    if (el.audio?.audienceControl) {
      this.muteButton = createMuteButton(
        wantsMuted,
        (muted) => this.setMuted(muted)
      );
      wrapper.appendChild(this.muteButton.element);
    }

    if (el.playback?.bar?.visible) {
      this.elementPlaybar = createElementPlaybar(
        wantsAutoplay,
        el.playback.bar.classNames ?? [],
        (playing) => this.togglePlay(playing),
        (fraction) => this.seekToFraction(fraction)
      );
      wrapper.appendChild(this.elementPlaybar.element);
    }

    if (this.provider === "vimeo") {
      this.mountVimeo(clipContainer, el, wantsAutoplay, wantsMuted, wrapper);
    } else if (this.provider === "youtube") {
      this.mountYouTube(clipContainer, el, wantsAutoplay, wantsMuted, wrapper);
    } else {
      this.mountNative(clipContainer, el, wantsAutoplay, wantsMuted, wrapper);
    }
  }

  private mountNative(
    clipContainer: HTMLDivElement,
    el: MiseElement,
    wantsAutoplay: boolean,
    wantsMuted: boolean,
    wrapper: HTMLDivElement
  ): void {
    const video = document.createElement("video");
    video.src = el.src ?? "";
    video.setAttribute("playsinline", "");
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = el.mediaFit === "fit" ? "contain" : "cover";
    video.style.display = "block";

    if (el.playback?.loop) video.loop = true;
    if (wantsMuted) video.muted = true;

    clipContainer.appendChild(video);
    this.nativeVideo = video;

    // For "fit" mode, shrink wrapper to native aspect ratio once metadata loads
    if (el.mediaFit === "fit") {
      video.addEventListener("loadedmetadata", () => {
        if (!this.wrapper || !video.videoWidth || !video.videoHeight) return;
        const videoAspect = video.videoWidth / video.videoHeight;
        const boxW = el.size.width;
        const boxH = el.size.height;
        const boxAspect = boxW / boxH;

        let fitW: number;
        let fitH: number;
        if (videoAspect > boxAspect) {
          fitW = boxW;
          fitH = boxW / videoAspect;
        } else {
          fitH = boxH;
          fitW = boxH * videoAspect;
        }

        wrapper.style.width = `${fitW}px`;
        wrapper.style.height = `${fitH}px`;
      }, { once: true });
    }

    const fadeInMs = el.audio?.fadeIn ?? 0;
    if (fadeInMs > 0 && !wantsMuted) {
      video.volume = 0;
    }

    if (wantsAutoplay) {
      video.play().catch(() => {});
      this.startFadeIn();
    } else if (fadeInMs > 0 && !wantsMuted) {
      this.startFadeIn();
    }

    this.startPlaybarPolling();
  }

  private mountVimeo(
    clipContainer: HTMLDivElement,
    el: MiseElement,
    wantsAutoplay: boolean,
    wantsMuted: boolean,
    wrapper: HTMLDivElement
  ): void {
    const videoId = extractVimeoId(el.src ?? "");

    const params = new URLSearchParams();
    if (wantsAutoplay) params.set("autoplay", "1");
    if (wantsAutoplay || wantsMuted) params.set("muted", "1");
    if (el.playback?.loop) params.set("loop", "1");
    params.set("controls", el.playback?.audienceControl ? "1" : "0");
    params.set("autopause", "0");

    const iframe = document.createElement("iframe");
    iframe.src = `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
    iframe.setAttribute("allow", "autoplay; fullscreen");

    if (el.mediaFit === "fit") {
      iframe.style.width = "100%";
      iframe.style.height = "100%";
    } else {
      iframe.style.position = "absolute";
      iframe.style.top = "50%";
      iframe.style.left = "50%";
      iframe.style.transform = "translate(-50%, -50%)";
      applyCoverSize(iframe, el.size.width, el.size.height);

      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          applyCoverSize(iframe, entry.contentRect.width, entry.contentRect.height);
        }
      });
      this.resizeObserver.observe(clipContainer);
    }

    clipContainer.appendChild(iframe);

    const player = new VimeoPlayer(iframe);
    this.vimeoPlayer = player;

    player.ready().then(async () => {
      if (wantsAutoplay) player.play().catch(() => {});

      const fadeInMs = el.audio?.fadeIn ?? 0;
      if (!wantsMuted && fadeInMs > 0) {
        player.setVolume(0).catch(() => {});
        this.startFadeIn();
      } else if (!wantsMuted) {
        player.setVolume(1).catch(() => {});
      }

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
              fitW = boxW;
              fitH = boxW / videoAspect;
            } else {
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

      this.startPlaybarPolling();
    }).catch(() => {});
  }

  private mountYouTube(
    clipContainer: HTMLDivElement,
    el: MiseElement,
    wantsAutoplay: boolean,
    wantsMuted: boolean,
    wrapper: HTMLDivElement
  ): void {
    const videoId = extractYouTubeId(el.src ?? "");

    // YouTube API needs a placeholder div to replace with an iframe
    const placeholder = document.createElement("div");
    clipContainer.appendChild(placeholder);

    loadYouTubeAPI().then(() => {
      if (!this.wrapper) return; // unmounted before API loaded

      const playerVars: Record<string, number | string> = {
        autoplay: wantsAutoplay ? 1 : 0,
        controls: el.playback?.audienceControl ? 1 : 0,
        loop: el.playback?.loop ? 1 : 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,   // hide annotations
        fs: 0,               // hide fullscreen button
        disablekb: 1,        // disable keyboard controls
      };

      if (el.playback?.loop) {
        // YouTube loop requires playlist set to the video ID
        playerVars.playlist = videoId;
      }

      const ytPlayer = new window.YT!.Player(placeholder, {
        videoId,
        width: el.size.width,
        height: el.size.height,
        playerVars,
        events: {
          onReady: (event) => {
            if (wantsAutoplay || wantsMuted) {
              event.target.mute();
            }

            // Apply cover/fit sizing to the YouTube iframe
            const iframe = event.target.getIframe();
            if (el.mediaFit === "fit") {
              iframe.style.width = "100%";
              iframe.style.height = "100%";

              // Shrink wrapper to assumed 16:9 aspect ratio for fit mode
              const videoAspect = ASSUMED_VIDEO_ASPECT;
              const boxW = el.size.width;
              const boxH = el.size.height;
              const boxAspect = boxW / boxH;

              let fitW: number;
              let fitH: number;
              if (videoAspect > boxAspect) {
                fitW = boxW;
                fitH = boxW / videoAspect;
              } else {
                fitH = boxH;
                fitW = boxH * videoAspect;
              }

              wrapper.style.width = `${fitW}px`;
              wrapper.style.height = `${fitH}px`;
            } else {
              iframe.style.position = "absolute";
              iframe.style.top = "50%";
              iframe.style.left = "50%";
              iframe.style.transform = "translate(-50%, -50%)";
              applyCoverSize(iframe, el.size.width, el.size.height);

              this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                  applyCoverSize(iframe, entry.contentRect.width, entry.contentRect.height);
                }
              });
              this.resizeObserver.observe(clipContainer);
            }

            if (!wantsMuted) {
              const fadeInMs = el.audio?.fadeIn ?? 0;
              event.target.unMute();
              if (fadeInMs > 0) {
                event.target.setVolume(0);
                this.startFadeIn();
              }
            }

            this.startPlaybarPolling();
          },
        },
      });

      this.ytPlayer = ytPlayer;
    }).catch(() => {});
  }

  private togglePlay(playing: boolean): void {
    if (this.vimeoPlayer) {
      if (playing) {
        this.vimeoPlayer.play().catch(() => {});
      } else {
        this.vimeoPlayer.pause().catch(() => {});
      }
    } else if (this.ytPlayer) {
      if (playing) {
        this.ytPlayer.playVideo();
      } else {
        this.ytPlayer.pauseVideo();
      }
    } else if (this.nativeVideo) {
      if (playing) {
        this.nativeVideo.play().catch(() => {});
      } else {
        this.nativeVideo.pause();
      }
    }
  }

  private seekToFraction(fraction: number): void {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.getDuration().then((dur) => {
        this.vimeoPlayer?.setCurrentTime(fraction * dur).catch(() => {});
      }).catch(() => {});
    } else if (this.ytPlayer) {
      const dur = this.ytPlayer.getDuration();
      if (dur) this.ytPlayer.seekTo(fraction * dur, true);
    } else if (this.nativeVideo) {
      const dur = this.nativeVideo.duration;
      if (dur && isFinite(dur)) this.nativeVideo.currentTime = fraction * dur;
    }
  }

  private startPlaybarPolling(): void {
    if (!this.elementPlaybar) return;
    this.playbarPollTimer = setInterval(() => {
      if (!this.elementPlaybar) return;
      if (this.vimeoPlayer) {
        Promise.all([
          this.vimeoPlayer.getCurrentTime(),
          this.vimeoPlayer.getDuration(),
        ]).then(([time, dur]) => {
          if (dur > 0) this.elementPlaybar?.update(time / dur);
        }).catch(() => {});
      } else if (this.ytPlayer) {
        const time = this.ytPlayer.getCurrentTime();
        const dur = this.ytPlayer.getDuration();
        if (dur > 0) this.elementPlaybar.update(time / dur);
      } else if (this.nativeVideo) {
        const dur = this.nativeVideo.duration;
        if (dur && isFinite(dur)) {
          this.elementPlaybar.update(this.nativeVideo.currentTime / dur);
        }
      }
    }, 250);
  }

  private setMuted(muted: boolean): void {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.setVolume(muted ? 0 : 1).catch(() => {});
    } else if (this.ytPlayer) {
      if (muted) {
        this.ytPlayer.mute();
      } else {
        this.ytPlayer.unMute();
      }
    } else if (this.nativeVideo) {
      this.nativeVideo.muted = muted;
    }
  }

  unmount(): void {
    this.cancelFade();
    if (this.playbarPollTimer !== null) {
      clearInterval(this.playbarPollTimer);
      this.playbarPollTimer = null;
    }
    if (this.elementPlaybar) {
      this.elementPlaybar.destroy();
      this.elementPlaybar = null;
    }
    if (this.muteButton) {
      this.muteButton.destroy();
      this.muteButton = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.flagsCleanup) {
      this.flagsCleanup.destroy();
      this.flagsCleanup = null;
    }

    const fadeOutMs = this.element.audio?.fadeOut ?? 0;
    const wantsMuted = this.element.audio?.initial === "off";

    const destroyPlayers = (): void => {
      if (this.vimeoPlayer) { this.vimeoPlayer.destroy().catch(() => {}); this.vimeoPlayer = null; }
      if (this.ytPlayer) { try { this.ytPlayer.destroy(); } catch { /* ignore */ } this.ytPlayer = null; }
      if (this.nativeVideo) { this.nativeVideo.pause(); this.nativeVideo.src = ""; this.nativeVideo = null; }
    };

    const runExitAndDestroy = (): void => {
      if (this.wrapper) {
        applyAnimation(this.wrapper, this.element.animation.exit, () => {
          destroyPlayers();
          this.wrapper?.remove();
          this.wrapper = null;
        });
      } else {
        destroyPlayers();
      }
    };

    if (fadeOutMs > 0 && !wantsMuted && (this.vimeoPlayer || this.ytPlayer || this.nativeVideo)) {
      this.startFadeOut(() => {
        runExitAndDestroy();
      });
    } else {
      runExitAndDestroy();
    }
  }

  seek(elementTime: number): void {
    if (!this.syncWithClock) return;
    const time = Math.max(0, elementTime);
    if (this.vimeoPlayer) {
      this.vimeoPlayer.setCurrentTime(time).catch(() => {});
    } else if (this.ytPlayer) {
      this.ytPlayer.seekTo(time, true);
    } else if (this.nativeVideo) {
      this.nativeVideo.currentTime = time;
    }
  }

  pause(): void {
    if (!this.syncWithClock) return;
    if (this.vimeoPlayer) {
      this.vimeoPlayer.pause().catch(() => {});
    } else if (this.ytPlayer) {
      this.ytPlayer.pauseVideo();
    } else if (this.nativeVideo) {
      this.nativeVideo.pause();
    }
    this.elementPlaybar?.setPlaying(false);
  }

  resume(): void {
    if (!this.syncWithClock) return;
    if (this.vimeoPlayer) {
      this.vimeoPlayer.play().catch(() => {});
    } else if (this.ytPlayer) {
      this.ytPlayer.playVideo();
    } else if (this.nativeVideo) {
      this.nativeVideo.play().catch(() => {});
    }
    this.elementPlaybar?.setPlaying(true);
  }

  // --- Volume fade helpers ---

  private cancelFade(): void {
    if (this.fadeTimer !== null) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private setVolume(vol: number): void {
    if (this.vimeoPlayer) {
      this.vimeoPlayer.setVolume(vol).catch(() => {});
    } else if (this.ytPlayer) {
      this.ytPlayer.setVolume(vol * 100);
    } else if (this.nativeVideo) {
      this.nativeVideo.volume = vol;
    }
  }

  private startFadeIn(): void {
    const fadeInMs = this.element.audio?.fadeIn ?? 0;
    if (fadeInMs <= 0) return;

    this.cancelFade();

    const steps = Math.max(1, Math.floor(fadeInMs / FADE_STEP_MS));
    const stepDuration = fadeInMs / steps;
    const volumeStep = 1 / steps;
    let currentStep = 0;

    this.fadeTimer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        this.setVolume(1);
        this.cancelFade();
        return;
      }
      this.setVolume(Math.min(1, volumeStep * currentStep));
    }, stepDuration);
  }

  private startFadeOut(onComplete: () => void): void {
    this.cancelFade();

    const fadeOutMs = this.element.audio?.fadeOut ?? 0;
    if (fadeOutMs <= 0) {
      onComplete();
      return;
    }

    const startVolume = this.nativeVideo
      ? this.nativeVideo.volume
      : this.ytPlayer
        ? this.ytPlayer.getVolume() / 100
        : 1;
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
      this.setVolume(0);
      onComplete();
    };

    this.fadeTimer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        finish();
        return;
      }
      this.setVolume(Math.max(0, startVolume - volumeStep * currentStep));
    }, stepDuration);

    // Safety timeout — same pattern as animation.exit
    setTimeout(finish, fadeOutMs + 100);
  }
}
