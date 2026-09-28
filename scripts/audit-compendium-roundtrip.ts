import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { SCHEMA_SQL } from "../server/src/lib/dbSchema.js";
import { exportNativeCompendiumBundle, importNativeCompendiumDocument, parseNativeCompendiumDocument } from "../server/src/services/compendium/nativeCompendium.js";

const root = resolve(import.meta.dirname, "..");
const sourceDirectory = resolve(root, "..", "compendium");
const documents = new Map(readdirSync(sourceDirectory)
  .filter((name) => name.endsWith(".json"))
  .map((name) => [name, JSON.parse(readFileSync(resolve(sourceDirectory, name), "utf8")) as unknown])
  .filter(([, document]) => (document as { format?: unknown }).format === "beholden.compendium"));

function runScenario(name: string, files: string[]): Record<string, unknown> {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  const imports: Array<Record<string, unknown>> = [];
  const started = performance.now();
  try {
    for (const file of files) {
      const before = performance.now();
      const result = importNativeCompendiumDocument(db, documents.get(file));
      imports.push({ file, milliseconds: Number((performance.now() - before).toFixed(1)), ...result });
    }
    const exported = exportNativeCompendiumBundle(db);
    const validationStarted = performance.now();
    const validated = parseNativeCompendiumDocument(exported);
    return {
      name, status: "valid", importMilliseconds: Number((performance.now() - started).toFixed(1)), imports,
      exportedCounts: Object.fromEntries(validated.map((batch) => [batch.category, batch.entries.length])),
      outputBytes: Buffer.byteLength(JSON.stringify(exported)),
      validationMilliseconds: Number((performance.now() - validationStarted).toFixed(1)),
      queryPlans: {
        spellLevel: db.prepare("EXPLAIN QUERY PLAN SELECT id, ruleset, name FROM compendium_spells WHERE ruleset=? AND level=? ORDER BY name LIMIT 50").all("5.5e", 3),
        itemType: db.prepare("EXPLAIN QUERY PLAN SELECT id, ruleset, name FROM compendium_items WHERE ruleset=? AND type_key=? ORDER BY name LIMIT 50").all("5.5e", "weapon"),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { name, status: "rejected", importMilliseconds: Number((performance.now() - started).toFixed(1)), imports, errorSummary: message.split("\n").slice(0, 8) };
  } finally {
    db.close();
  }
}

const supplements = [...documents.keys()].filter((name) => !name.startsWith("WotC_") && name !== "5e_spells_to_5.5e.json");
const scenarios = [
  runScenario("5e", ["WotC_5e_Combined.json"]),
  runScenario("5.5e", ["WotC_2024_only.json", "5e_spells_to_5.5e.json", ...supplements]),
  runScenario("both rulesets: 5e then 5.5e", ["WotC_5e_Combined.json", "WotC_2024_only.json"]),
  runScenario("both rulesets: 5.5e then 5e", ["WotC_2024_only.json", "WotC_5e_Combined.json"]),
];

process.stdout.write(`${JSON.stringify({ scenarios }, null, 2)}\n`);
