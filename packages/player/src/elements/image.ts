import type { MiseElement } from "@mise/core";
import type { ElementRenderer } from "./renderer";
import { applyFlags, type FlagsCleanup } from "./flags";
import { applyAnimation } from "./animation";

export class ImageElement implements ElementRenderer {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private readonly onCloseCallback: (() => void) | null;
  private wrapper: HTMLDivElement | null = null;
  private flagsCleanup: FlagsCleanup | null = null;
  readonly syncWithClock = false;

  constructor(element: MiseElement, stageRoot: HTMLDivElement, onClose?: () => void) {
    this.element = element;
    this.stageRoot = stageRoot;
    this.onCloseCallback = onClose ?? null;
  }

  mount(): void {
    const el = this.element;

    const wrapper = document.createElement("div");
    wrapper.classList.add("mise-element", "mise-type-image");
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

    const img = document.createElement("img");
    img.src = el.src ?? "";
    img.style.objectFit = el.mediaFit === "fit" ? "contain" : "cover";

    body.appendChild(img);
    wrapper.appendChild(body);
    this.stageRoot.appendChild(wrapper);
    this.wrapper = wrapper;

    applyAnimation(wrapper, el.animation.enter);

    this.flagsCleanup = applyFlags(wrapper, el, this.stageRoot, () => {
      this.unmount();
      this.onCloseCallback?.();
    });

    // For "fit" mode, shrink wrapper to the image's native aspect ratio
    // so controls match the visible image area (no letterbox padding)
    if (el.mediaFit === "fit") {
      const adjustToFit = (): void => {
        if (!img.naturalWidth || !img.naturalHeight) return;
        const imageAspect = img.naturalWidth / img.naturalHeight;
        const boxW = el.size.width;
        const boxH = el.size.height;
        const boxAspect = boxW / boxH;

        let fitW: number;
        let fitH: number;
        if (imageAspect > boxAspect) {
          fitW = boxW;
          fitH = boxW / imageAspect;
        } else {
          fitH = boxH;
          fitW = boxH * imageAspect;
        }

        wrapper.style.width = `${fitW}px`;
        wrapper.style.height = `${fitH}px`;
      };

      if (img.complete && img.naturalWidth) {
        adjustToFit();
      } else {
        img.addEventListener("load", adjustToFit, { once: true });
      }
    }
  }

  unmount(): void {
    if (this.flagsCleanup) {
      this.flagsCleanup.destroy();
      this.flagsCleanup = null;
    }
    if (this.wrapper) {
      applyAnimation(this.wrapper, this.element.animation.exit, () => {
        this.wrapper?.remove();
        this.wrapper = null;
      });
    }
  }

  seek(): void {}
  pause(): void {}
  resume(): void {}
}
