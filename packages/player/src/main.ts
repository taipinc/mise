import { CompositionSchema } from "@mise/core";
import { MisePlayer } from "./player";

async function init(): Promise<void> {
  const res = await fetch("/compositions/test01.json");
  const raw: unknown = await res.json();

  const result = CompositionSchema.safeParse(raw);
  if (!result.success) {
    console.error("Composition validation failed:", result.error.issues);
    return;
  }

  const composition = result.data;
  console.log(
    `Loaded composition: "${composition.meta.title || "(untitled)"}" — ${composition.elements.length} elements`
  );

  const host = document.getElementById("mise-host");
  if (!host) {
    console.error("Host element #mise-host not found");
    return;
  }

  const player = new MisePlayer(host, composition);

  // Log clock events (throttle ticks to once per second)
  let lastLoggedSecond = -1;
  player.getClock().on("tick", (e) => {
    if (e.type !== "tick") return;
    const sec = Math.floor(e.time);
    if (sec !== lastLoggedSecond) {
      lastLoggedSecond = sec;
      console.log(`[tick] ${e.time.toFixed(2)}s`);
    }
  });

  player.getClock().on("open", (e) => {
    if (e.type === "open") {
      console.log(`[open] element "${e.elementId}" at ${e.time.toFixed(2)}s`);
    }
  });

  player.getClock().on("close", (e) => {
    if (e.type === "close") {
      console.log(`[close] element "${e.elementId}" at ${e.time.toFixed(2)}s`);
    }
  });

  player.play();
  console.log("Player started.");
}

init();
