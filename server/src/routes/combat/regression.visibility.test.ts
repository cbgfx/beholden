import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { insertCombatant } from "../../services/combat.js";
import type { StoredEncounterActor } from "../../server/userData.js";
import { db, campaignId, encounterId, playerCombatantId, playerCharacterId, playerToken, request, dmRequest } from './regression.fixtures.js';

describe("player-safe engaged enemies", () => {
    function makeReserveEnemy(overrides: Partial<StoredEncounterActor> & { id: string }): StoredEncounterActor {
      const t = Date.now();
      return {
        encounterId,
        baseType: "monster",
        baseId: `monster-${overrides.id}`,
        name: "Reserve Enemy",
        label: "Reserve Enemy",
        initiative: 5,
        friendly: false,
        color: "red",
        overrides: { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
        hpCurrent: 11,
        hpMax: 11,
        hpDetails: null,
        ac: 13,
        acDetails: null,
        attackOverrides: null,
        conditions: [],
        createdAt: t,
        updatedAt: t,
        ...overrides,
      };
    }

    it("hides reserves, latches on first damage, and exposes only a qualitative health state", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-engaged-regression",
        name: "Reserve Ogre",
        label: "Bridge Ogre",
        initiative: 4,
        hpCurrent: 20,
        hpMax: 20,
        ac: 12,
      });
      insertCombatant(db, reserve);
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { initiative: 12 });

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const before = await request("GET", statusUrl, undefined, playerToken);
      assert.equal(before.status, 200);
      assert.ok(!JSON.stringify(before.body).includes(reserve.id));

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "damage", amount: 3 } });
      const damaged = await request("GET", statusUrl, undefined, playerToken);
      const damagedText = JSON.stringify(damaged.body);
      assert.match(damagedText, /Bridge Ogre/);
      assert.match(damagedText, /Damaged/);
      assert.ok(!damagedText.includes("hpCurrent"));
      assert.ok(!damagedText.includes("hpMax"));

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "heal", amount: 20 } });
      const healedStorage = db.prepare("SELECT snapshot_json, live_json FROM combatants WHERE id = ?").get(reserve.id) as { snapshot_json: string; live_json: string };
      assert.equal(JSON.parse(healedStorage.live_json).engagedWithPlayers, true, "the engagement latch must survive healing writes");
      const healed = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(healed.body), /Bridge Ogre/, "healing must not hide an engaged enemy");

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "damage", amount: 10 } });
      const bloodied = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(bloodied.body), /Bloodied/);

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`, { hpDelta: { kind: "damage", amount: 20 } });
      const down = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(down.body), /Down/);
    });

    it("always exposes other allies and includes HP percentage for PCs", async () => {
      const allyPlayerId = "player-ally-regression";
      const allyCreatedAt = Date.now();
      db.prepare(`
        INSERT INTO players
          (id, campaign_id, player_name, character_name, hp_max, hp_current, ac, live_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(allyPlayerId, campaignId, "Ally Player", "Ser Rowan", 20, 20, 15, "{}", allyCreatedAt, allyCreatedAt);
      const ally = makeReserveEnemy({
        id: "combatant-ally-regression",
        baseType: "player",
        baseId: allyPlayerId,
        name: "Friendly Guard",
        label: "Ser Rowan",
        initiative: 11,
        friendly: true,
        hpCurrent: 20,
        hpMax: 20,
      });
      insertCombatant(db, ally);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const healthy = await request("GET", statusUrl, undefined, playerToken);
      const healthyCombat = (healthy.body as { combat: { allies: Array<Record<string, unknown>> } }).combat;
      assert.deepEqual(healthyCombat.allies, [{ id: ally.id, name: "Ser Rowan", health: "Healthy", hpPercent: 100 }]);
      assert.ok(!JSON.stringify(healthyCombat.allies).includes("hpCurrent"));
      assert.ok(!JSON.stringify(healthyCombat.allies).includes("hpMax"));

      db.prepare("UPDATE players SET hp_current = 15 WHERE id = ?").run(allyPlayerId);
      const damaged = await request("GET", statusUrl, undefined, playerToken);
      assert.deepEqual((damaged.body as { combat: { allies: Array<Record<string, unknown>> } }).combat.allies[0], {
        id: ally.id, name: "Ser Rowan", health: "Damaged", hpPercent: 75,
      });

      db.prepare("UPDATE players SET hp_current = 10 WHERE id = ?").run(allyPlayerId);
      const bloody = await request("GET", statusUrl, undefined, playerToken);
      assert.deepEqual((bloody.body as { combat: { allies: Array<Record<string, unknown>> } }).combat.allies[0], {
        id: ally.id, name: "Ser Rowan", health: "Bloody", hpPercent: 50,
      });

      db.prepare("UPDATE players SET hp_current = 0 WHERE id = ?").run(allyPlayerId);
      const down = await request("GET", statusUrl, undefined, playerToken);
      assert.deepEqual((down.body as { combat: { allies: Array<Record<string, unknown>> } }).combat.allies[0], {
        id: ally.id, name: "Ser Rowan", health: "Down", hpPercent: 0,
      });
    });

    it("engages a reserve the moment a player marks it (Hunter's Mark), before any damage lands", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-marked-regression",
        name: "Reserve Wolf",
        label: "Shadow Wolf",
        initiative: 6,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const before = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(before.body).includes(reserve.id));

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "marked", casterId: playerCombatantId }] },
      );
      const markedStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.equal(JSON.parse(markedStorage.live_json).engagedWithPlayers, true, "being marked must engage a reserve on its own, without damage");

      const marked = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(marked.body), /Shadow Wolf/, "a marked enemy must show up even at full health");
    });

    it("engages a reserve marked with any ordinary condition (e.g. Poisoned), not just Hunter's Mark", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-poisoned-regression",
        name: "Reserve Bandit",
        label: "Lurking Bandit",
        initiative: 7,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      const before = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(before.body).includes(reserve.id));

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "poisoned" }] },
      );
      const poisonedStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.equal(JSON.parse(poisonedStorage.live_json).engagedWithPlayers, true, "any ordinary condition must engage a reserve on its own, without damage");

      const poisoned = await request("GET", statusUrl, undefined, playerToken);
      assert.match(JSON.stringify(poisoned.body), /Lurking Bandit/, "a poisoned enemy must show up even at full health");
    });

    it("does not engage a reserve that is only invisible", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-invisible-regression",
        name: "Reserve Assassin",
        label: "Hidden Assassin",
        initiative: 8,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "invisible" }] },
      );
      const invisibleStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.notEqual(JSON.parse(invisibleStorage.live_json).engagedWithPlayers, true, "invisible alone must not engage a reserve");

      const afterInvisible = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(afterInvisible.body).includes(reserve.id), "an invisible-only enemy must stay hidden");
    });

    it("does not engage a reserve that is only concentrating", async () => {
      const reserve = makeReserveEnemy({
        id: "combatant-concentration-regression",
        name: "Reserve Cultist",
        label: "Chanting Cultist",
        initiative: 9,
      });
      insertCombatant(db, reserve);

      const statusUrl = `/api/me/characters/${playerCharacterId}/combat-status`;
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${reserve.id}`,
        { conditions: [{ key: "concentration" }] },
      );
      const concentrationStorage = db.prepare("SELECT live_json FROM combatants WHERE id = ?").get(reserve.id) as { live_json: string };
      assert.notEqual(JSON.parse(concentrationStorage.live_json).engagedWithPlayers, true, "concentration alone must not engage a reserve");

      const afterConcentration = await request("GET", statusUrl, undefined, playerToken);
      assert.ok(!JSON.stringify(afterConcentration.body).includes(reserve.id), "a concentration-only enemy must stay hidden");
    });
  });
