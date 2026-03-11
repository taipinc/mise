import type { MiseComposition } from "@mise/core";

export class IntroScreen {
  private readonly overlay: HTMLDivElement;
  private readonly onStart: () => void;

  constructor(
    stageRoot: HTMLDivElement,
    composition: MiseComposition,
    onStart: () => void
  ) {
    this.onStart = onStart;

    const intro = composition.stage.intro;
    const meta = composition.meta;
    const display = intro.display;
    const classNames = intro.classNames;

    // Overlay
    this.overlay = document.createElement("div");
    this.overlay.classList.add("mise-intro-overlay");
    if (classNames[0]) this.overlay.classList.add(classNames[0]);

    // Meta block
    const metaBlock = document.createElement("div");
    metaBlock.classList.add("mise-intro-meta");
    if (classNames[1]) metaBlock.classList.add(classNames[1]);

    if (display.title && meta.title) {
      const titleEl = document.createElement("h1");
      titleEl.classList.add("mise-intro-title");
      titleEl.textContent = meta.title;
      metaBlock.appendChild(titleEl);
    }

    if (display.author && meta.author) {
      const authorEl = document.createElement("p");
      authorEl.classList.add("mise-intro-author");
      authorEl.textContent = meta.author;
      metaBlock.appendChild(authorEl);
    }

    if (display.description && meta.description) {
      const descEl = document.createElement("p");
      descEl.classList.add("mise-intro-description");
      descEl.textContent = meta.description;
      metaBlock.appendChild(descEl);
    }

    this.overlay.appendChild(metaBlock);

    // Play button
    const playBtn = document.createElement("button");
    playBtn.classList.add("mise-intro-play");
    if (classNames[2]) playBtn.classList.add(classNames[2]);
    playBtn.innerHTML = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="23" stroke="currentColor" stroke-width="2"/><polygon points="19,14 19,34 35,24" fill="currentColor"/></svg>`;
    playBtn.addEventListener("click", this.handleClick);

    this.overlay.appendChild(playBtn);

    stageRoot.appendChild(this.overlay);
  }

  private handleClick = (): void => {
    this.dismiss();
    this.onStart();
  };

  dismiss(): void {
    this.overlay.classList.add("mise-intro-exiting");
    this.overlay.addEventListener("animationend", () => {
      this.overlay.remove();
    });
    // Fallback removal
    setTimeout(() => {
      if (this.overlay.parentNode) {
        this.overlay.remove();
      }
    }, 600);
  }

  destroy(): void {
    this.overlay.removeEventListener("click", this.handleClick);
    this.overlay.remove();
  }
}
