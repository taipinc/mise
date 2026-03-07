import type { MiseElement } from "@mise/core";

const MIN_WIDTH = 160;
const MIN_HEIGHT = 90;
const TITLE_BAR_HEIGHT = 20;
const CONTROLS_HIDE_DELAY = 0;

export interface FlagsCleanup {
  destroy(): void;
}

function getScale(stageRoot: HTMLDivElement): number {
  const rect = stageRoot.getBoundingClientRect();
  return rect.width / stageRoot.offsetWidth;
}

function getMaxZIndex(stageRoot: HTMLDivElement): number {
  let max = 0;
  for (const child of stageRoot.children) {
    const z = parseInt((child as HTMLElement).style.zIndex || "0", 10);
    if (z > max) max = z;
  }
  return max;
}

export function applyFlags(
  wrapper: HTMLDivElement,
  element: MiseElement,
  stageRoot: HTMLDivElement,
  onClose?: () => void
): FlagsCleanup {
  const cleanups: (() => void)[] = [];
  const flags = element.flags;

  // Isolate stacking context so children (handle, close btn) don't leak above other elements
  wrapper.style.isolation = "isolate";

  // --- Hover-to-show controls ---
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let pinned = false;

  const showControls = (): void => {
    if (hideTimer !== null) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    wrapper.classList.add("mise-controls-visible");
  };

  const scheduleHide = (): void => {
    if (pinned) return;
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      wrapper.classList.remove("mise-controls-visible");
      hideTimer = null;
    }, CONTROLS_HIDE_DELAY);
  };

  const pinControls = (): void => {
    pinned = true;
    showControls();
  };

  const unpinControls = (): void => {
    pinned = false;
    scheduleHide();
  };

  const onWrapperEnter = (): void => showControls();
  const onWrapperLeave = (): void => scheduleHide();

  wrapper.addEventListener("pointerenter", onWrapperEnter);
  wrapper.addEventListener("pointerleave", onWrapperLeave);
  cleanups.push(() => {
    wrapper.removeEventListener("pointerenter", onWrapperEnter);
    wrapper.removeEventListener("pointerleave", onWrapperLeave);
    if (hideTimer !== null) clearTimeout(hideTimer);
  });

  // Title bar — drag handle and home for close button
  const titleBar = document.createElement("div");
  titleBar.classList.add("mise-title-bar");
  titleBar.style.position = "absolute";
  titleBar.style.top = "0";
  titleBar.style.left = "0";
  titleBar.style.width = "100%";
  titleBar.style.height = `${TITLE_BAR_HEIGHT}px`;
  titleBar.style.zIndex = "2";
  titleBar.style.background = "rgba(0,0,0,0.35)";
  titleBar.style.cursor = flags.movable ? "grab" : "default";
  titleBar.style.touchAction = "none";
  wrapper.appendChild(titleBar);

  titleBar.addEventListener("pointerenter", showControls);
  titleBar.addEventListener("pointerleave", scheduleHide);
  cleanups.push(() => {
    titleBar.removeEventListener("pointerenter", showControls);
    titleBar.removeEventListener("pointerleave", scheduleHide);
    titleBar.remove();
  });

  if (flags.zIndexable) {
    const bringToFront = (): void => {
      wrapper.style.zIndex = String(getMaxZIndex(stageRoot) + 1);
    };
    titleBar.addEventListener("pointerdown", bringToFront);
    cleanups.push(() => titleBar.removeEventListener("pointerdown", bringToFront));
  }

  if (flags.movable) {
    cleanups.push(applyMovable(wrapper, titleBar, stageRoot, pinControls, unpinControls));
  }

  if (flags.resizable) {
    cleanups.push(applyResizable(wrapper, stageRoot, showControls, scheduleHide, pinControls, unpinControls));
  }

  if (flags.closable && onClose) {
    cleanups.push(applyClosable(titleBar, onClose));
  }

  return {
    destroy(): void {
      for (const fn of cleanups) fn();
    },
  };
}

