import assert from "node:assert/strict";
import test from "node:test";
import { openDb, type Db } from "../../lib/db.js";
import { importCampaignDocument } from "./helpers.js";

// Uses the fully migrated database (openDb), not the bare schema, so the real foreign keys on
// Binder links (campaigns.binder_id, inpcs.binder_mortal_id) are enforced like in production.
function withDb(run: (db: Db) => void): void {
  const db = openDb(":memory:");
  try {
    run(db);
  } finally {
    db.close();
  }
}

const v3 = (body: Record<string, unknown>) => ({ format: "beholden.campaign", version: 3, ...body });

/** A Binder with one mortal, as it would exist on the installation that made the export. */
function seedBinderWithMortal(db: Db): void {
  db.exec(`
    INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at) VALUES ('owner', 'owner', 'hash', 'Owner', 1, 1, 1);
    INSERT INTO binders (id, owner_user_id, name, name_key, created_at, updated_at) VALUES ('binder-1', 'owner', 'Binder', 'binder', 1, 1);
    INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at)
      VALUES ('mortal-1', 'binder-1', 'mortal', 'Merchant', 'merchant', 'dm', 1, 1);
    INSERT INTO mortals (id, life_status, mortal_type, created_at, updated_at) VALUES ('mortal-1', 'alive', 'npc', 1, 1);
  `);
}

const binderLinkedCampaign = v3({
  campaign: {
    id: "campaign-1", name: "Campaign", binderId: "binder-1",
    currentDate: { text: "14 Mirtul 1492", sort: 1492 },
  },
  inpcs: { "npc-1": { id: "npc-1", monsterId: "monster-1", binderMortalId: "mortal-1", name: "NPC" } },
});

test("campaign v3 import restores portable campaign and combat state", () => {
  withDb((db) => {
    importCampaignDocument(db, v3({
      campaign: { id: "campaign-1", name: "Campaign", ruleset: "5.5e", isActive: false },
      adventures: { "adventure-1": { id: "adventure-1", name: "Adventure" } },
      encounters: {
        "encounter-1": {
          id: "encounter-1", adventureId: "adventure-1", name: "Encounter", xpAwardedAt: 12345,
        },
      },
      combats: {
        "encounter-1": {
          encounterId: "encounter-1",
          round: 2,
          combatants: [{
            id: "combatant-1", baseType: "monster", baseId: "monster-1", name: "Monster",
            friendly: false, usedLegendaryResistances: 2, engagedWithPlayers: true,
          }],
        },
      },
    }), () => "generated-id");

    assert.equal(db.prepare("SELECT is_active FROM campaigns WHERE id='campaign-1'").pluck().get(), 0);
    assert.equal(db.prepare("SELECT xp_awarded_at FROM encounters WHERE id='encounter-1'").pluck().get(), 12345);
    const live = JSON.parse(String(db.prepare("SELECT live_json FROM combatants WHERE id='combatant-1'").pluck().get())) as Record<string, unknown>;
    assert.equal(live.usedLegendaryResistances, 2);
    assert.equal(live.engagedWithPlayers, true);
  });
});

test("campaign import keeps its Binder link and NPC mortal when that Binder exists here", () => {
  withDb((db) => {
    seedBinderWithMortal(db);
    importCampaignDocument(db, binderLinkedCampaign, () => "generated-id");
    const campaign = db.prepare("SELECT binder_id, current_date_text, current_date_sort FROM campaigns WHERE id='campaign-1'").get();
    assert.deepEqual({ ...campaign as object }, { binder_id: "binder-1", current_date_text: "14 Mirtul 1492", current_date_sort: 1492 });
    assert.equal(db.prepare("SELECT binder_mortal_id FROM inpcs WHERE id='npc-1'").pluck().get(), "mortal-1");
  });
});

test("campaign import onto another installation drops Binder links but keeps the in-world date", () => {
  withDb((db) => {
    importCampaignDocument(db, binderLinkedCampaign, () => "generated-id");
    const campaign = db.prepare("SELECT binder_id, current_date_text FROM campaigns WHERE id='campaign-1'").get();
    assert.deepEqual({ ...campaign as object }, { binder_id: null, current_date_text: "14 Mirtul 1492" });
    assert.equal(db.prepare("SELECT binder_mortal_id FROM inpcs WHERE id='npc-1'").pluck().get(), null);
  });
});

