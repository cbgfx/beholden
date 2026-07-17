import type { MonsterDetail } from "@/domain/types/compendium";
import { averageHpFromFormula } from "@beholden/shared/domain/monsters";

type DifficultyLabel = "Too Easy" | "Easy" | "Medium" | "Hard" | "Deadly" | "TPK";

type ActionRecord = Record<string, unknown>;

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

function getBurstFactor(action: ActionRecord): number {
  if (action.recharge && typeof action.recharge === "object") return 1.35;
  if (typeof action.area === "string" || (typeof action.targets === "number" && action.targets > 1)) return 1.2;
  return 1.0;
}

/**
 * Estimates a monster's damage per round from its canonical facts only: typed damage
 * components (`action.damage`), typed Multiattack composition (`action.routine`), and typed
 * recharge/area/target pressure. Prose is never parsed and Challenge Rating is never used
 * as a stand-in — a monster without typed damage honestly has no estimate (`null`).
 */
export function estimateMonsterDpr(detail: MonsterDetail | null | undefined): { dpr: number; burstFactor: number } | null {
  if (!detail) return null;
  const actions = (Array.isArray(detail.action) ? detail.action : []) as ActionRecord[];
  const detailRecord = detail as Record<string, unknown>;

  // Legendary monsters act outside their turn — bump sustained output by 25%.
  const legendaryRaw =
    detail.legendary
    ?? (detailRecord.legendaryActions as unknown[] | undefined)
    ?? (detailRecord.legendary_actions as unknown[] | undefined);
  const hasLegendaryActions = Array.isArray(legendaryRaw) && legendaryRaw.length > 0;
  const legendaryFactor = hasLegendaryActions ? 1.25 : 1;

  const averageById = new Map<string, number>();
  const averageByName = new Map<string, number>();
  let bestSingle = 0;
  let burstFactor = 1.0;
  let routineAction: ActionRecord | null = null;

  for (const action of actions) {
    burstFactor = Math.max(burstFactor, getBurstFactor(action));
    if (Array.isArray(action.routine) && action.routine.length > 0) {
      routineAction = action;
      continue;
    }
    const average = averageActionDamage(action.damage);
    if (average <= 0) continue;
    if (typeof action.id === "string" && action.id) averageById.set(action.id, average);
    const name = String(action.name ?? "").trim().toLowerCase();
    if (name) averageByName.set(name, average);
    bestSingle = Math.max(bestSingle, average);
  }

  // Multiattack: sum the typed routine — `use` repeats one referenced action, `choose`
  // takes the strongest of the referenced options (conservative threat estimate).
  if (routineAction) {
    const resolve = (id: unknown): number =>
      averageById.get(String(id ?? "")) ?? averageByName.get(String(id ?? "").toLowerCase()) ?? 0;
    let routineTotal = 0;
    for (const rawStep of routineAction.routine as unknown[]) {
      if (!rawStep || typeof rawStep !== "object") continue;
      const step = rawStep as ActionRecord;
      const count = typeof step.count === "number" && step.count > 0 ? step.count : 1;
      const perUse = typeof step.use === "string"
        ? resolve(step.use)
        : Array.isArray(step.choose)
          ? Math.max(0, ...step.choose.map(resolve))
          : 0;
      routineTotal += perUse * count;
    }
    if (routineTotal > 0) return { dpr: routineTotal * legendaryFactor, burstFactor };
  }

  if (bestSingle > 0) return { dpr: bestSingle * legendaryFactor, burstFactor };
  return null;
}

export function labelForRoundsToTpk(rtk: number): DifficultyLabel {
  if (!Number.isFinite(rtk)) return "Too Easy";
  if (rtk <= 1.0) return "TPK";
  if (rtk <= 2.0) return "Deadly";
  if (rtk <= 3.5) return "Hard";
  if (rtk <= 6.0) return "Medium";
  if (rtk <= 10.0) return "Easy";
  return "Too Easy";
}
