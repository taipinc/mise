import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CompositionSchema } from "./schema";
import { Clock } from "./clock";

const filePath = resolve(__dirname, "../../../compositions/test01.json");
const raw = JSON.parse(readFileSync(filePath, "utf-8"));

const result = CompositionSchema.safeParse(raw);
if (!result.success) {
  console.error("Validation failed:", result.error.issues);
  process.exit(1);
}

const composition = result.data;
console.log(`Composition loaded: "${composition.meta.title || "(untitled)"}"`);
console.log(`Elements: ${composition.elements.length}`);
console.log(`Duration: ${composition.stage.playback.duration ?? "none"}`);
console.log(`Loop: ${composition.stage.playback.loop}`);
console.log("---");

const clock = new Clock(composition);

clock.on("open", (e) => {
  if (e.type === "open") {
    console.log(`[${e.time.toFixed(3)}s] OPEN  "${e.elementId}"`);
  }
});

clock.on("close", (e) => {
  if (e.type === "close") {
    console.log(`[${e.time.toFixed(3)}s] CLOSE "${e.elementId}"`);
  }
});

clock.on("end", (e) => {
  if (e.type === "end") {
    console.log(`[${e.time.toFixed(3)}s] END`);
  }
});

console.log("Starting clock. Will run for 12 seconds...\n");
clock.play();

setTimeout(() => {
  clock.pause();
  console.log(`\nPaused at ${clock.currentTime.toFixed(3)}s`);
  clock.destroy();
  process.exit(0);
}, 12_000);