function applyMovable(
  wrapper: HTMLDivElement,
  titleBar: HTMLDivElement,
  stageRoot: HTMLDivElement,
  pinControls: () => void,
  unpinControls: () => void
): () => void {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origLeft = 0;
  let origTop = 0;

  const onPointerDown = (e: PointerEvent): void => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("mise-close-btn")) return;

    e.preventDefault();
    titleBar.setPointerCapture(e.pointerId);
    dragging = true;
    titleBar.style.cursor = "grabbing";
    pinControls();
    const scale = getScale(stageRoot);
    startX = e.clientX / scale;
    startY = e.clientY / scale;
    origLeft = parseFloat(wrapper.style.left) || 0;
    origTop = parseFloat(wrapper.style.top) || 0;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    e.preventDefault();
    const scale = getScale(stageRoot);
    const dx = e.clientX / scale - startX;
    const dy = e.clientY / scale - startY;

    const w = parseFloat(wrapper.style.width) || 0;
    const h = parseFloat(wrapper.style.height) || 0;
    const stageW = stageRoot.offsetWidth;
    const stageH = stageRoot.offsetHeight;

    const newLeft = Math.max(0, Math.min(stageW - w, origLeft + dx));
    const newTop = Math.max(0, Math.min(stageH - h, origTop + dy));

    wrapper.style.left = `${newLeft}px`;
    wrapper.style.top = `${newTop}px`;
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    titleBar.releasePointerCapture(e.pointerId);
    titleBar.style.cursor = "grab";
    unpinControls();
  };

  titleBar.addEventListener("pointerdown", onPointerDown);
  titleBar.addEventListener("pointermove", onPointerMove);
  titleBar.addEventListener("pointerup", onPointerUp);

  return () => {
    titleBar.removeEventListener("pointerdown", onPointerDown);
    titleBar.removeEventListener("pointermove", onPointerMove);
    titleBar.removeEventListener("pointerup", onPointerUp);
  };
}

function applyResizable(
  wrapper: HTMLDivElement,
  stageRoot: HTMLDivElement,
  showControls: () => void,
  scheduleHide: () => void,
  pinControls: () => void,
  unpinControls: () => void
): () => void {
  const handle = document.createElement("div");
  handle.classList.add("mise-resize-handle");
  handle.style.position = "absolute";
  handle.style.right = "0";
  handle.style.bottom = "0";
  handle.style.width = "20px";
  handle.style.height = "20px";
  handle.style.cursor = "nwse-resize";
  handle.style.background = "rgba(255,255,255,0.3)";
  handle.style.touchAction = "none";
  wrapper.appendChild(handle);

  handle.addEventListener("pointerenter", showControls);
  handle.addEventListener("pointerleave", scheduleHide);

  let resizing = false;
  let startX = 0;
  let startY = 0;
  let origW = 0;
  let origH = 0;

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    resizing = true;
    pinControls();
    const scale = getScale(stageRoot);
    startX = e.clientX / scale;
    startY = e.clientY / scale;
    origW = parseFloat(wrapper.style.width) || 0;
    origH = parseFloat(wrapper.style.height) || 0;
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!resizing) return;
    e.preventDefault();
    const scale = getScale(stageRoot);
    const dx = e.clientX / scale - startX;
    const dy = e.clientY / scale - startY;

    const newW = Math.max(MIN_WIDTH, origW + dx);
    const newH = Math.max(MIN_HEIGHT, origH + dy);

    wrapper.style.width = `${newW}px`;
    wrapper.style.height = `${newH}px`;
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!resizing) return;
    resizing = false;
    handle.releasePointerCapture(e.pointerId);
    unpinControls();
  };

  handle.addEventListener("pointerdown", onPointerDown);
  handle.addEventListener("pointermove", onPointerMove);
  handle.addEventListener("pointerup", onPointerUp);

  return () => {
    handle.removeEventListener("pointerenter", showControls);
    handle.removeEventListener("pointerleave", scheduleHide);
    handle.removeEventListener("pointerdown", onPointerDown);
    handle.removeEventListener("pointermove", onPointerMove);
    handle.removeEventListener("pointerup", onPointerUp);
    handle.remove();
  };
}

function applyClosable(
  titleBar: HTMLDivElement,
  onClose: () => void
): () => void {
  const btn = document.createElement("div");
  btn.classList.add("mise-close-btn");
  btn.style.position = "absolute";
  btn.style.top = "0";
  btn.style.right = "0";
  btn.style.width = "20px";
  btn.style.height = "20px";
  btn.style.cursor = "pointer";
  btn.style.background = "rgba(0,0,0,0.6)";
  btn.style.color = "#fff";
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.fontSize = "14px";
  btn.style.lineHeight = "1";
  btn.textContent = "\u00D7";

  const onClick = (e: Event): void => {
    e.stopPropagation();
    onClose();
  };

  btn.addEventListener("click", onClick);
  titleBar.appendChild(btn);

  return () => {
    btn.removeEventListener("click", onClick);
    btn.remove();
  };
}
