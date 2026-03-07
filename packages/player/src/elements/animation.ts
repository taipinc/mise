const EXIT_TIMEOUT = 600;
const ENTER_REMOVE_DELAY = 500;

export function applyAnimation(
  wrapper: HTMLDivElement,
  className: string,
  onComplete?: () => void
): void {
  if (!className) {
    onComplete?.();
    return;
  }

  wrapper.classList.add(className);

  if (onComplete) {
    // Exit animation — wait for animationend or timeout, then remove
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      wrapper.removeEventListener("animationend", finish);
      onComplete();
    };

    wrapper.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, EXIT_TIMEOUT);
  } else {
    // Enter animation — remove the class after it plays
    setTimeout(() => {
      wrapper.classList.remove(className);
    }, ENTER_REMOVE_DELAY);
  }
}
