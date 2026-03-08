export interface MuteButton {
  element: HTMLDivElement;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export function createMuteButton(
  initialMuted: boolean,
  onToggle: (muted: boolean) => void
): MuteButton {
  let muted = initialMuted;

  const btn = document.createElement("div");
  btn.classList.add("mise-mute-btn");
  btn.textContent = muted ? "M" : "\u266A";

  const onClick = (e: Event): void => {
    e.stopPropagation();
    muted = !muted;
    btn.textContent = muted ? "M" : "\u266A";
    onToggle(muted);
  };

  btn.addEventListener("click", onClick);

  return {
    element: btn,
    setMuted(value: boolean): void {
      muted = value;
      btn.textContent = muted ? "M" : "\u266A";
    },
    destroy(): void {
      btn.removeEventListener("click", onClick);
      btn.remove();
    },
  };
}
