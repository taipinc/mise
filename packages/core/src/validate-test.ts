import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CompositionSchema } from "./schema";

const filePath = resolve(__dirname, "../../../compositions/test01.json");
const raw = JSON.parse(readFileSync(filePath, "utf-8"));

const result = CompositionSchema.safeParse(raw);

if (result.success) {
  console.log(`Validation passed. Title: "${result.data.meta.title || "(empty)"}"`);
  console.log(`Elements: ${result.data.elements.length}`);
} else {
  console.error("Validation failed:");
  console.error(JSON.stringify(result.error.issues, null, 2));
  process.exit(1);
}
