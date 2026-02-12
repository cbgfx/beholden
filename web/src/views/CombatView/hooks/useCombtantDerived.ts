import { Combatant, Player } from "../../../app/types/domain";
import {
  parseAC,
  parseHP,
  parseAbilityScore,
  abilityMod
} from "../utils/combatantParsing";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

export function useCombatantDerived(combatant: Combatant, player?: Player | null) {
  const overrides: any = (combatant as any).overrides ?? null;
  const acBonus = Number(overrides?.acBonus ?? 0) || 0;
  const tempHp = Math.max(0, Number(overrides?.tempHp ?? 0) || 0);
function normalizeHpMaxOverride(v: any): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}


  const acParsed = parseAC(combatant.ac);
  const acBase = acParsed.value;
  const ac = acBase != null ? Math.max(0, acBase + acBonus) : null;

  const hpParsed = parseHP(combatant.hpCurrent, combatant.hpMax);
  const hpCur = hpParsed.current;
  const hpMaxBase = hpParsed.max;
  const hpMaxOverride = normalizeHpMaxOverride(overrides?.hpMaxOverride);
  const hpMax = hpMaxOverride ?? hpMaxBase;

  const abilities = ABILITIES.map((key) => {
    const score = parseAbilityScore((combatant as any)[key]);
    return {
      key,
      score,
      mod: score !== null ? abilityMod(score) : null
    };
  });

  return {
    vitals: {
      ac,
      acDetails: acParsed.details,
      acBonus: acBonus || 0,
      hpCurrent: hpCur,
      hpMax: hpMax != null ? Number(hpMax) : null,
      hpDetails: hpParsed.details,
      tempHp
    },
    abilities,
    spells: [],
    traits: []
  };
}
