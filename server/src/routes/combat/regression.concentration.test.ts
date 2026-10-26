import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encounterId, monsterCombatantId, monster2CombatantId, playerCombatantId, playerCharacterId, playerToken, request, dmRequest, liveOf } from './regression.fixtures.js';

describe("condition write conflicts", () => {
    it("atomically restores pre-polymorph HP and overrides when a generic condition edit removes the form", async () => {
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, {
        hpCurrent: 7,
        overrides: { tempHp: 0, acBonus: 5, hpMaxBonus: 20, inspiration: false },
        conditions: [{ key: "polymorphed", originalHpCurrent: 13, originalAcBonus: 1, originalHpMaxBonus: 2 }],
      });
      const { body } = await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, {
        conditions: [],
      });
      const live = body.live as { hpCurrent: number; overrides: { acBonus: number; hpMaxBonus: number }; conditions: unknown[] };
      assert.equal(live.hpCurrent, 13);
      assert.equal(live.overrides.acBonus, 1);
      assert.equal(live.overrides.hpMaxBonus, 2);
      assert.deepEqual(live.conditions, []);
    });

    it("rejects a stale DM condition list instead of overwriting a newer edit", async () => {
      const { body: beforeBody } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      const before = liveOf(beforeBody).conditions ?? [];
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, {
        conditions: [{ key: "poisoned" }], previousConditions: before,
      });
      const stale = await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`, {
        conditions: [{ key: "prone" }], previousConditions: before,
      });
      assert.equal(stale.status, 409);
      assert.equal((stale.body as { code?: string }).code, "conditions-conflict");
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`);
      assert.deepEqual(liveOf(body).conditions, [{ key: "poisoned" }]);
    });

    it("rejects a stale player condition list instead of overwriting a DM edit", async () => {
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, {
        conditions: [{ key: "poisoned" }],
      });
      const stale = await request(
        "PATCH", `/api/me/characters/${playerCharacterId}/conditions`,
        { conditions: [{ key: "prone" }], previousConditions: [] }, playerToken,
      );
      assert.equal(stale.status, 409);
      assert.equal((stale.body as { code?: string }).code, "conditions-conflict");
    });
  });


  describe("concentration ownership — sweeping dependent conditions when a caster loses concentration", () => {
    it("stamps player-started concentration with a stable session id", async () => {
      const { status, body } = await request(
        "PATCH", `/api/me/characters/${playerCharacterId}/conditions`,
        { conditions: [{ key: "concentration" }] }, playerToken,
      );
      assert.equal(status, 200);
      const concentrationId = (body as { conditions?: Array<{ key: string; concentrationId?: string }> }).conditions
        ?.find((condition) => condition.key === "concentration")?.concentrationId;
      assert.ok(concentrationId);

      const { body: combatantBody } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`);
      assert.equal(liveOf(combatantBody).conditions?.find((condition) => condition.key === "concentration")?.concentrationId, concentrationId);
      await request("PATCH", `/api/me/characters/${playerCharacterId}/conditions`, { conditions: [] }, playerToken);
    });

    it("removes a dependent condition owned by the caster, but not one owned by a different caster, on DM-driven HP loss", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;
      assert.ok(concentrationId, "applyCombatantTransition should auto-stamp a concentrationId");

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        {
          conditions: [
            { key: "hexed", casterId: playerCombatantId, concentrationId, hexAbility: "wis" },
            { key: "marked", casterId: monsterCombatantId },
            { key: "poisoned" },
          ],
        },
      );

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { hpCurrent: 0 });

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "hexed"), "the caster's own dependent should be removed");
      assert.ok(conditions.some((c) => c.key === "marked"), "a different caster's dependent must survive");
      assert.ok(conditions.some((c) => c.key === "poisoned"), "a condition with no casterId at all must never be touched");
    });

    it("also sweeps dependent conditions when concentration ends via the player-originated conditions PATCH", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "hexed", casterId: playerCombatantId, concentrationId, hexAbility: "wis" }] },
      );

      const { status } = await request(
        "PATCH", `/api/me/characters/${playerCharacterId}/conditions`, { conditions: [] }, playerToken,
      );
      assert.equal(status, 200);

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "hexed"), "player-ended concentration should sweep its dependent too");
    });

    it("sweeps Hex when the concentrating character is reduced to 0 through the character sheet", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;
      assert.ok(concentrationId);

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "hexed", casterId: playerCombatantId, concentrationId, hexAbility: "wis" }] },
      );

      const { status } = await request(
        "PUT", `/api/me/characters/${playerCharacterId}`, { hpCurrent: 0 }, playerToken,
      );
      assert.equal(status, 200);

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      assert.ok(!(liveOf(body).conditions ?? []).some((condition) => condition.key === "hexed"));
    });

    it("sweeps dependent conditions when the caster's own concentration expires via round progression", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "concentration", expiresAtRound: 3 }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "marked", casterId: monsterCombatantId, concentrationId }] },
      );

      await dmRequest("PUT", `/api/encounters/${encounterId}/combatState`, { round: 3 });

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(!conditions.some((c) => c.key === "marked"), "expiring the caster's concentration should sweep its dependent");
    });

    it("sweeps dependent conditions when the concentrating combatant is removed", async () => {
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`,
        { conditions: [{ key: "concentration" }] },
      );
      const concentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;
      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "marked", casterId: monsterCombatantId, concentrationId }] },
      );

      assert.equal((await dmRequest("DELETE", `/api/encounters/${encounterId}/combatants/${monsterCombatantId}`)).status, 200);
      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      assert.ok(!(liveOf(body).conditions ?? []).some((condition) => condition.key === "marked"));
    });

    it("preserves a same-caster dependent tagged to a DIFFERENT concentrationId than the one ending", async () => {
      // A dependent stamped with some other session's id (e.g. never cleaned up when an earlier,
      // untracked session ended) must not be swept just because the caster happens to be
      // concentrating again right now and that session, too, eventually ends.
      const { body: casterBody } = await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`,
        { hpCurrent: 20, conditions: [{ key: "concentration" }] },
      );
      const currentConcentrationId = liveOf(casterBody).conditions?.find((c) => c.key === "concentration")?.concentrationId ?? null;
      assert.ok(currentConcentrationId, "applyCombatantTransition should auto-stamp a concentrationId");

      await dmRequest(
        "PUT", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`,
        { conditions: [{ key: "hexed", casterId: playerCombatantId, concentrationId: "stale-untracked-session", hexAbility: "wis" }] },
      );

      // End the CURRENT session — its id doesn't match the stale dependent's, so it must survive.
      await dmRequest("PUT", `/api/encounters/${encounterId}/combatants/${playerCombatantId}`, { hpCurrent: 0 });

      const { body } = await dmRequest("GET", `/api/encounters/${encounterId}/combatants/${monster2CombatantId}`);
      const conditions = liveOf(body).conditions ?? [];
      assert.ok(
        conditions.some((c) => c.key === "hexed" && c.concentrationId === "stale-untracked-session"),
        "a dependent tagged to a different concentrationId must survive an unrelated session ending",
      );
    });
  });
