import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spellStateRevOf } from "../characters/helpers.js";
import { db, broadcasts, encounterId, monsterCombatantId, playerCombatantId, playerRowId, playerCharacterId, playerToken, request, dmRequest, liveOf } from './regression.fixtures.js';

it("list and detail reads return the same merged player and monster state", async () => {
    const list = await dmRequest("GET", `/api/encounters/${encounterId}/combatants`);
    assert.equal(list.status, 200);
    const actors = list.body as unknown as Array<{ id: string }>;
    assert.ok(actors.length >= 2);
    for (const actor of actors) {
      const detail = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${actor.id}`);
      assert.equal(detail.status, 200);
      assert.deepEqual(detail.body, actor);
    }
  });


  describe("cross-ruleset monster additions", () => {
    it("adds the sole available 5.5e monster to a 5e campaign when an older client omits ruleset", async () => {
      const { status, body } = await dmRequest(
        "POST",
        `/api/encounters/${encounterId}/combatants/addMonster`,
        { monsterId: "m_red_slaad", qty: 1 },
      );

      assert.equal(status, 200);
      const created = body.created as Array<Record<string, unknown>>;
      assert.equal(created.length, 1);
      assert.equal(created[0]?.baseId, "m_red_slaad");
      assert.equal(created[0]?.baseRuleset, "5.5e");
      assert.equal(created[0]?.hpMax, 93);
      assert.equal(created[0]?.ac, 14);
    });
  });


  describe("character-data persistence", () => {
    it("preserves player notes during a rest-style partial characterData update", async () => {
      const notes = [{ id: "note-1", title: "Campaign clue", text: "Do not lose this." }];
      db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = ?")
        .run(JSON.stringify({ age: 20, gender: "male", playerNotesList: notes, concentrationSpell: "Hex" }), playerCharacterId);

      const { status } = await request(
        "PUT",
        `/api/me/characters/${playerCharacterId}`,
        { characterData: { resources: [], concentrationSpell: null }, expectedSpellStateRev: spellStateRevOf({ age: 20, gender: "male", playerNotesList: notes, concentrationSpell: "Hex" }) },
        playerToken,
      );
      assert.equal(status, 200);

      const row = db.prepare("SELECT character_data_json FROM user_characters WHERE id = ?")
        .get(playerCharacterId) as { character_data_json: string };
      const stored = JSON.parse(row.character_data_json) as Record<string, unknown>;
      assert.deepEqual(stored.playerNotesList, notes);
      assert.equal(stored.concentrationSpell, null);
    });
  });


  describe("behaviors 1 & 2 — HP/condition mutation returns and broadcasts updated state", () => {
    it("returns and broadcasts the updated HP", async () => {
      broadcasts.length = 0;
      const { status, body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 4 },
      );
      assert.equal(status, 200);
      assert.equal(liveOf(body).hpCurrent, 4);
      const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
      assert.ok(delta, "expected an encounter:combatantsDelta broadcast");
      assert.equal(liveOf(delta!.payload.combatant as Record<string, unknown>).hpCurrent, 4);
    });

    it("returns and broadcasts updated conditions", async () => {
      broadcasts.length = 0;
      const { status, body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 5, conditions: [{ key: "prone" }] },
      );
      assert.equal(status, 200);
      assert.deepEqual(liveOf(body).conditions, [{ key: "prone" }]);
      const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
      assert.deepEqual(liveOf(delta!.payload.combatant as Record<string, unknown>).conditions, [{ key: "prone" }]);
    });
  });


  describe("behaviors 3-6 — transition rules wired into the real route (not just the pure function)", () => {
    it("reaching 0 HP removes Concentration", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 5, conditions: [{ key: "concentration" }] },
      );
      const { body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 0 },
      );
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "concentration"));
    });

    for (const key of ["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]) {
      it(`applying ${key} removes Concentration`, async () => {
        await dmRequest(
          "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
          { hpCurrent: 5, conditions: [{ key: "concentration" }] },
        );
        const { body } = await dmRequest(
          "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
          { conditions: [{ key: "concentration" }, { key }] },
        );
        const conditions = liveOf(body).conditions ?? [];
        assert.ok(!conditions.some((c) => c.key === "concentration"), `${key} should remove concentration`);
      });
    }

    it("applying Unconscious also applies Prone", async () => {
      const { body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 5, conditions: [{ key: "unconscious" }] },
      );
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(conditions.some((c) => c.key === "unconscious"));
      assert.ok(conditions.some((c) => c.key === "prone"));
    });

    it("healing above 0 removes Unconscious but preserves Prone", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { hpCurrent: 0, conditions: [{ key: "unconscious" }, { key: "prone" }] },
      );
      const { body } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 5 },
      );
      assert.deepEqual(liveOf(body).conditions, [{ key: "prone" }]);
    });
  });


  describe("player-type combatant sync", () => {
    it("PUT on a player combatant writes HP to the player's one home, which every read sees", async () => {
      const { status } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { hpCurrent: 12 },
      );
      assert.equal(status, 200);
      // A linked player's live state lives on its character sheet; the player read goes through it.
      const player = db.prepare("SELECT hp_current FROM player_rows WHERE id = ?").get(playerRowId) as { hp_current: number };
      assert.equal(player.hp_current, 12);
      const sheet = db.prepare("SELECT hp_current FROM user_characters WHERE id = ?").get(playerCharacterId) as { hp_current: number };
      assert.equal(sheet.hp_current, 12);
    });
  });


  describe("behavior 11 — broadcast sufficiency for an already-open DM combat view", () => {
    it("DM-originated PUT broadcasts a full combatant DTO inline (no follow-up fetch needed)", async () => {
      broadcasts.length = 0;
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, { hpCurrent: 3 },
      );
      const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
      assert.ok(delta, "expected an encounter:combatantsDelta broadcast");
      assert.ok(delta!.payload.combatant, "DM path should inline the full combatant DTO");
    });

    it(
      "player-originated condition PATCH also broadcasts a full combatant DTO inline, matching the DM path",
      async () => {
        broadcasts.length = 0;
        const { status } = await request(
          "PATCH", `/api/me/characters/${playerCharacterId}/conditions`,
          { conditions: [{ key: "prone" }] }, playerToken,
        );
        assert.equal(status, 200);
        const delta = broadcasts.find((b) => b.type === "encounter:combatantsDelta");
        assert.ok(delta, "expected an encounter:combatantsDelta broadcast for the linked combatant");
        assert.ok(delta!.payload.combatant, "player-originated broadcast should inline the full combatant DTO");
        assert.deepEqual(liveOf(delta!.payload.combatant as Record<string, unknown>).conditions, [{ key: "prone" }]);
      },
    );
  });


  // As of this writing, expiry is wired into the PUT /combatState route (server/src/routes/combat.ts,
  // via combatTransitions.ts's expireConditionsAtRound) — landed concurrently with this test file, so
  // this locks the real behavior in rather than documenting a gap.
  describe("behavior 10 — timed condition expiry on round progression", () => {
    it("keeps a condition whose expiresAtRound hasn't been reached yet", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "prone", expiresAtRound: 3 }] },
      );
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { round: 2 });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(conditions.some((c) => c.key === "prone"), "condition should still be active before its expiry round");
    });

    it("removes a condition once the persisted round reaches its expiresAtRound", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "prone", expiresAtRound: 3 }] },
      );
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { round: 3 });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "prone"), "expired condition should have been removed");
    });
  });


  describe("behavior 9 — server-authoritative reaction reset when a combatant's turn starts", () => {
    it("resets usedReaction to false for the incoming active combatant", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [], usedReaction: true },
      );
      // Make sure the "active combatant" is genuinely changing (a same-id PUT is a no-op).
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: playerCombatantId });
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: monsterCombatantId });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      assert.equal(liveOf(body).usedReaction, false);
    });

    it("does not free the reaction of an incapacitated combatant even when their turn starts", async () => {
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "stunned" }], usedReaction: true },
      );
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: playerCombatantId });
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { activeCombatantId: monsterCombatantId });
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      assert.equal(liveOf(body).usedReaction, true, "an incapacitated combatant can't take reactions regardless of whose turn it is");
    });
  });
