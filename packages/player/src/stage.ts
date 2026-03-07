import type { MiseComposition } from "@mise/core";

export class Stage {
  private readonly shadow: ShadowRoot;
  private readonly stageDiv: HTMLDivElement;
  private readonly viewBoxWidth: number;
  private readonly viewBoxHeight: number;
  private readonly scalingEnabled: boolean;
  private readonly resizeObserver: ResizeObserver;

  constructor(composition: MiseComposition, host: HTMLElement) {
    const { viewBox, scaling, background, styles } = composition.stage;

    this.viewBoxWidth = viewBox.width;
    this.viewBoxHeight = viewBox.height;
    this.scalingEnabled = scaling;

    this.shadow = host.attachShadow({ mode: "open" });

    // Inject host-level styles + author styles
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
      }
      .mise-stage {
        position: absolute;
        width: ${this.viewBoxWidth}px;
        height: ${this.viewBoxHeight}px;
        transform-origin: top left;
        overflow: hidden;
      }
      .mise-title-bar,
      .mise-resize-handle {
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .mise-controls-visible .mise-title-bar,
      .mise-controls-visible .mise-resize-handle {
        opacity: 1;
      }
      .mise-playback-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 20px;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        z-index: 99999;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .mise-playback-bar-visible {
        opacity: 1;
      }
      .mise-play-pause-btn {
        width: 40px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #fff;
        font-size: 12px;
        flex-shrink: 0;
        user-select: none;
      }
      .mise-scrub-track {
        flex: 1;
        height: 100%;
        position: relative;
        cursor: pointer;
      }
      .mise-playhead {
        position: absolute;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        background: rgba(160, 160, 160, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 11px;
        cursor: grab;
        user-select: none;
      }
      .mise-playhead:active {
        cursor: grabbing;
      }
    ${styles}`;
    this.shadow.appendChild(styleEl);

    this.stageDiv = document.createElement("div");
    this.stageDiv.classList.add("mise-stage");
    if (background) {
      this.stageDiv.style.background = background;
    }
    this.shadow.appendChild(this.stageDiv);

    this.resizeObserver = new ResizeObserver(() => this.rescale());
    this.resizeObserver.observe(host);
    this.rescale();
  }

  get root(): HTMLDivElement {
    return this.stageDiv;
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  private rescale(): void {
    if (!this.scalingEnabled) {
      this.stageDiv.style.transform = "none";
      this.stageDiv.style.left = "0";
      this.stageDiv.style.top = "0";
      return;
    }

    const host = this.shadow.host as HTMLElement;
    const containerWidth = host.clientWidth;
    const containerHeight = host.clientHeight;

    const scaleX = containerWidth / this.viewBoxWidth;
    const scaleY = containerHeight / this.viewBoxHeight;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = this.viewBoxWidth * scale;
    const scaledHeight = this.viewBoxHeight * scale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;

    this.stageDiv.style.transform = `scale(${scale})`;
    this.stageDiv.style.left = `${offsetX}px`;
    this.stageDiv.style.top = `${offsetY}px`;
  }
}
