/**
 * The player's view of a linked Binder (GET /api/me/characters/:id/binder).
 *
 * Only public records are listed, which was already true. But a public record can point at a
 * hidden one - a public NPC who lives in the DM's secret hideout, a public country on a continent
 * the party hasn't heard of yet - and those related names were joined in without a visibility
 * check, so the hidden record's name reached the player anyway.
 */
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import test from "node:test";
import express from "express";
import { openDb } from "../../lib/db.js";
import type { ServerContext } from "../../server/context.js";
import { registerCharacterRoutes } from "./core.js";

test("a player's Binder view never names a hidden record through a public one", async () => {
  const db = openDb(":memory:");
  const t = Date.now();
  db.exec(`
    INSERT INTO users (id, username, passhash, name, created_at, updated_at) VALUES
      ('dm', 'dm', 'x', 'DM', ${t}, ${t}),
      ('player', 'player', 'x', 'Player', ${t}, ${t});
    INSERT INTO user_characters (id, user_id, name, created_at, updated_at) VALUES ('char', 'player', 'Rin', ${t}, ${t});
    INSERT INTO binders (id, owner_user_id, name, name_key, created_at, updated_at) VALUES ('b', 'dm', 'World', 'world', ${t}, ${t});

    INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at) VALUES
      ('me',       'b', 'mortal',       'Rin',             'rin',             'public', ${t}, ${t}),
      ('npc',      'b', 'mortal',       'Innkeeper',       'innkeeper',       'public', ${t}, ${t}),
      ('hideout',  'b', 'location',     'Secret Hideout',  'secret hideout',  'dm',     ${t}, ${t}),
      ('cult',     'b', 'organization', 'Hidden Cult',     'hidden cult',     'dm',     ${t}, ${t}),
      ('far',      'b', 'continent',    'Unknown Lands',   'unknown lands',   'dm',     ${t}, ${t}),
      ('kingdom',  'b', 'country',      'Known Kingdom',   'known kingdom',   'public', ${t}, ${t});
    INSERT INTO binder_continents (id, created_at, updated_at) VALUES ('far', ${t}, ${t});
    INSERT INTO binder_countries (id, continent_id, created_at, updated_at) VALUES ('kingdom', 'far', ${t}, ${t});
    INSERT INTO binder_locations (id, created_at, updated_at) VALUES ('hideout', ${t}, ${t});
    INSERT INTO binder_organizations (id, created_at, updated_at) VALUES ('cult', ${t}, ${t});
    INSERT INTO mortals (id, mortal_type, residence_record_id, created_at, updated_at) VALUES
      ('me',  'player_character', NULL,      ${t}, ${t}),
      ('npc', 'npc',              'hideout', ${t}, ${t});
    INSERT INTO organization_memberships (id, organization_id, mortal_id, is_primary, created_at, updated_at)
      VALUES ('om', 'cult', 'npc', 1, ${t}, ${t});
    INSERT INTO binder_player_characters (mortal_id, character_id, created_at, updated_at) VALUES ('me', 'char', ${t}, ${t});
  `);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { userId: "player", username: "player", isAdmin: false }; next(); });
  // Only the read route runs here; the upload middleware just has to exist for registration.
  const noUpload = { single: () => (_req: unknown, _res: unknown, next: () => void) => next() };
  registerCharacterRoutes(app, {
    db, broadcast: () => {}, helpers: { now: Date.now, uid: () => "x" }, imageUpload: noUpload, upload: noUpload,
  } as unknown as ServerContext);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as net.AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/me/characters/char/binder`);
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json() as {
      mortals: Array<{ id: string; location: string | null; organization: string | null }>;
      places: Array<{ id: string; parentName: string | null }>;
    };

    // The innkeeper is public and listed, but where they live and who they serve are the DM's secrets.
    const innkeeper = body.mortals.find((mortal) => mortal.id === "npc");
    assert.ok(innkeeper, "the public NPC is still listed");
    assert.equal(innkeeper.location, null);
    assert.equal(innkeeper.organization, null);

    // The kingdom is public; the continent it sits on is not, so it has no named parent.
    const kingdom = body.places.find((place) => place.id === "kingdom");
    assert.ok(kingdom, "the public country is still listed");
    assert.equal(kingdom.parentName, null);

    // And no hidden name appears anywhere in the response.
    const text = JSON.stringify(body);
    for (const secret of ["Secret Hideout", "Hidden Cult", "Unknown Lands"]) {
      assert.equal(text.includes(secret), false, `${secret} leaked into the player's Binder`);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
