/**
 * Bastion facility sizes, upgrades and special facility slots.
 *
 * Shared by the server (to validate a size change) and both clients (the DM's upgrade pill and the
 * player's read-only size). Every number comes from the compendium JSON; this module only interprets
 * it. Gold and build time are handled at the table, so nothing here spends or waits.
 */

/** A size's compendium key: `cramped`, `roomy` or `vast`. */
export type BastionSpaceKey = string;

/** A compendium `space` entry, as the app uses it. */
export type BastionSpaceDefinition = {
  key: BastionSpaceKey;
  name: string;
  sort: number;
  /** What adding a basic facility of this size costs, per the compendium. Shown only. */
  basicAdd?: { costGp: number; days?: number | null } | null;
  /** What upgrading a basic facility from this size to the next costs, per the compendium. */
  basicUpgrade?: { to: BastionSpaceKey; costGp: number; days?: number | null } | null;
};

/** A special facility's enlargement, per the compendium. */
export type BastionFacilityUpgrade = {
  to: BastionSpaceKey;
  costGp: number;
  /** Extra hirelings once upgraded (Garden +1, Pub +3, Workshop +2). */
  hirelingsDelta?: number;
  /** One line describing what the upgrade gives, shown once it's taken. */
  summary?: string;
};

/** The parts of a compendium facility that decide its size. */
export type SizedFacilityDefinition = {
  type: "basic" | "special";
  space: string | null;
  hirelings: number | null;
  /** Sizes a basic facility may have. */
  spaces?: BastionSpaceKey[] | null;
  upgrade?: BastionFacilityUpgrade | null;
};

/** One step of the special facility slot progression: from `level` on, `count` slots. */
export type SpecialFacilitySlotStep = { level: number; count: number };

/**
 * The book's slot progression, used only when the compendium has no rules entry yet, i.e. a database
 * whose Bastions compendium was imported before rules entries existed. Re-importing `Bastions.json`
 * replaces it with the JSON's own values.
 */
export const FALLBACK_SPECIAL_FACILITY_SLOTS: SpecialFacilitySlotStep[] = [
  { level: 5, count: 2 },
  { level: 9, count: 4 },
  { level: 13, count: 5 },
  { level: 17, count: 6 },
];

/** Basic facilities start Cramped unless the DM changes them (DM decision, 2026-09-15). */
const BASIC_STARTING_SIZE: BastionSpaceKey = "cramped";

function toSpaceKey(value: string | null | undefined): BastionSpaceKey | null {
  const key = String(value ?? "").trim().toLowerCase();
  return key || null;
}

/** How many special facilities a character of this level may have. */
export function specialFacilitySlotsForLevel(level: number, progression: SpecialFacilitySlotStep[]): number {
  let count = 0;
  for (const step of [...progression].sort((a, b) => a.level - b.level)) {
    if (level >= step.level) count = step.count;
  }
  return count;
}

/** The size a facility starts at: Cramped for basic facilities, the catalogue size for special ones. */
export function defaultFacilitySize(def: SizedFacilityDefinition): BastionSpaceKey | null {
  return def.type === "basic" ? BASIC_STARTING_SIZE : toSpaceKey(def.space);
}

/** Every size this facility may have. */
export function allowedFacilitySizes(def: SizedFacilityDefinition): BastionSpaceKey[] {
  if (def.type === "basic") {
    const listed = (def.spaces ?? []).map(toSpaceKey).filter((key): key is BastionSpaceKey => key !== null);
    return listed.length > 0 ? listed : [BASIC_STARTING_SIZE];
  }
  const base = toSpaceKey(def.space);
  if (!base) return [];
  const upgraded = toSpaceKey(def.upgrade?.to);
  return upgraded && upgraded !== base ? [base, upgraded] : [base];
}

/** True once a special facility has taken its upgrade. */
export function isFacilityUpgraded(def: SizedFacilityDefinition, size: string | null | undefined): boolean {
  return def.type === "special" && Boolean(def.upgrade) && toSpaceKey(size) === toSpaceKey(def.upgrade?.to);
}

/** Hirelings at this size: the catalogue count, plus the upgrade's extra hirelings once upgraded. */
export function facilityHirelings(def: SizedFacilityDefinition, size: string | null | undefined): number {
  const base = def.hirelings ?? 0;
  return isFacilityUpgraded(def, size) ? base + (def.upgrade?.hirelingsDelta ?? 0) : base;
}

/** A size's display name from the compendium, or the key capitalised when the compendium lacks it. */
export function facilitySizeName(size: string | null | undefined, spaces: BastionSpaceDefinition[]): string {
  const key = toSpaceKey(size);
  if (!key) return "";
  return spaces.find((space) => space.key === key)?.name ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** A gold amount as the pill shows it, e.g. 2000 → "2,000". */
export function formatGp(value: number): string {
  return value.toLocaleString("en-US");
}

/** What the DM's upgrade pill shows and does for one facility. */
export type FacilitySizePill = {
  /** Highlighted: the facility is above the size it starts at. */
  active: boolean;
  /** True when the next click goes back down rather than up. */
  resets: boolean;
  /** Cost of the next upgrade, from the compendium. Null when resetting, or when the JSON has none. */
  upgradeCostGp: number | null;
  /** The size the next click sets. */
  nextSize: BastionSpaceKey;
  /** The current size's display name. */
  sizeName: string;
};

/**
 * The DM's upgrade pill for a facility, or null when it can't change size.
 *
 * - A special facility with an upgrade toggles: off at its catalogue size (showing the cost), on at
 *   its upgraded size (no cost), and clicking again goes back down.
 * - A basic facility steps up through its sizes in compendium order (Cramped → Roomy → Vast), showing
 *   the next step's cost each time, and resets to Cramped from the top.
 */
export function facilitySizePill(
  def: SizedFacilityDefinition,
  size: string | null | undefined,
  spaces: BastionSpaceDefinition[],
): FacilitySizePill | null {
  const allowed = allowedFacilitySizes(def);
  if (allowed.length < 2) return null;
  const start = defaultFacilitySize(def) ?? allowed[0]!;
  const current = toSpaceKey(size) ?? start;
  const sizeName = facilitySizeName(current, spaces);

  if (def.type === "special") {
    if (current !== start) return { active: true, resets: true, upgradeCostGp: null, nextSize: start, sizeName };
    return { active: false, resets: false, upgradeCostGp: def.upgrade?.costGp ?? null, nextSize: allowed[1]!, sizeName };
  }

  const sortOf = (key: BastionSpaceKey) => spaces.find((space) => space.key === key)?.sort ?? allowed.indexOf(key);
  const order = [...allowed].sort((a, b) => sortOf(a) - sortOf(b));
  const next = order[order.indexOf(current) + 1];
  if (order.indexOf(current) < 0 || !next) {
    return { active: current !== start, resets: true, upgradeCostGp: null, nextSize: start, sizeName };
  }
  const step = spaces.find((space) => space.key === current)?.basicUpgrade;
  return {
    active: current !== start,
    resets: false,
    upgradeCostGp: step && toSpaceKey(step.to) === next ? step.costGp : null,
    nextSize: next,
    sizeName,
  };
}
