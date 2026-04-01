export type Id = string;

export interface Meta {
  ok: true;
  host: string;
  port: number;
  ips: string[];
  dataDir: string;
  hasCompendium: boolean;
  support?: boolean;
}

export interface Campaign {
  id: Id;
  name: string;
  updatedAt?: number;
  playerCount?: number;
  imageUrl?: string | null;
  sharedNotes?: string;
}

export interface Adventure {
  id: Id;
  campaignId: Id;
  name: string;
  order: number;
}

export type EncounterStatus = "open" | "closed";

export interface Encounter {
  id: Id;
  campaignId: Id;
  adventureId?: Id | null;
  name: string;
  status: EncounterStatus;
  order: number;
}

export interface Player {
  id: Id;
  campaignId: Id;
  userId?: string | null;
  playerName: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed?: number;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  // Runtime fields synced from server
  overrides?: CombatantOverrides;
  conditions?: ConditionInstance[];
  deathSaves?: DeathSaves;
  color?: string;
  imageUrl?: string | null;
  sharedNotes?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Combatants are encounter-scoped instances used by the combat tracker.
// The server returns a merged view (player combatants hydrate name/hp/ac from the Player record).
export type CombatantBaseType = "player" | "monster" | "inpc";

export interface CombatantOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
}

export interface ConditionInstance {
  key: string;
  casterId?: string | null;
  [k: string]: unknown;
}

export interface DeathSaves {
  success: number;
  fail: number;
}

export interface Combatant {
  id: Id;
  encounterId: Id;

  // Source identity
  baseType: CombatantBaseType;
  baseId: Id;

  // Display
  name: string;
  playerName?: string;
  label: string;
  color: string;

  // Combat
  initiative: number | null;
  friendly: boolean;
  overrides: CombatantOverrides;
  hpCurrent: number | null;
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: unknown | null;
  conditions: ConditionInstance[];
  deathSaves?: DeathSaves | null;
  usedReaction?: boolean;
  /** How many legendary actions have been spent this round. */
  usedLegendaryActions?: number;
  /** How many legendary resistance uses have been spent this fight. */
  usedLegendaryResistances?: number;
  /** Spell slots spent per level. Keys are spell level ("1"–"9"), values are count of used slots. */
  usedSpellSlots?: Record<string, number>;

  createdAt?: number;
  updatedAt?: number;
}

export interface INpc {
  id: Id;
  campaignId: Id;
  monsterId: Id;
  name: string;
  label?: string | null;
  friendly: boolean;
  hpMax: number;
  hpCurrent: number;
  hpDetails?: string | null;
  ac: number;
  acDetails?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface Note {
  id: Id;
  scope: "campaign" | "adventure";
  scopeId: Id;
  title: string;
  text: string;
  order: number;
}

export interface TreasureEntry {
  id: Id;
  scope: "campaign" | "adventure";
  scopeId: Id;
  name: string;
  qty: number;
  notes?: string;
  order: number;
  rarity?: string;
  type?: string;
  attunement?: boolean;
  magic?: boolean;
  text?: string;
  /** Set when the entry was sourced from the compendium — used to fetch full weapon stats on demand. */
  itemId?: string | null;
}

export type AttackOverride = {
  toHit?: number;
  damage?: string;
  damageType?: string;
};

export interface AddMonsterOptions {
  /**
   * Optional base label used when creating combatants.
   * The server/UI may suffix this to keep labels unique (e.g. "[2024] 2").
   */
  labelBase?: string;

  /** Optional stat overrides to apply to the created combatant */
  friendly?: boolean;
  hpMax?: number;
  hpCurrent?: number;
  hpDetails?: string | null;
  ac?: number;
  acDetails?: string | null;

  /** Optional attack overrides to apply */
  attackOverrides?: Record<string, AttackOverride>;
}
