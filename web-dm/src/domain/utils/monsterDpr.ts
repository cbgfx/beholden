import type { MonsterDetail } from "@/domain/types/compendium";
import { averageHpFromFormula } from "@beholden/shared/domain/monsters";

export type ProjectedThreatLabel = "Too Easy" | "Easy" | "Medium" | "Hard" | "Lethal" | "TPK";

type ActionRecord = Record<string, unknown>;

export type MonsterDprOptions = {
  armorClasses?: number[];
  partySize?: number;
};

/** Average of one typed damage entry: a single component or a reviewed array of components. */
function averageActionDamage(damage: unknown): number {
  const components = Array.isArray(damage) ? damage : damage ? [damage] : [];
  let total = 0;
  for (const raw of components) {
    if (!raw || typeof raw !== "object") continue;
    const roll = String((raw as ActionRecord).roll ?? "");
    const average = averageHpFromFormula(roll);
    if (average != null && average > 0) total += average;
  }
  return total;
}

function averageDiceDamage(damage: unknown): number {
  const components = Array.isArray(damage) ? damage : damage ? [damage] : [];
  let total = 0;
  for (const raw of components) {
    if (!raw || typeof raw !== "object") continue;
    const roll = String((raw as ActionRecord).roll ?? "");
    const diceOnly = Array.from(roll.matchAll(/(\d*)d(\d+)/giu)).reduce((sum, match) => {
      const count = Number(match[1] || 1);
      const sides = Number(match[2]);
      return sum + count * ((sides + 1) / 2);
    }, 0);
    total += diceOnly;
  }
  return total;
}

function getTargetPressure(action: ActionRecord, partySize: number): number {
  const cap = (value: number) => Math.min(Math.max(1, partySize), value);
  const area = String(action.area ?? "").toLowerCase();
  if (area === "line") return cap(1.15);
  if (area === "cone") return cap(1.25);
  if (area === "emanation") return cap(1.3);
  if (area === "sphere" || area === "cube") return cap(1.4);
  if (typeof action.targets === "number" && action.targets > 1) {
    return cap(1 + .15 * (Math.min(action.targets, partySize) - 1));
  }
  return 1;
}

function getControlPressure(action: ActionRecord): number {
  const description = String(action.description ?? action.text ?? "");
  return /\b(?:Paralyzed|Stunned|Unconscious|Incapacitated|Dominated) condition\b/iu.test(description) ? 1.1 : 1;
}

function rechargeChance(action: ActionRecord): number | null {
  if (!action.recharge || typeof action.recharge !== "object") return null;
  const recharge = action.recharge as ActionRecord;
  if (typeof recharge.roll === "number") return Math.max(1, Math.min(6, 7 - recharge.roll)) / 6;
  if (recharge.period === "turn") return 1;
  return 0;
}

function expectedAttackDamage(action: ActionRecord, average: number, diceAverage: number, armorClasses: number[]): number {
  const attack = action.attack && typeof action.attack === "object" ? action.attack as ActionRecord : null;
  if (!attack || typeof attack.toHit !== "number" || armorClasses.length === 0) return average;
  return armorClasses.reduce((sum, ac) => {
    const hitChance = Math.max(.05, Math.min(.95, (21 + Number(attack.toHit) - ac) / 20));
    return sum + hitChance * average + .05 * diceAverage;
  }, 0) / armorClasses.length;
}

