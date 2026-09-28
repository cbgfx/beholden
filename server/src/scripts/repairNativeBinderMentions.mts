import fs from "node:fs";
import crypto from "node:crypto";

const file = process.argv[2];
if (!file) throw new Error("Usage: tsx repairNativeBinderMentions.mts <binder.json>");

const doc = JSON.parse(fs.readFileSync(file, "utf8"));
if (doc.format !== "beholden-binder" || doc.version !== 1) throw new Error("Not a native Binder v1 document");

const records = new Set<string>(doc.records.map((row: { id: unknown }) => String(row.id)));
const sources: Array<[string, string[]]> = [
  ["mortals", ["description", "backstory", "dm_notes"]],
  ["deities", ["description", "dm_notes"]],
  ["binder_races", ["description"]], ["binder_positions", ["description"]],
  ["binder_organizations", ["description", "dm_notes"]], ["binder_domains", ["description"]],
  ["binder_continents", ["description"]], ["binder_countries", ["description"]],
  ["binder_locations", ["description"]], ["binder_points_of_interest", ["description"]],
  ["binder_items", ["description", "dm_notes"]], ["binder_events", ["description"]],
];
const mentions: Array<Record<string, unknown>> = [];
let repairedRoutes = 0;

for (const [table, fields] of sources) {
  for (const row of doc.data[table] ?? []) {
    for (const field of fields) {
      if (typeof row[field] !== "string") continue;
      row[field] = row[field].replace(
        /\[([^\]]+)]\(\/binder\/[^/]+\/([^/]+)\/([^/?#)]+)[^)]*\)/g,
        (whole: string, rawLabel: string, section: string, encodedId: string) => {
          const targetId = decodeURIComponent(encodedId);
          if (!records.has(targetId)) return whole;
          repairedRoutes += 1;
          mentions.push({
            id: crypto.randomUUID(), source_record_id: String(row.id), source_field: field,
            target_record_id: targetId, target_external_id: null,
            label: rawLabel.replace(/^@/, ""), occurrence_key: `${targetId}:${mentions.length}`,
            created_at: Date.now(),
          });
          return `[${rawLabel}](/binder/__IMPORT__/${section}/${encodedId})`;
        },
      );
    }
  }
}

doc.data.binder_record_mentions = mentions;
fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
console.log(`Repaired ${repairedRoutes} Binder link(s) and rebuilt ${mentions.length} mention index row(s).`);
