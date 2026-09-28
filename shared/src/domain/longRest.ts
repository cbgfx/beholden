// shared/src/domain/longRest.ts
// What a rest restores on a character sheet. Shared so the player's own Long Rest button and the
// DM's party-wide Full Rest apply the same rules to the same stored data.

import { rollDiceExpr } from "./dice";

/** Whether a resource with this reset code ("S", "L", "SL") comes back on this kind of rest. */
export function shouldResetOnRest(resetCode: string | undefined, restType: "short" | "long"): boolean {
  const code = String(resetCode ?? "").trim().toUpperCase();
  if (restType === "short") return code === "S" || code === "SL";
  return code === "S" || code === "L" || code === "SL";
}

// MARK: - Item charges

type UseAmount = number | string;
/** An item's charges: a fixed or rolled maximum, and how many come back at dawn (false: none). */
export type RestItemUses = UseAmount | { max: UseAmount; recover?: false | UseAmount };
type Roll = (formula: string) => number;

function resolveUseAmount(amount: UseAmount, roll: Roll): number {
  return typeof amount === "number" ? amount : roll(amount);
}

/** An item's charge maximum, rolling it when the item gives a formula ("1d6+1"). */
export function initializeItemUsesMaximum(uses: RestItemUses | null | undefined, roll: Roll = rollDiceExpr): number | null {
  if (uses == null) return null;
  const maximum = typeof uses === "object" ? uses.max : uses;
  const resolved = resolveUseAmount(maximum, roll);
  return Number.isInteger(resolved) && resolved > 0 ? resolved : null;
}

/**
 * Charges an item has after a long rest. Items with no recovery rule refill; items with one regain
 * that many (rolled when it is a formula), never past the maximum; `recover: false` regains none.
 */
export function recoverItemCharges<T extends { uses?: RestItemUses | null; charges?: number | null; chargesMax?: number | null }>(
  item: T,
  roll: Roll = rollDiceExpr,
): T {
  const maximum = item.chargesMax ?? initializeItemUsesMaximum(item.uses, roll);
  if (!maximum) return item;
  const recovery = item.uses && typeof item.uses === "object" ? item.uses.recover : undefined;
  if (recovery === false) return item;
  const charges = recovery === undefined
    ? maximum
    : Math.min(maximum, Math.max(0, item.charges ?? maximum) + resolveUseAmount(recovery, roll));
  return { ...item, chargesMax: maximum, charges };
}

// MARK: - The sheet

/**
 * The stored character data after a long rest: class resources that reset on a short or long rest
 * refill, spell slots come back, every hit die returns (nothing spent - shared/domain/hitDice), one
 * level of exhaustion goes, concentration ends, and item charges recover.
 *
 * The player's button works from the resources and hit dice the sheet has resolved against the
 * compendium; the server has only what is stored, which carries each resource's own max and reset.
 */
export function characterDataAfterLongRest(
  data: Record<string, unknown> | null | undefined,
  roll: Roll = rollDiceExpr,
): Record<string, unknown> {
  const current = data ?? {};
  const resources = Array.isArray(current.resources)
    ? (current.resources as Array<Record<string, unknown>>).map((resource) =>
        resource && typeof resource === "object" && shouldResetOnRest(String(resource.reset ?? ""), "long")
          && Number.isFinite(Number(resource.max))
          ? { ...resource, current: Number(resource.max) }
          : resource)
    : current.resources;
  const inventory = Array.isArray(current.inventory)
    ? (current.inventory as Array<Record<string, unknown>>).map((item) =>
        item && typeof item === "object" ? recoverItemCharges(item as Parameters<typeof recoverItemCharges>[0], roll) : item)
    : current.inventory;
  const exhaustion = Math.max(0, Math.floor(Number(current.exhaustion ?? 0) || 0) - 1);
  const rested: Record<string, unknown> = {
    ...current,
    ...(resources !== undefined ? { resources } : {}),
    ...(inventory !== undefined ? { inventory } : {}),
    usedSpellSlots: {},
    exhaustion,
    concentrationSpell: null,
  };
  delete rested.hitDiceSpent;
  delete rested.hitDiceCurrent;
  delete rested.hitDiceCurrentBySize;
  return rested;
}
