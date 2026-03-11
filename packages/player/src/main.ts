import { CompositionSchema } from "@mise/core";
import { MisePlayer } from "./player";

async function init(): Promise<void> {
  const res = await fetch("/compositions/test04.json");
  const raw: unknown = await res.json();

  const result = CompositionSchema.safeParse(raw);
  if (!result.success) {
    console.error("Composition validation failed:", result.error.issues);
    return;
  }

  const composition = result.data;
  console.log(
    `[mise] Loaded: "${composition.meta.title || "(untitled)"}" — ${composition.elements.length} elements, viewBox ${composition.stage.viewBox.width}×${composition.stage.viewBox.height}`
  );

  const host = document.getElementById("mise-host");
  if (!host) {
    console.error("[mise] Host element #mise-host not found");
    return;
  }

  const player = new MisePlayer(host, composition);

  const introEnabled = composition.stage.intro?.enabled ?? true;

  let lastLoggedSecond = -1;
  player.getClock().on("tick", (e) => {
    if (e.type !== "tick") return;
    const sec = Math.floor(e.time);
    if (sec !== lastLoggedSecond) {
      lastLoggedSecond = sec;
      console.log(`[tick] ${sec}s`);
    }
  });

  player.getClock().on("open", (e) => {
    if (e.type === "open") {
      console.log(`%c[open] "${e.elementId}" at ${e.time.toFixed(2)}s`, "color: #4CAF50; font-weight: bold");
    }
  });

  player.getClock().on("close", (e) => {
    if (e.type === "close") {
      console.log(`%c[close] "${e.elementId}" at ${e.time.toFixed(2)}s`, "color: #f44336; font-weight: bold");
    }
  });

  if (!introEnabled) {
    player.play();
    console.log("[mise] Player started. Clock running.");
  } else {
    console.log("[mise] Intro screen shown. Waiting for user interaction.");
  }
}

init();
