/**
 * The guard against the bug that kept coming back: a reference nobody decided how to keep valid.
 *
 * It reads the real schema, so it cannot drift from it. It fails when:
 * - a `*_id` column has no foreign key and is not in UNENFORCED_REFERENCES with a reason;
 * - a registry entry names a column that no longer exists;
 * - a migration adds a column with ALTER TABLE ... ADD COLUMN where the fresh schema declares a
 *   foreign key (so upgraded databases silently lack it), and no trigger is registered to make up
 *   for it - which is exactly how deleting an encounter came to leave its loot behind.
 *
 * If this fails on something you added: give the column a real foreign key. If that is genuinely
 * impossible, add it to referenceRegistry.ts saying why, and what removes the reference when its
 * target goes.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { UNENFORCED_REFERENCES, UPGRADE_DRIFT } from "./referenceRegistry.js";

type Column = { name: string; pk: number };
type ForeignKey = { from: string; table: string; to: string };

function freshDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "beholden-reference-guard-"));
  const db = openDb(path.join(dir, "fresh.db"));
  return {
    db,
    dispose: () => {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function schemaReferences(db: ReturnType<typeof openDb>) {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
    .map((row) => row.name);
  const unenforced: Array<{ table: string; column: string }> = [];
  const enforced = new Set<string>();
  const existing = new Set<string>();
  for (const table of tables) {
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as ForeignKey[];
    for (const fk of foreignKeys) enforced.add(`${table}.${fk.from}`);
    for (const column of db.prepare(`PRAGMA table_info("${table}")`).all() as Column[]) {
      existing.add(`${table}.${column.name}`);
      if (column.pk !== 0 || !column.name.endsWith("_id")) continue;
      if (!enforced.has(`${table}.${column.name}`)) unenforced.push({ table, column: column.name });
    }
  }
  return { unenforced, enforced, existing };
}

test("every reference the database does not enforce has a written reason", () => {
  const fresh = freshDatabase();
  try {
    const { unenforced } = schemaReferences(fresh.db);
    const registered = new Set(UNENFORCED_REFERENCES.map((entry) => `${entry.table}.${entry.column}`));
    const undecided = unenforced.map((ref) => `${ref.table}.${ref.column}`).filter((key) => !registered.has(key));
    assert.deepEqual(
      undecided,
      [],
      `These *_id columns have no foreign key and no entry in referenceRegistry.ts: ${undecided.join(", ")}.\n`
        + "Give them a foreign key, or register them with the reason one is impossible and what keeps them valid.",
    );
  } finally {
    fresh.dispose();
  }
});

test("the registry only describes columns that exist, and does not excuse ones that are enforced", () => {
  const fresh = freshDatabase();
  try {
    const { existing, enforced } = schemaReferences(fresh.db);
    for (const entry of UNENFORCED_REFERENCES) {
      const key = `${entry.table}.${entry.column}`;
      assert.ok(existing.has(key), `${key} is registered but does not exist any more - remove the entry`);
      assert.ok(!enforced.has(key), `${key} now has a foreign key - remove it from the registry`);
      assert.ok(entry.why.trim().length > 20, `${key} needs a real reason`);
    }
  } finally {
    fresh.dispose();
  }
});

test("a column added by ALTER TABLE keeps its cascade on upgraded databases", () => {
  const fresh = freshDatabase();
  try {
    const { enforced } = schemaReferences(fresh.db);
    const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");
    const drift: string[] = [];
    for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))) {
      const source = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      for (const match of source.matchAll(/ALTER\s+TABLE\s+"?(\w+)"?\s+ADD\s+COLUMN\s+"?(\w+)"?([^"`;\n]*)/gi)) {
        const [, table, column, rest] = match as unknown as [string, string, string, string];
        // The fresh schema enforces this column, but the upgrade path adds it without REFERENCES:
        // every database created before this migration lacks the foreign key.
        if (enforced.has(`${table}.${column}`) && !/REFERENCES/i.test(rest)) drift.push(`${table}.${column} (${file})`);
      }
    }

    const compensated = new Set(UPGRADE_DRIFT.map((entry) => `${entry.table}.${entry.column}`));
    const uncompensated = drift.filter((entry) => !compensated.has(entry.split(" ")[0]!));
    assert.deepEqual(
      uncompensated,
      [],
      `Upgraded databases get these columns without their foreign key: ${uncompensated.join(", ")}.\n`
        + "Add REFERENCES to the ALTER TABLE, or install a trigger and register it in UPGRADE_DRIFT.",
    );

    // And every registered compensation really is installed.
    for (const entry of UPGRADE_DRIFT) {
      const trigger = fresh.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = ?").get(entry.trigger);
      assert.ok(trigger, `${entry.table}.${entry.column} relies on trigger ${entry.trigger}, which is not installed`);
    }
  } finally {
    fresh.dispose();
  }
});
