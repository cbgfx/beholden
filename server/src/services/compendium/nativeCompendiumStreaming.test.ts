import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../../lib/dbSchema.js";
import { BEHOLDEN_COMPENDIUM_FORMAT, BEHOLDEN_COMPENDIUM_SCHEMA, type NativeCompendiumBundle } from "./nativeCompendium.js";
import { streamNativeCompendiumCategory } from "./nativeCompendiumStreaming.js";

test("production category exporter reads SQLite incrementally and preserves the complete JSON envelope", async (t) => {
  const db = new Database(":memory:"); db.exec(SCHEMA_SQL); t.after(() => db.close());
  const insert = db.prepare("INSERT INTO compendium_monsters (id, ruleset, name, data_json) VALUES (?, ?, ?, ?)");
  const entries = Array.from({ length: 100 }, (_, index) => ({ id: `m_${index}`, ruleset: "5e", name: `Monster ${index}`, description: "x".repeat(1_000) }));
  for (const entry of entries) insert.run(entry.id, entry.ruleset, entry.name, JSON.stringify(entry));
  const chunks: Buffer[] = [];
  for await (const chunk of streamNativeCompendiumCategory(db, "monsters")) chunks.push(Buffer.from(chunk));
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as NativeCompendiumBundle;
  assert.equal(parsed.format, BEHOLDEN_COMPENDIUM_FORMAT); assert.equal(parsed.schema, BEHOLDEN_COMPENDIUM_SCHEMA); assert.equal(parsed.version, 2);
  assert.ok(Number.isFinite(Date.parse(parsed.exportedAt)));
  assert.deepEqual(new Set(parsed.monsters?.map(entry => JSON.stringify(entry))), new Set(entries.map(entry => JSON.stringify(entry))));
  assert(Math.max(...chunks.map(chunk => chunk.length)) < 2_000); assert(chunks.length > 100);
});
test("production category exporter emits a valid empty category", async (t) => {
  const db = new Database(":memory:"); db.exec(SCHEMA_SQL); t.after(() => db.close());
  const chunks: Buffer[] = [];
  for await (const chunk of streamNativeCompendiumCategory(db, "monsters")) chunks.push(Buffer.from(chunk));
  assert.deepEqual(JSON.parse(Buffer.concat(chunks).toString("utf8")).monsters, []);
});
