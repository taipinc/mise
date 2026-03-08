import type { MiseElement } from "@mise/core";
import DOMPurify from "dompurify";
import type { ElementRenderer } from "./renderer";
import { applyFlags, type FlagsCleanup } from "./flags";
import { applyAnimation } from "./animation";

export class ComponentElement implements ElementRenderer {
  private readonly element: MiseElement;
  private readonly stageRoot: HTMLDivElement;
  private readonly onCloseCallback: (() => void) | null;
  private readonly onAction: ((action: string) => void) | null;
  private wrapper: HTMLDivElement | null = null;
  private flagsCleanup: FlagsCleanup | null = null;
  readonly syncWithClock = false;

  constructor(
    element: MiseElement,
    stageRoot: HTMLDivElement,
    onClose?: () => void,
    onAction?: (action: string) => void
  ) {
    this.element = element;
    this.stageRoot = stageRoot;
    this.onCloseCallback = onClose ?? null;
    this.onAction = onAction ?? null;
  }

  mount(): void {
    const el = this.element;

    const wrapper = document.createElement("div");
    wrapper.classList.add("mise-element", "mise-type-component");
    wrapper.style.left = `${el.position.x}px`;
    wrapper.style.top = `${el.position.y}px`;
    wrapper.style.width = `${el.size.width}px`;
    wrapper.style.height = `${el.size.height}px`;
    wrapper.dataset.miseId = el.id;

    if (el.zIndex !== null) {
      wrapper.style.zIndex = String(el.zIndex);
    }

    for (const cls of el.classNames) {
      wrapper.classList.add(cls);
    }

    const content = document.createElement("div");
    content.classList.add("mise-content");
    if (el.content) {
      content.innerHTML = DOMPurify.sanitize(el.content, {
        ADD_ATTR: ["data-mise-action"],
      });
    }
    wrapper.appendChild(content);

    // Wire up data-mise-action clicks
    wrapper.addEventListener("click", this.onWrapperClick);

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
      this.wrapper.removeEventListener("click", this.onWrapperClick);
      applyAnimation(this.wrapper, this.element.animation.exit, () => {
        this.wrapper?.remove();
        this.wrapper = null;
      });
    }
  }

  seek(): void {}
  pause(): void {}
  resume(): void {}

  private onWrapperClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const actionEl = target.closest("[data-mise-action]") as HTMLElement | null;
    if (!actionEl) return;

    const action = actionEl.dataset.miseAction;
    if (action && this.onAction) {
      e.preventDefault();
      e.stopPropagation();
      this.onAction(action);
    }
  };
}
