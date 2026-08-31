import type { SheetOverrides } from "./CharacterViewTypes";

export function getLongRestRecovery(hitDiceMax: number, exhaustion: number): {
  hitDiceCurrent: number;
  exhaustion: number;
} {
  return {
    hitDiceCurrent: Math.max(0, Math.floor(hitDiceMax)),
    exhaustion: Math.max(0, Math.floor(exhaustion) - 1),
  };
}

export function getLongRestOverrides(
  inspiration: boolean,
  grantsInspiration: boolean,
  current: SheetOverrides = { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
): SheetOverrides {
  const permanent = current.permanent ?? {};
  return {
    tempHp: 0,
    acBonus: permanent.acBonus ? current.acBonus : 0,
    hpMaxBonus: permanent.hpMaxBonus ? current.hpMaxBonus : 0,
    inspiration: inspiration || grantsInspiration,
    abilityScores: permanent.abilityScores ? { ...(current.abilityScores ?? {}) } : {},
    ...(Object.values(permanent).some(Boolean) ? { permanent } : {}),
  };
}
