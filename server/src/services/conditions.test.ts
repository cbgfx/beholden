import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "../lib/dbSchema.js";
import { ConditionInstanceSchema } from "../lib/schemas.js";
import { seedDefaultConditions } from "./conditions.js";

function fixture() {
  const db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT INTO campaigns (id,name,created_at,updated_at) VALUES ('c1','Campaign',1,1)").run();
  return db;
}

test("default condition catalogue uses the canonical rule-engine keys", () => {
  const db = fixture();
  try {
    seedDefaultConditions(db, "c1");
    const rows = db.prepare("SELECT key,name FROM conditions WHERE campaign_id='c1'").all() as Array<{ key: string; name: string }>;
    assert.ok(rows.some((row) => row.key === "hexed" && row.name === "Hexed"));
    assert.ok(rows.some((row) => row.key === "concentration" && row.name === "Concentration"));
    assert.equal(rows.some((row) => row.key === "hex" || row.key === "concentrating"), false);
  } finally { db.close(); }
});

test("seeding repairs historical catalogue aliases without duplicating them", () => {
  const db = fixture();
  try {
    db.prepare(`INSERT INTO conditions (id,campaign_id,key,name,created_at,updated_at)
      VALUES ('old-hex','c1','hex','Hex',1,1),('old-conc','c1','concentrating','Concentrating',1,1)`).run();
    seedDefaultConditions(db, "c1");
    assert.deepEqual(db.prepare("SELECT key FROM conditions WHERE id IN ('old-hex','old-conc') ORDER BY id").all(), [
      { key: "concentration" }, { key: "hexed" },
    ]);
    seedDefaultConditions(db, "c1");
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM conditions WHERE campaign_id='c1'").get() as { n: number }).n, 18);
  } finally { db.close(); }
});

test("condition input normalizes legacy keys and validates timers", () => {
  assert.equal(ConditionInstanceSchema.parse({ key: "Concentrating", expiresAtRound: 4 }).key, "concentration");
  assert.equal(ConditionInstanceSchema.parse({ key: "HEX" }).key, "hexed");
  assert.throws(() => ConditionInstanceSchema.parse({ key: "" }));
  assert.throws(() => ConditionInstanceSchema.parse({ key: "prone", expiresAtRound: 1.5 }));
  assert.throws(() => ConditionInstanceSchema.parse({ key: "prone", expiresAtRound: -1 }));
});
