import type { CSSProperties } from "react";
import type {
  BastionFacilityUpgrade,
  BastionSpaceDefinition,
  SpecialFacilitySlotStep,
} from "@beholden/shared/domain/bastionFacilities";
import { C } from "@/lib/theme";

export type CompendiumFacility = {
  id: string;
  name: string;
  key: string;
  type: "basic" | "special";
  minimumLevel: number;
  prerequisite: string | null;
  orders: string[];
  space: string | null;
  hirelings: number | null;
  allowMultiple: boolean;
  description: string | null;
  /** Sizes a basic facility may have. */
  spaces?: string[] | null;
  /** A special facility's enlargement. */
  upgrade?: BastionFacilityUpgrade | null;
};

export type BastionFacility = {
  id: string;
  facilityKey: string;
  source: "player" | "dm_extra";
  ownerPlayerId: string | null;
  order: string | null;
  notes: string;
  /** Current size key: cramped, roomy or vast. */
  size: string | null;
  /** Hirelings at the current size, upgrade included. */
  hirelings?: number;
  definition: CompendiumFacility | null;
};

export type Bastion = {
  id: string;
  campaignId: string;
  name: string;
  active: boolean;
  defendersArmed: number;
  defendersUnarmed: number;
  assignedPlayerIds: string[];
  assignedPlayers?: Array<{ id: string; userId: string | null; level: number; characterId: string | null; characterName: string }>;
  notes: string;
  maintainOrder: boolean;
  facilities: BastionFacility[];
  level: number;
  specialSlots: number;
  specialSlotsUsed: number;
  hirelingsTotal?: number;
  /** Server version of the row, used to ignore a refresh older than what's already shown. */
  updatedAt?: number;
};

export type BastionResponse = {
  ok: boolean;
  role: "dm" | "player";
  currentUserPlayerIds: string[];
  bastion: Bastion;
};

export type BastionCompendiumResponse = {
  ok: boolean;
  facilities: CompendiumFacility[];
  /** Sizes with their compendium names and costs. */
  spaces?: BastionSpaceDefinition[];
  /** Special facility slots by level, from the compendium's rules entry. */
  specialFacilitySlots?: SpecialFacilitySlotStep[];
};

export function normalizeOrder(value: string | null | undefined): string | null {
  const next = String(value ?? "").trim();
  return next.length > 0 ? next : null;
}

export function orderListWithMaintain(orders: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const order of [...orders, "Maintain"]) {
    const key = order.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(order);
  }
  return out;
}

export function sortFacilitiesByLevelThenName(facilities: CompendiumFacility[]): CompendiumFacility[] {
  return [...facilities].sort((a, b) => {
    const levelDelta = (a.minimumLevel ?? 0) - (b.minimumLevel ?? 0);
    if (levelDelta !== 0) return levelDelta;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function ghostButtonStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 11px",
    borderRadius: 8,
    border: `1px solid rgba(251,191,36,0.35)`,
    background: "rgba(251,191,36,0.10)",
    color: C.colorGold,
    cursor: "pointer",
    fontSize: "var(--fs-small)",
    fontWeight: 700,
  };
}

export function accentButtonStyle(enabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 14px",
    borderRadius: 8,
    border: "none",
    background: enabled ? C.colorGold : "rgba(255,255,255,0.08)",
    color: enabled ? C.textDark : C.muted,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    transition: "background 120ms ease",
  };
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: `1px solid ${C.panelBorder}`,
  background: "rgba(0,0,0,0.30)",
  color: C.text,
  fontSize: "var(--fs-small)",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
