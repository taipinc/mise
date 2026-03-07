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
