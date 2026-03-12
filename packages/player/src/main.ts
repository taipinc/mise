import { CompositionSchema } from "@mise/core";
import type { MiseComposition } from "@mise/core";
import { MisePlayer } from "./player";

let currentPlayer: MisePlayer | null = null;

function mountPlayer(
  host: HTMLElement,
  composition: MiseComposition,
  options?: { skipIntro?: boolean }
): void {
  // Tear down previous instance
  if (currentPlayer) {
    currentPlayer.destroy();
    currentPlayer = null;
  }

  currentPlayer = new MisePlayer(host, composition, {
    skipIntro: options?.skipIntro ?? false,
  });

  const introEnabled = composition.stage.intro?.enabled ?? true;

  let lastLoggedSecond = -1;
  currentPlayer.getClock().on("tick", (e) => {
    if (e.type !== "tick") return;
    const sec = Math.floor(e.time);
    if (sec !== lastLoggedSecond) {
      lastLoggedSecond = sec;
      console.log(`[tick] ${sec}s`);
    }
  });

  currentPlayer.getClock().on("open", (e) => {
    if (e.type === "open") {
      console.log(
        `%c[open] "${e.elementId}" at ${e.time.toFixed(2)}s`,
        "color: #4CAF50; font-weight: bold"
      );
    }
  });

  currentPlayer.getClock().on("close", (e) => {
    if (e.type === "close") {
      console.log(
        `%c[close] "${e.elementId}" at ${e.time.toFixed(2)}s`,
        "color: #f44336; font-weight: bold"
      );
    }
  });

  if (!introEnabled || options?.skipIntro) {
    console.log("[mise] Player started. Clock running.");
  } else {
    console.log("[mise] Intro screen shown. Waiting for user interaction.");
  }

  console.log(
    `[mise] Loaded: "${composition.meta.title || "(untitled)"}" — ${composition.elements.length} elements, viewBox ${composition.stage.viewBox.width}×${composition.stage.viewBox.height}`
  );
}

/**
 * Listen for `mise:command` `load` messages from a parent frame (editor).
 * The load command bypasses the PostMessageBridge inside MisePlayer because
 * it needs to destroy/recreate the player instance.
 */
function listenForLoadCommand(host: HTMLElement): void {
  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data;
    if (!data || data.type !== "mise:command" || data.command !== "load") return;

    const result = CompositionSchema.safeParse(data.composition);
    if (!result.success) {
      console.error("[mise] Load command: invalid composition", result.error.issues);
      return;
    }

    console.log("[mise] Received load command from editor");
    mountPlayer(host, result.data, { skipIntro: true });
  });
}

async function init(): Promise<void> {
  const host = document.getElementById("mise-host");
  if (!host) {
    console.error("[mise] Host element #mise-host not found");
    return;
  }

  // Always listen for editor load commands
  listenForLoadCommand(host);

  // Load default composition for standalone dev mode
  const res = await fetch("/compositions/test04.json");
  const raw: unknown = await res.json();

  const result = CompositionSchema.safeParse(raw);
  if (!result.success) {
    console.error("Composition validation failed:", result.error.issues);
    return;
  }

  const isEmbedded = window.parent !== window;
  mountPlayer(host, result.data, { skipIntro: isEmbedded });
}

init();
