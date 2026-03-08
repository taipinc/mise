import type { MiseComposition } from "@mise/core";
import defaultsCss from "./styles/defaults.css?raw";

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

    // 1. Inject baseline defaults (always first — author styles override)
    const defaultsStyle = document.createElement("style");
    defaultsStyle.textContent = defaultsCss;
    this.shadow.appendChild(defaultsStyle);

    // 2. Inject dynamic stage dimensions + author styles
    const authorStyle = document.createElement("style");
    authorStyle.textContent = `
      .mise-stage {
        width: ${this.viewBoxWidth}px;
        height: ${this.viewBoxHeight}px;
      }
    ${styles}`;
    this.shadow.appendChild(authorStyle);

    this.stageDiv = document.createElement("div");
    this.stageDiv.classList.add("mise-stage");
    if (background) {
      if (/\.(mp4|webm|ogg)(\?|$)/i.test(background)) {
        const video = document.createElement("video");
        video.src = background;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.zIndex = "-1";
        this.stageDiv.appendChild(video);
      } else if (/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(background)) {
        this.stageDiv.style.backgroundImage = `url(${background})`;
        this.stageDiv.style.backgroundSize = "cover";
        this.stageDiv.style.backgroundPosition = "center";
      } else {
        this.stageDiv.style.background = background;
      }
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