test("campaign import restores a player's base speed, not the condition-adjusted one", () => {
  withDb((db) => {
    importCampaignDocument(db, v3({
      campaign: { id: "campaign-1" },
      players: { "player-1": { id: "player-1", characterName: "Grappled", speed: 0, baseSpeed: 30, conditions: [{ key: "grappled" }] } },
    }), () => "generated-id");
    assert.equal(db.prepare("SELECT speed FROM players WHERE id='player-1'").pluck().get(), 30);
  });
});

test("campaign v3 import requires its format discriminator and rejects unknown versions", () => {
  withDb((db) => {
    assert.throws(() => importCampaignDocument(db, { version: 3, campaign: { id: "campaign-1" } }, () => "id"), /format/u);
    assert.throws(() => importCampaignDocument(db, { format: "beholden.campaign", version: 4, campaign: { id: "campaign-1" } }, () => "id"), /Unsupported campaign export version: 4/u);
  });
});

test("campaign v3 import rejects wrong types instead of coercing them", () => {
  withDb((db) => {
    // Boolean("false") used to be read as true.
    assert.throws(() => importCampaignDocument(db, v3({
      campaign: { id: "campaign-1" },
      inpcs: { "npc-1": { id: "npc-1", name: "NPC", friendly: "false" } },
    }), () => "id"), /friendly/u);
    assert.throws(() => importCampaignDocument(db, v3({
      campaign: { id: "campaign-1" },
      encounters: { "encounter-1": { id: "encounter-1", sort: "bad" } },
    }), () => "id"), /sort/u);
    assert.equal(db.prepare("SELECT COUNT(*) FROM campaigns").pluck().get(), 0, "nothing is written for an invalid file");
  });
});

test("campaign v3 import rejects note and treasure parents outside the document", () => {
  withDb((db) => {
    assert.throws(() => importCampaignDocument(db, v3({
      campaign: { id: "campaign-1" },
      notes: { "note-1": { id: "note-1", adventureId: "missing" } },
    }), () => "id"), /Note references/u);
    assert.throws(() => importCampaignDocument(db, v3({
      campaign: { id: "campaign-1" },
      treasure: { "loot-1": { id: "loot-1", encounterId: "missing" } },
    }), () => "id"), /Treasure references/u);
    assert.equal(db.prepare("SELECT COUNT(*) FROM campaigns").pluck().get(), 0);
  });
});

test("legacy v2 files are migrated: arrays, typeKey and dangling parents are handled as before", () => {
  withDb((db) => {
    importCampaignDocument(db, {
      version: 2,
      campaign: { id: "campaign-1", name: "Legacy" },
      adventures: [{ id: "adventure-1", name: "Adventure" }],
      notes: [{ id: "note-1", adventureId: "deleted-adventure", title: "Kept" }],
      treasure: [{ id: "loot-1", adventureId: "adventure-1", encounterId: "deleted-encounter", typeKey: "weapon", qty: 0 }],
    }, () => "id");
    assert.equal(db.prepare("SELECT adventure_id FROM notes WHERE id='note-1'").pluck().get(), null);
    const loot = db.prepare("SELECT adventure_id, encounter_id, type_key, qty FROM treasure WHERE id='loot-1'").get();
    assert.deepEqual({ ...loot as object }, { adventure_id: "adventure-1", encounter_id: null, type_key: "weapon", qty: 1 });
  });
});

test("a stored default condition with an empty key is repaired instead of failing the import", () => {
  withDb((db) => {
    // Shape found in a real campaign: the default "Blinded" row with its key missing.
    importCampaignDocument(db, v3({
      campaign: { id: "campaign-1" },
      conditions: { "cond_campaign-1_blinded": { id: "cond_campaign-1_blinded", key: "", name: "Blinded" } },
    }), () => "id");
    assert.equal(db.prepare("SELECT key FROM conditions WHERE id='cond_campaign-1_blinded'").pluck().get(), "blinded");
    assert.equal(db.prepare("SELECT COUNT(*) FROM conditions WHERE campaign_id='campaign-1' AND key='blinded'").pluck().get(), 1);
  });
});

test("database triggers prevent cross-campaign scoped parents", () => {
  withDb((db) => {
    const now = Date.now();
    db.prepare("INSERT INTO campaigns (id,name,created_at,updated_at) VALUES ('c1','One',?,?),('c2','Two',?,?)").run(now, now, now, now);
    db.prepare("INSERT INTO adventures (id,campaign_id,name,created_at,updated_at) VALUES ('a1','c1','A',?,?)").run(now, now);
    assert.throws(() => db.prepare("INSERT INTO notes (id,campaign_id,adventure_id,created_at,updated_at) VALUES ('n1','c2','a1',?,?)").run(now, now), /scope mismatch/u);
  });
});
