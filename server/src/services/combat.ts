import { now, uid } from "../lib/runtime.js";

export function ensureCombat(userData, encounterId) {
  if (!userData.combats[encounterId]) {
    userData.combats[encounterId] = {
      encounterId,
      round: 1,
      activeIndex: 0,
      activeCombatantId: null,
      createdAt: now(),
      updatedAt: now(),
      combatants: [] as any[],
    };
  }
  return userData.combats[encounterId];
}

export function nextLabelNumber(userData, encounterId, baseName) {
  const combat = ensureCombat(userData, encounterId);
  const rx = new RegExp(
    "^" + baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+(\\d+)$",
    "i"
  );
  let maxN = 0;
  for (const c of combat.combatants) {
    const m = String(c.label ?? "").match(rx);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) maxN = Math.max(maxN, n);
    }
  }
  return maxN + 1;
}

export function createPlayerCombatant({ encounterId, player, t = now() }) {
  return {
    id: uid(),
    encounterId,
    baseType: "player",
    baseId: player.id,
    name: player.characterName,
    label: player.characterName,
    initiative: null,
    friendly: true,
    color: "green",
    overrides: { tempHp: 0, acBonus: 0, hpMaxOverride: null },
    hpCurrent: player.hpCurrent,
    hpMax: player.hpMax,
    hpDetail: null,
    ac: player.ac,
    acDetail: null,
    conditions: [],
    createdAt: t,
    updatedAt: t,
  };
}
