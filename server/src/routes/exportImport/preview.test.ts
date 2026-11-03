import assert from "node:assert/strict";
import test from "node:test";
import { openDb } from "../../lib/db.js";
import { previewCampaignImport } from "./preview.js";

test("preview distinguishes same-name campaigns, reports missing links, and writes nothing", () => {
  const db = openDb(":memory:");
  try {
    db.exec(
      "INSERT INTO campaigns(id,name,created_at,updated_at) VALUES ('existing','Campaign',1,1)",
    );
    const before = db.serialize();
    const preview = previewCampaignImport(db, {
      campaign: { id: "new", name: "Campaign", binderId: "missing" },
      players: [
        { id: "hero", characterName: "Hero", characterId: "missing-character" },
      ],
    });
    assert.equal(preview.existingName, null);
    assert.deepEqual(preview.sameNameCampaigns, ["Campaign"]);
    assert.equal(preview.warnings.length, 2);
    assert.deepEqual(db.serialize(), before);
  } finally {
    db.close();
  }
});

test("preview rejects invalid files and IDs belonging to other campaigns", () => {
  const db = openDb(":memory:");
  try {
    db.exec(
      "INSERT INTO campaigns(id,name,created_at,updated_at) VALUES ('existing','Campaign',1,1)",
    );
    db.exec(
      "INSERT INTO adventures(id,campaign_id,name,created_at,updated_at) VALUES ('taken','existing','Adventure',1,1)",
    );
    assert.throws(
      () =>
        previewCampaignImport(db, {
          campaign: { id: "new" },
          adventures: [{ id: "taken" }],
        }),
      /already belongs/,
    );
    assert.throws(
      () =>
        previewCampaignImport(db, {
          campaign: { id: "new", ruleset: "invalid" },
        }),
      /Invalid campaign export/,
    );
    assert.equal(db.prepare("SELECT count(*) FROM campaigns").pluck().get(), 1);
  } finally {
    db.close();
  }
});
