import assert from "node:assert/strict";
import test from "node:test";
import { BEHOLDEN_COMPENDIUM_FORMAT, BEHOLDEN_COMPENDIUM_SCHEMA, type NativeCompendiumBundle } from "./nativeCompendium.js";
import { streamNativeCompendiumBundle } from "./nativeCompendiumStreaming.js";

test("native compendium stream emits valid JSON without a category-sized chunk", async () => {
  const document: NativeCompendiumBundle = {
    format: BEHOLDEN_COMPENDIUM_FORMAT,
    schema: BEHOLDEN_COMPENDIUM_SCHEMA,
    exportedAt: "2026-07-22T00:00:00.000Z",
    monsters: Array.from({ length: 100 }, (_, index) => ({
      id: `m_${index}`,
      ruleset: "5e",
      name: `Monster ${index}`,
      description: "x".repeat(1_000),
    })),
  };
  const chunks: Buffer[] = [];
  for await (const chunk of streamNativeCompendiumBundle(document)) chunks.push(Buffer.from(chunk));
  const largestChunk = Math.max(...chunks.map((chunk) => chunk.length));
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as NativeCompendiumBundle;

  assert.equal(parsed.monsters?.length, 100);
  assert.equal(parsed.monsters?.[99]?.id, "m_99");
  assert(largestChunk < 2_000, `largest serialized chunk was ${largestChunk} bytes`);
  assert(chunks.length > 100);
});
