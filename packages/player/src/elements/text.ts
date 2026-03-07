import type { MiseElement } from "@mise/core";
import DOMPurify from "dompurify";
import type { ElementRenderer } from "./renderer";
import { applyFlags, type FlagsCleanup } from "./flags";
import { applyAnimation } from "./animation";

export class TextElement implements ElementRenderer {
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
    wrapper.classList.add("mise-element");
    wrapper.style.position = "absolute";
    wrapper.style.left = `${el.position.x}px`;
    wrapper.style.top = `${el.position.y}px`;
    wrapper.style.width = `${el.size.width}px`;
    wrapper.style.height = `${el.size.height}px`;
    wrapper.style.overflow = "auto";
    wrapper.dataset.miseId = el.id;

    if (el.zIndex !== null) {
      wrapper.style.zIndex = String(el.zIndex);
    }

    for (const cls of el.classNames) {
      wrapper.classList.add(cls);
    }

    if (el.content) {
      wrapper.innerHTML = DOMPurify.sanitize(el.content);
    }

    this.stageRoot.appendChild(wrapper);
    this.wrapper = wrapper;

    applyAnimation(wrapper, el.animation.enter);

    this.flagsCleanup = applyFlags(wrapper, el, this.stageRoot, () => {
      this.unmount();
      this.onCloseCallback?.();
    });
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