function expectedSaveDamage(action: ActionRecord, average: number): number {
  const description = String(action.description ?? action.text ?? "");
  const match = description.match(/\b(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:\s*DC\s*(\d+)\b/iu);
  if (!match) return average;
  const dc = Number(match[1]);
  // Until saves become structured, use the agreed +0 party save. Saving throws do not
  // automatically fail on a natural 1 or succeed on a natural 20.
  const failureChance = Math.max(0, Math.min(1, (dc - 1) / 20));
  const successDamageRatio = /\bSuccess:\s*Half damage\b/iu.test(description) ? .5 : 0;
  return average * (failureChance + (1 - failureChance) * successDamageRatio);
}

/**
 * Estimates a monster's damage per round from its canonical facts only: typed damage
 * components (`action.damage`), typed Multiattack composition (`action.routine`), and typed
 * recharge/area/target pressure. Prose is never parsed and Challenge Rating is never used
 * as a stand-in — a monster without typed damage honestly has no estimate (`null`).
 */
export function estimateMonsterDpr(detail: MonsterDetail | null | undefined, options: MonsterDprOptions = {}): { dpr: number; burstFactor: number } | null {
  if (!detail) return null;
  const actions = (Array.isArray(detail.action) ? detail.action : []) as ActionRecord[];
  const detailRecord = detail as Record<string, unknown>;

  // Legendary monsters act outside their turn — bump sustained output by 25%.
  const legendaryRaw =
    detail.legendary
    ?? (detailRecord.legendaryActions as unknown[] | undefined)
    ?? (detailRecord.legendary_actions as unknown[] | undefined);
  const hasLegendaryActions = Array.isArray(legendaryRaw) && legendaryRaw.length > 0;

  const armorClasses = (options.armorClasses ?? []).filter((ac) => Number.isFinite(ac) && ac > 0);
  const partySize = Math.max(1, Math.round(options.partySize ?? (armorClasses.length || 4)));
  const damageById = new Map<string, { sustained: number; projected: number }>();
  const damageByName = new Map<string, { sustained: number; projected: number }>();
  let bestSingle = 0;
  let bestProjectedSingle = 0;
  const rechargeActions: Array<{ sustained: number; projected: number; chance: number }> = [];
  let routineAction: ActionRecord | null = null;

  for (const action of actions) {
    if (Array.isArray(action.routine) && action.routine.length > 0) {
      routineAction = action;
      continue;
    }
    const average = averageActionDamage(action.damage);
    if (average <= 0) continue;
    const attackExpected = expectedAttackDamage(action, average, averageDiceDamage(action.damage), armorClasses);
    const expected = action.attack && typeof action.attack === "object"
      ? attackExpected
      : expectedSaveDamage(action, attackExpected);
    const damage = { sustained: expected, projected: expected * getTargetPressure(action, partySize) * getControlPressure(action) };
    if (typeof action.id === "string" && action.id) damageById.set(action.id, damage);
    const name = String(action.name ?? "").trim().toLowerCase();
    if (name) damageByName.set(name, damage);
    const recharge = rechargeChance(action);
    if (recharge == null) {
      bestSingle = Math.max(bestSingle, expected);
      bestProjectedSingle = Math.max(bestProjectedSingle, damage.projected);
    } else {
      rechargeActions.push({ ...damage, chance: recharge });
    }
  }

  // Multiattack: sum the typed routine — `use` repeats one referenced action, `choose`
  // takes the strongest of the referenced options (conservative threat estimate).
  if (routineAction) {
    const resolve = (id: unknown): { sustained: number; projected: number } =>
      damageById.get(String(id ?? "")) ?? damageByName.get(String(id ?? "").toLowerCase()) ?? { sustained: 0, projected: 0 };
    let routineTotal = 0;
    let routineProjected = 0;
    for (const rawStep of routineAction.routine as unknown[]) {
      if (!rawStep || typeof rawStep !== "object") continue;
      const step = rawStep as ActionRecord;
      const count = typeof step.count === "number" && step.count > 0 ? step.count : 1;
      const perUse = typeof step.use === "string"
        ? resolve(step.use)
        : Array.isArray(step.choose)
          ? step.choose.map(resolve).reduce((best, candidate) => candidate.projected > best.projected ? candidate : best, { sustained: 0, projected: 0 })
          : { sustained: 0, projected: 0 };
      routineTotal += perUse.sustained * count;
      routineProjected += perUse.projected * count;
    }
    bestSingle = Math.max(bestSingle, routineTotal);
    bestProjectedSingle = Math.max(bestProjectedSingle, routineProjected);
  }

  const legendaryDpr = hasLegendaryActions ? (Array.isArray(detail.legendary) ? detail.legendary : []).reduce((best, raw) => {
    const action = raw as ActionRecord;
    const average = averageActionDamage(action.damage);
    if (average <= 0) return best;
    const expected = expectedAttackDamage(action, average, averageDiceDamage(action.damage), armorClasses);
    return Math.max(best, expected * getTargetPressure(action, partySize) * getControlPressure(action));
  }, 0) : 0;

  if (bestSingle > 0) {
    const baseline = Math.max(bestSingle, bestProjectedSingle);
    const rechargeProjection = rechargeActions.reduce((best, action) => {
      // Recharge actions begin available. Over a three-round danger window, later rounds
      // use the action on a successful recharge and the normal routine otherwise.
      const threeRoundAverage = (action.projected + 2 * (action.chance * action.projected + (1 - action.chance) * baseline)) / 3;
      return Math.max(best, threeRoundAverage);
    }, baseline);
    const dpr = bestSingle + legendaryDpr;
    const projectedDpr = rechargeProjection + legendaryDpr;
    return { dpr, burstFactor: projectedDpr / dpr };
  }
  if (rechargeActions.length > 0) {
    const action = rechargeActions.reduce((best, candidate) => candidate.projected > best.projected ? candidate : best);
    const projectedDpr = action.projected * ((1 + 2 * action.chance) / 3) + legendaryDpr;
    return { dpr: projectedDpr, burstFactor: 1 };
  }
  return null;
}

export function estimateMonsterEffectiveHp(detail: MonsterDetail | null | undefined): number {
  if (!detail) return 0;
  const rawHp = detail.hp;
  const hp = typeof rawHp === "number"
    ? rawHp
    : Number(String(rawHp ?? "").match(/^\s*(\d+)/u)?.[1] ?? 0);
  if (!Number.isFinite(hp) || hp <= 0) return 0;
  const record = detail as Record<string, unknown>;
  const count = (value: unknown) => String(value ?? "").split(",").map((part) => part.trim()).filter(Boolean).length;
  // Unknown party damage types make exact mitigation impossible. Keep the adjustment small
  // and capped so generic defenses never manufacture a severe rating.
  const resistanceFactor = Math.min(.25, count(record.resist) * .05);
  const immunityFactor = Math.min(.25, count(record.immune) * .08);
  const vulnerabilityFactor = Math.min(.15, count(record.vulnerable) * .05);
  return hp * Math.max(.75, 1 + resistanceFactor + immunityFactor - vulnerabilityFactor);
}

const PARTY_DPR_BY_LEVEL = [0, 7, 9, 11, 13, 20, 22, 24, 26, 28, 30, 34, 36, 38, 40, 42, 44, 50, 52, 54, 56];

export function estimatePartyDpr(levels: number[]): number {
  return levels.reduce((sum, level) => sum + PARTY_DPR_BY_LEVEL[Math.min(20, Math.max(1, Math.round(level)))], 0);
}

export function labelForRoundsToTpk(rtk: number): ProjectedThreatLabel {
  if (!Number.isFinite(rtk)) return "Too Easy";
  if (rtk <= .75) return "TPK";
  if (rtk <= 1.5) return "Lethal";
  if (rtk <= 3) return "Hard";
  if (rtk <= 5) return "Medium";
  if (rtk <= 8) return "Easy";
  return "Too Easy";
}
