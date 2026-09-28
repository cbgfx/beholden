import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { parseNativeCompendiumDocument } from "../server/src/services/compendium/nativeCompendiumParsing.js";

type JsonRecord = Record<string, unknown>;

const repositoryRoot = resolve(import.meta.dirname, "..");
const corpusDirectories = [resolve(repositoryRoot, "..", "compendium"), resolve(repositoryRoot, "compendium")];
const categories = [
  "monsters", "items", "spells", "classTalents", "classes", "species",
  "backgrounds", "feats", "decks", "bastions",
] as const;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function collection(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((entry): entry is JsonRecord => record(entry) !== null);
  const object = record(value);
  return object ? Object.values(object).filter((entry): entry is JsonRecord => record(entry) !== null) : [];
}

function hash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated].sort();
}

const jsonFiles = corpusDirectories.flatMap((directory) =>
  readdirSync(directory)
    .filter((name) => extname(name).toLowerCase() === ".json")
    .map((name) => join(directory, name)),
);

const identityIndex = new Map<string, Array<{ file: string; ruleset: string; name: string }>>();
const report: JsonRecord = { generatedAt: new Date().toISOString(), files: [], crossPackIdentityCollisions: [] };
const files = report.files as JsonRecord[];

for (const file of jsonFiles) {
  const bytes = readFileSync(file);
  const document = JSON.parse(bytes.toString("utf8")) as JsonRecord;
  const summary: JsonRecord = {
    file: file.startsWith(repositoryRoot) ? file.slice(repositoryRoot.length + 1).replaceAll("\\", "/") : `../${basename(file)}`,
    bytes: statSync(file).size,
    sha256: hash(bytes),
    envelope: { format: document.format ?? null, schema: document.schema ?? null, version: document.version ?? null, exportedAt: document.exportedAt ?? null },
  };

  if (document.format === "beholden.compendium") {
    try {
      const batches = parseNativeCompendiumDocument(document);
      summary.validation = "valid";
      summary.categories = Object.fromEntries(batches.map((batch) => [batch.category, batch.entries.length]));
      summary.rulesets = Object.fromEntries(batches.map((batch) => [batch.category,
        Object.fromEntries([...new Set(batch.entries.map((entry) => String(entry.ruleset)))].sort().map((ruleset) => [ruleset, batch.entries.filter((entry) => entry.ruleset === ruleset).length])),
      ]));
      summary.duplicateIdentitiesWithinFile = Object.fromEntries(batches.map((batch) => [batch.category,
        duplicates(batch.entries.map((entry) => `${String(entry.ruleset)}:${String(entry.id)}`)),
      ]).filter(([, values]) => (values as string[]).length > 0));
      for (const batch of batches) for (const entry of batch.entries) {
        const key = `${batch.category}:${String(entry.ruleset)}:${String(entry.id)}`;
        const occurrences = identityIndex.get(key) ?? [];
        occurrences.push({ file: String(summary.file), ruleset: String(entry.ruleset), name: String(entry.name ?? entry.cardName ?? "") });
        identityIndex.set(key, occurrences);
      }
    } catch (error) {
      summary.validation = "invalid";
      summary.error = error instanceof Error ? error.message : String(error);
    }
  } else if (document.format === "beholden.character") {
    const character = record(document.character);
    summary.kind = "character";
    summary.topLevelFields = Object.keys(document).sort();
    summary.characterFieldCount = character ? Object.keys(character).length : 0;
    summary.characterFields = character ? Object.keys(character).sort() : [];
    summary.characterDataFields = record(character?.characterData) ? Object.keys(character!.characterData as JsonRecord).sort() : [];
    summary.versionRecognized = document.version === 1;
  } else if (record(document.campaign)) {
    summary.kind = "campaign";
    summary.collections = Object.fromEntries([
      "adventures", "encounters", "players", "inpcs", "notes", "partyInventory", "treasure", "conditions", "bastions", "combats",
    ].map((name) => [name, collection(document[name]).length]));
    const adventures = collection(document.adventures);
    const encounters = collection(document.encounters);
    const adventureIds = new Set(adventures.map((entry) => String(entry.id)));
    const encounterIds = new Set(encounters.map((entry) => String(entry.id)));
    summary.referenceIssues = [
      ...encounters.filter((entry) => entry.adventureId != null && !adventureIds.has(String(entry.adventureId))).map(() => "encounter.adventureId"),
      ...collection(document.notes).filter((entry) => entry.adventureId != null && !adventureIds.has(String(entry.adventureId))).map(() => "note.adventureId"),
      ...collection(document.treasure).filter((entry) => entry.adventureId != null && !adventureIds.has(String(entry.adventureId))).map(() => "treasure.adventureId"),
      ...collection(document.treasure).filter((entry) => entry.encounterId != null && !encounterIds.has(String(entry.encounterId))).map(() => "treasure.encounterId"),
      ...collection(document.combats).filter((entry) => !encounterIds.has(String(entry.encounterId))).map(() => "combat.encounterId"),
    ];
  } else {
    summary.kind = document.format === "beholden-binder" ? "binder" : "unknown";
  }
  files.push(summary);
}

report.crossPackIdentityCollisions = [...identityIndex.entries()]
  .filter(([, occurrences]) => occurrences.length > 1)
  .map(([identity, occurrences]) => ({ identity, occurrences }));

report.totals = {
  jsonFiles: jsonFiles.length,
  validCompendiumFiles: files.filter((file) => file.validation === "valid").length,
  invalidCompendiumFiles: files.filter((file) => file.validation === "invalid").length,
  crossPackIdentityCollisions: (report.crossPackIdentityCollisions as unknown[]).length,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
