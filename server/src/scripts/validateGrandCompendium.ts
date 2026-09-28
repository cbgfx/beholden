import fs from "node:fs";
import path from "node:path";
import { parseNativeCompendiumDocument } from "../services/compendium/nativeCompendium.js";

const input = process.argv[2];
if (!input) throw new Error("Usage: tsx src/scripts/validateGrandCompendium.ts <compendium.json>");
const requestedCategory = process.argv[3];

const filePath = path.resolve(input);
const value: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
const batches = parseNativeCompendiumDocument(
  requestedCategory && value && typeof value === "object" && !Array.isArray(value)
    ? {
        format: "beholden.compendium",
        schema: "grand",
        category: requestedCategory,
        exportedAt: (value as Record<string, unknown>).exportedAt,
        entries: (value as Record<string, unknown>)[requestedCategory],
      }
    : value,
);

for (const batch of batches) {
  console.log(`${batch.category}: ${batch.entries.length}`);
}
