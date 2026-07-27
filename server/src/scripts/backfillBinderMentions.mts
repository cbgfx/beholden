import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import Database from "better-sqlite3";

/**
 * One-time backfill: the Notion importer wrote mention-shaped links
 * (`[Label](/binder/{binderId}/{type}/{id})`) directly into rich-text
 * columns but never populated `binder_record_mentions`, so backlinks
 * and dangling-mention detection were blind to every pre-existing
 * mention. This walks every typed record's text fields, applies the
 * same extraction `syncMentionField` uses on save, and (re)builds the
 * index. Idempotent: clears only the (source_record_id, source_field)
 * rows it's about to repopulate, never touches the text itself.
 */

const dbPath = path.join(os.homedir(), "AppData", "Roaming", "Beholden", "beholden.db");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const MENTION_PATTERN = /\[([^\]]+)\]\(\/binder\/[^/]+\/[^/]+\/([^/?#)]+)[^)]*\)/g;

const SOURCES: Array<{ table: string; fields: string[] }> = [
  { table: "mortals", fields: ["description", "backstory", "dm_notes"] },
  { table: "deities", fields: ["description", "dm_notes"] },
  { table: "binder_races", fields: ["description"] },
  { table: "binder_positions", fields: ["description"] },
  { table: "binder_organizations", fields: ["description", "dm_notes"] },
  { table: "binder_domains", fields: ["description"] },
  { table: "binder_continents", fields: ["description"] },
  { table: "binder_countries", fields: ["description"] },
  { table: "binder_locations", fields: ["description"] },
  { table: "binder_points_of_interest", fields: ["description"] },
  { table: "binder_items", fields: ["description", "dm_notes"] },
  { table: "binder_events", fields: ["description"] },
];

const recordExists = db.prepare("SELECT id FROM binder_records WHERE id = ? AND binder_id = ?");
const clearMentions = db.prepare("DELETE FROM binder_record_mentions WHERE source_record_id = ? AND source_field = ?");
const insertMention = db.prepare(`
  INSERT INTO binder_record_mentions
    (id,source_record_id,source_field,target_record_id,target_external_id,label,occurrence_key,created_at)
  VALUES (?,?,?,?,NULL,?,?,?)
`);

let fieldsScanned = 0;
let inserted = 0;
let skippedInvalidTarget = 0;

const run = db.transaction(() => {
  for (const { table, fields } of SOURCES) {
    for (const field of fields) {
      const rows = db.prepare(
        `SELECT br.id AS record_id, br.binder_id AS binder_id, t.${field} AS text
         FROM ${table} t JOIN binder_records br ON br.id = t.id
         WHERE t.${field} IS NOT NULL AND t.${field} != ''`,
      ).all() as Array<{ record_id: string; binder_id: string; text: string }>;

      for (const row of rows) {
        fieldsScanned += 1;
        clearMentions.run(row.record_id, field);
        MENTION_PATTERN.lastIndex = 0;
        let match: RegExpExecArray | null;
        let occurrence = 0;
        while ((match = MENTION_PATTERN.exec(row.text)) !== null) {
          const targetId = decodeURIComponent(match[2]!);
          const target = recordExists.get(targetId, row.binder_id);
          if (!target) {
            skippedInvalidTarget += 1;
            continue;
          }
          insertMention.run(
            crypto.randomUUID(),
            row.record_id,
            field,
            targetId,
            match[1]!.replace(/^@/, ""),
            `${targetId}:${occurrence++}`,
            Date.now(),
          );
          inserted += 1;
        }
      }
    }
  }
});

run();

console.log(`Scanned ${fieldsScanned} non-empty text fields across ${SOURCES.length} record types.`);
console.log(`Indexed ${inserted} mentions. Skipped ${skippedInvalidTarget} links whose target no longer resolves (genuinely stale, left unindexed).`);

db.close();
