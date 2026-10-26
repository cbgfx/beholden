import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { openDb, type Db } from "./db.js";
import { registerBinderRoutes } from "../routes/binders/core.js";
import { registerBinderReferenceRoutes } from "../routes/binders/references.js";
import { registerBinderMortalRoutes } from "../routes/binders/mortals.js";
import type { ServerContext } from "../server/context.js";
import { normalizeKey } from "./text.js";
import { createMortal } from "../services/binders/mortals.js";

let db: Db | null = null;

let server: Server | null = null;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
  db?.close();
  db = null;
});

function seedUser(database: Db, id: string, isAdmin = false) {
  database.prepare(`
    INSERT INTO users (id, username, passhash, name, is_admin, created_at, updated_at)
    VALUES (?, ?, 'hash', ?, ?, 1, 1)
  `).run(id, id, id, isAdmin ? 1 : 0);
}



describe("Binder routes", () => {
  test("grants attached Campaign DMs read access while retaining owner-only writes", async () => {
    db = openDb(":memory:");
    seedUser(db, "owner");
    seedUser(db, "other");
    db.prepare(`
      INSERT INTO campaigns (id, name, created_at, updated_at)
      VALUES ('campaign', 'Frozen Assets', 1, 1)
    `).run();
    db.prepare(`
      INSERT INTO campaign_membership (
        id, campaign_id, user_id, role, created_at, updated_at
      ) VALUES ('membership', 'campaign', 'owner', 'dm', 1, 1)
    `).run();
    db.prepare(`
      INSERT INTO campaign_membership (
        id, campaign_id, user_id, role, created_at, updated_at
      ) VALUES ('other-membership', 'campaign', 'other', 'dm', 1, 1)
    `).run();

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const userId = String(req.headers["x-test-user"] ?? "owner");
      req.user = { userId, username: userId, isAdmin: false };
      next();
    });
    let idCounter = 0;
    const context = {
      db,
      helpers: {
        uid: () => `id-${++idCounter}`,
        now: () => 100,
        normalizeKey,
      },
      broadcast: () => {},
      upload: multer({ storage: multer.memoryStorage() }),
      imageUpload: multer({ storage: multer.memoryStorage() }),
      fs,
      path,
      paths: { dataDir: os.tmpdir() },
    } as unknown as ServerContext;
    registerBinderRoutes(app, context);
    registerBinderReferenceRoutes(app, context);
    registerBinderMortalRoutes(app, context);
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ message: error instanceof Error ? error.message : "error" });
    });

    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;

    const created = await fetch(`${base}/api/binders`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "owner" },
      body: JSON.stringify({ name: "Tarentha", currentDateText: "2438", currentDateSort: 2438 }),
    });
    assert.equal(created.status, 201);
    const binder = await created.json() as { id: string; name: string };
    assert.equal(binder.name, "Tarentha");
    const healthResponse = await fetch(`${base}/api/binders/${binder.id}/health`, { headers: { "x-test-user": "owner" } });
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json() as { healthy: boolean; issueCount: number; groups: unknown[] };
    assert.equal(health.healthy, true);
    assert.equal(health.issueCount, 0);
    assert.equal(health.groups.length, 6);

    const hidden = await fetch(`${base}/api/binders/${binder.id}`, {
      headers: { "x-test-user": "other" },
    });
    assert.equal(hidden.status, 404);

    const assigned = await fetch(`${base}/api/campaigns/campaign/binder`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-test-user": "owner" },
      body: JSON.stringify({
        binderId: binder.id,
        currentDateText: "2440",
        currentDateSort: 2440,
      }),
    });
    assert.equal(assigned.status, 200);
    assert.deepEqual(
      db.prepare(`
        SELECT binder_id, current_date_text, current_date_sort
        FROM campaigns WHERE id = 'campaign'
      `).get(),
      { binder_id: binder.id, current_date_text: "2440", current_date_sort: 2440 },
    );

    const shared = await fetch(`${base}/api/binders/${binder.id}`, {
      headers: { "x-test-user": "other" },
    });
    assert.equal(shared.status, 200);

    const visibleList = await fetch(`${base}/api/binders`, {
      headers: { "x-test-user": "other" },
    });
    assert.equal(visibleList.status, 200);
    const visibleBinders = await visibleList.json() as Array<{ id: string }>;
    assert.equal(visibleBinders.some((item) => item.id === binder.id), true);

    const forbiddenEdit = await fetch(`${base}/api/binders/${binder.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-user": "other" },
      body: JSON.stringify({ name: "Not Allowed" }),
    });
    assert.equal(forbiddenEdit.status, 404);

    let raceReferenceId = "";
    for (const type of ["races", "positions", "domains"] as const) {
      const createdReference = await fetch(`${base}/api/binders/${binder.id}/reference/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": "owner" },
        body: JSON.stringify({ name: `Test ${type}`, description: "" }),
      });
      assert.equal(createdReference.status, 201, await createdReference.clone().text());
      const reference = await createdReference.json() as {
        id: string;
        description: string | null;
      };
      assert.equal(reference.description, null);
      if (type === "races") raceReferenceId = reference.id;

      const sharedReference = await fetch(`${base}/api/binders/${binder.id}/reference/${type}`, {
        headers: { "x-test-user": "other" },
      });
      assert.equal(sharedReference.status, 200);

      const forbiddenReferenceEdit = await fetch(
        `${base}/api/binders/${binder.id}/reference/${type}/${reference.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-test-user": "other" },
          body: JSON.stringify({ name: "Not Allowed" }),
        },
      );
      assert.equal(forbiddenReferenceEdit.status, 404);

      const updatedReference = await fetch(
        `${base}/api/binders/${binder.id}/reference/${type}/${reference.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-test-user": "owner" },
          body: JSON.stringify({ description: "Structured lore" }),
        },
      );
      assert.equal(updatedReference.status, 200);
      assert.equal(
        (await updatedReference.json() as { description: string }).description,
        "Structured lore",
      );
    }

    for (const type of ["organizations", "positions", "points-of-interest"] as const) {
      const created = await fetch(`${base}/api/binders/${binder.id}/reference/${type}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-test-user": "owner" },
        body: JSON.stringify({ name: `Iconic ${type}`, icon: "game-icons:castle" }),
      });
      assert.equal(created.status, 201, await created.clone().text());
      const record = await created.json() as { id: string; icon: string | null };
      assert.equal(record.icon, "game-icons:castle");

      const listed = await fetch(`${base}/api/binders/${binder.id}/reference/${type}`, {
        headers: { "x-test-user": "owner" },
      });
      const list = await listed.json() as Array<{ id: string; icon: string | null }>;
      assert.equal(list.find((row) => row.id === record.id)?.icon, "game-icons:castle");

      const cleared = await fetch(`${base}/api/binders/${binder.id}/reference/${type}/${record.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-test-user": "owner" },
        body: JSON.stringify({ icon: null }),
      });
      assert.equal(cleared.status, 200);
      assert.equal((await cleared.json() as { icon: string | null }).icon, null);
    }

    createMortal(db, {
      binderId: binder.id,
      name: "Referenced mortal",
      nameKey: "referenced mortal",
      subtype: { type: "npc", monsterId: null },
    }, { recordId: "referenced-mortal" }, 101);
    db.prepare("UPDATE mortals SET race_id = ? WHERE id = 'referenced-mortal'").run(raceReferenceId);
    const deletedRace = await fetch(
      `${base}/api/binders/${binder.id}/reference/races/${raceReferenceId}`,
      { method: "DELETE", headers: { "x-test-user": "owner" } },
    );
    assert.equal(deletedRace.status, 200);
    assert.deepEqual(
      await deletedRace.json(),
      { ok: true, clearedReferences: 1 },
    );
    assert.equal(
      db.prepare("SELECT race_id FROM mortals WHERE id = 'referenced-mortal'").pluck().get(),
      null,
    );
    db.prepare(`
      INSERT INTO players (
        id, campaign_id, player_name, character_name, live_json, created_at, updated_at
      ) VALUES ('existing-player', 'campaign', 'Jean-Marc', 'Brother Diego', '{}', 1, 1)
    `).run();
    db.prepare(`
      INSERT INTO campaigns (id, name, binder_id, created_at, updated_at)
      VALUES ('second-campaign', 'Real Drama Club', ?, 1, 1)
    `).run(binder.id);
    db.prepare(`
      INSERT INTO players (
        id, campaign_id, player_name, character_name, live_json, created_at, updated_at
      ) VALUES ('same-player-other-campaign', 'second-campaign', 'Jean-Marc', 'Brother Diego', '{}', 1, 1)
    `).run();
    const mortalOptionsResponse = await fetch(`${base}/api/binders/${binder.id}/mortal-options`, {
      headers: { "x-test-user": "owner" },
    });
    assert.equal(mortalOptionsResponse.status, 200);
    const mortalOptions = await mortalOptionsResponse.json() as { players: Array<{ playerName: string; characterName: string; campaignName: string; campaignNames: string[] }> };
    const brotherDiegoOptions = mortalOptions.players.filter((player) => player.playerName === "Jean-Marc" && player.characterName === "Brother Diego");
    assert.equal(brotherDiegoOptions.length, 1);
    assert.match(brotherDiegoOptions[0]!.campaignName, /Frozen Assets/);
    assert.match(brotherDiegoOptions[0]!.campaignName, /Real Drama Club/);
    assert.deepEqual(brotherDiegoOptions[0]!.campaignNames, ["Frozen Assets", "Real Drama Club"]);

    const createdMortalResponse = await fetch(`${base}/api/binders/${binder.id}/mortals`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "owner" },
      body: JSON.stringify({
        name: "Brynja",
        mortalType: "npc",
        raceId: null,
        gender: "female",
        birthDate: null,
        deathDate: null,
        locationId: null,
        organizationId: null,
        positionId: null,
        notes: "",
        dmNotes: null,
        playerId: null,
      }),
    });
    assert.equal(createdMortalResponse.status, 201, await createdMortalResponse.clone().text());
    const createdMortal = await createdMortalResponse.json() as {
      id: string;
      mortalType: string;
      notes: string | null;
    };
    assert.equal(createdMortal.mortalType, "npc");
    assert.equal(createdMortal.notes, null);
    assert.equal(
      db.prepare("SELECT COUNT(*) FROM binder_npcs WHERE mortal_id = ?").pluck().get(createdMortal.id),
      1,
    );

    db.exec(`
      INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at)
      VALUES
        ('mortal-org-one', '${binder.id}', 'organization', 'First Org', 'first org', 'dm', 1, 1),
        ('mortal-org-two', '${binder.id}', 'organization', 'Second Org', 'second org', 'dm', 1, 1);
      INSERT INTO binder_organizations (id, created_at, updated_at) VALUES ('mortal-org-one', 1, 1);
      INSERT INTO binder_organizations (id, created_at, updated_at) VALUES ('mortal-org-two', 1, 1);
    `);
    const multiOrgResponse = await fetch(`${base}/api/binders/${binder.id}/mortals/${createdMortal.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-test-user": "owner" },
      body: JSON.stringify({ organizationIds: ["mortal-org-one", "mortal-org-two"] }),
    });
    assert.equal(multiOrgResponse.status, 200, await multiOrgResponse.clone().text());
    assert.deepEqual(
      (await multiOrgResponse.json() as { organizations: Array<{ id: string }> }).organizations.map((organization) => organization.id),
      ["mortal-org-one", "mortal-org-two"],
    );

    const convertedMortalResponse = await fetch(
      `${base}/api/binders/${binder.id}/mortals/${createdMortal.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-test-user": "owner" },
        body: JSON.stringify({ mortalType: "player_character", playerId: "existing-player" }),
      },
    );
    assert.equal(convertedMortalResponse.status, 200, await convertedMortalResponse.clone().text());
    assert.equal(
      (await convertedMortalResponse.json() as { mortalType: string }).mortalType,
      "player_character",
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) FROM binder_npcs WHERE mortal_id = ?").pluck().get(createdMortal.id),
      0,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) FROM binder_player_characters WHERE mortal_id = ?").pluck().get(createdMortal.id),
      1,
    );
    assert.equal(
      db.prepare("SELECT player_id FROM binder_player_characters WHERE mortal_id = ?").pluck().get(createdMortal.id),
      "existing-player",
    );

    const duplicatePlayerLink = await fetch(`${base}/api/binders/${binder.id}/mortals`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "owner" },
      body: JSON.stringify({
        name: "Duplicate PC",
        mortalType: "player_character",
        playerId: "existing-player",
      }),
    });
    assert.equal(duplicatePlayerLink.status, 400);

    const deletedMortalResponse = await fetch(
      `${base}/api/binders/${binder.id}/mortals/${createdMortal.id}`,
      { method: "DELETE", headers: { "x-test-user": "owner" } },
    );
    assert.equal(deletedMortalResponse.status, 200);
    assert.equal(db.prepare("SELECT 1 FROM mortals WHERE id = ?").get(createdMortal.id), undefined);

    db.transaction(() => {
      const insertRecord = db!.prepare(`
        INSERT INTO binder_records (id,binder_id,record_type,name,name_key,visibility,created_at,updated_at)
        VALUES (?,?,?,?,?,'dm',1,1)
      `);
      insertRecord.run("delete-continent", binder.id, "continent", "Continent", "continent");
      insertRecord.run("delete-country", binder.id, "country", "Country", "country");
      insertRecord.run("delete-location", binder.id, "location", "Location", "location");
      insertRecord.run("delete-poi-parent", binder.id, "poi", "Parent POI", "parent poi");
      insertRecord.run("delete-poi-child", binder.id, "poi", "Child POI", "child poi");
      db!.prepare("INSERT INTO binder_continents (id,created_at,updated_at) VALUES ('delete-continent',1,1)").run();
      db!.prepare("INSERT INTO binder_countries (id,continent_id,created_at,updated_at) VALUES ('delete-country','delete-continent',1,1)").run();
      db!.prepare("INSERT INTO binder_locations (id,country_id,continent_id,created_at,updated_at) VALUES ('delete-location','delete-country','delete-continent',1,1)").run();
      db!.prepare("INSERT INTO binder_points_of_interest (id,location_id,created_at,updated_at) VALUES ('delete-poi-parent','delete-location',1,1)").run();
      db!.prepare("INSERT INTO binder_points_of_interest (id,parent_poi_id,created_at,updated_at) VALUES ('delete-poi-child','delete-poi-parent',1,1)").run();
    })();

    const deletedBinder = await fetch(`${base}/api/binders/${binder.id}`, {
      method: "DELETE",
      headers: { "x-test-user": "owner" },
    });
    assert.equal(deletedBinder.status, 200, await deletedBinder.clone().text());
    assert.deepEqual(await deletedBinder.json(), { ok: true, detachedCampaigns: 2 });
    assert.equal(db.prepare("SELECT 1 FROM binders WHERE id = ?").get(binder.id), undefined);
    assert.equal(db.prepare("SELECT binder_id FROM campaigns WHERE id = 'campaign'").pluck().get(), null);

    const dmCreated = await fetch(`${base}/api/binders`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "other" },
      body: JSON.stringify({ name: "Another Binder", currentDateText: "2438", currentDateSort: 2438 }),
    });
    assert.equal(dmCreated.status, 201);
  });
});
