import type { MiseComposition } from "@mise/core";

/**
 * Sends commands to the player iframe and receives messages back.
 * Matches the postMessage protocol defined in @mise/player's PostMessageBridge.
 */

export function sendCommand(
  iframe: HTMLIFrameElement,
  command: "play" | "pause"
): void;
export function sendCommand(
  iframe: HTMLIFrameElement,
  command: "seek",
  time: number
): void;
export function sendCommand(
  iframe: HTMLIFrameElement,
  command: "load",
  composition: MiseComposition
): void;
export function sendCommand(
  iframe: HTMLIFrameElement,
  command: string,
  payload?: number | MiseComposition
): void {
  const win = iframe.contentWindow;
  if (!win) return;

  if (command === "seek") {
    win.postMessage({ type: "mise:command", command: "seek", time: payload }, "*");
  } else if (command === "load") {
    win.postMessage(
      { type: "mise:command", command: "load", composition: payload },
      "*"
    );
  } else {
    win.postMessage({ type: "mise:command", command }, "*");
  }
}

export interface PlayerMessageHandlers {
  onTick?: (time: number) => void;
  onStateChange?: (state: "playing" | "paused") => void;
}

export function listenToPlayer(
  handlers: PlayerMessageHandlers
): () => void {
  const onMessage = (event: MessageEvent): void => {
    const data = event.data;
    if (!data || typeof data.type !== "string") return;

    if (data.type === "mise:tick" && typeof data.time === "number") {
      handlers.onTick?.(data.time);
    } else if (
      data.type === "mise:stateChange" &&
      (data.state === "playing" || data.state === "paused")
    ) {
      handlers.onStateChange?.(data.state);
    }
  };

  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}
