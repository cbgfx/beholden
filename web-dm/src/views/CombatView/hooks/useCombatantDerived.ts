import { Combatant, Player } from "@/domain/types/domain";
import {
  parseAC,
  parseHP,
  parseAbilityScore,
  abilityMod
} from "@/views/CombatView/utils/combatantParsing";

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;

export function useCombatantDerived(combatant: Combatant, player?: Player | null) {
  const overrides = combatant.overrides ?? null;
  const acBonus = Number(overrides?.acBonus ?? 0) || 0;
  const tempHp = Math.max(0, Number(overrides?.tempHp ?? 0) || 0);
  function normalizeHpMaxOverride(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }


  const acParsed = parseAC(combatant.ac);
  const acBase = acParsed.value;
  const ac = acBase != null ? Math.max(0, acBase + acBonus) : null;

  const hpParsed = parseHP(combatant.hpCurrent, combatant.hpMax);
  const hpCur = hpParsed.current;
  const hpMaxBase = hpParsed.max;
  const hpMod = normalizeHpMaxOverride(overrides?.hpMaxOverride) ?? 0;
  const hpMax = hpMaxBase != null ? Math.max(1, hpMaxBase + hpMod) : null;

  const abilities = ABILITIES.map((key) => {
    const score = parseAbilityScore(combatant[key as keyof Combatant]);
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
