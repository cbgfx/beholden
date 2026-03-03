// server/src/server/userData.ts
// Canonical server-side domain types for persisted data.
// These are richer than the client domain types — they include internal fields
// like sort, createdAt, updatedAt, and server-only state.

export type Id = string;

export interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Overrides & sub-types
// ---------------------------------------------------------------------------

export interface StoredOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxOverride: number | null;
}

// Aliases kept for call-site compatibility — both resolve to the same shape.
export type StoredPlayerOverrides = StoredOverrides;
export type StoredCombatantOverrides = StoredOverrides;

export interface StoredConditionInstance {
  key: string;
  casterId?: string | null;
  [k: string]: unknown;
}

export interface StoredDeathSaves {
  success: number;
  fail: number;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface StoredCampaign extends Timestamps {
  id: Id;
  name: string;
  color: string | null;
  imageUrl?: string | null;
}

export interface StoredAdventure extends Timestamps {
  id: Id;
  campaignId: Id;
  name: string;
  status: string;
  sort: number;
}

export interface StoredEncounter extends Timestamps {
  id: Id;
  campaignId: Id;
  adventureId: Id;
  name: string;
  status: string;
  sort?: number;
  /** Snapshot of combat state mirrored from StoredCombat for persistence across resets. */
  combat?: {
    round: number;
    activeCombatantId: string | null;
  };
}

export interface StoredNote extends Timestamps {
  id: Id;
  campaignId: Id;
  adventureId?: Id | null;
  title: string;
  text: string;
  sort: number;
}

export interface StoredTreasure extends Timestamps {
  id: Id;
  campaignId: Id;
  adventureId: string | null;
  source: "compendium" | "custom";
  itemId: string | null;
  name: string;
  rarity: string | null;
  type: string | null;
  type_key: string | null;
  attunement: boolean;
  magic: boolean;
  text: string;
  sort: number;
}

export interface StoredPlayer extends Timestamps {
  id: Id;
  campaignId: Id;
  playerName: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  overrides?: StoredOverrides;
  conditions?: StoredConditionInstance[];
  deathSaves?: StoredDeathSaves;
  // Ability scores
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  color?: string;
}

export interface StoredINpc extends Timestamps {
  id: Id;
  campaignId: Id;
  monsterId: string;
  name: string;
  label: string | null;
  friendly: boolean;
  hpMax: number;
  hpCurrent: number;
  hpDetails: string | null;
  ac: number;
  acDetails: string | null;
  sort?: number;
}

export interface StoredCondition extends Timestamps {
  id: Id;
  campaignId: Id;
  key: string;
  name: string;
  description?: string;
  sort?: number;
}

export type StoredCombatantBaseType = "player" | "monster" | "inpc";

export interface StoredCombatant extends Timestamps {
  id: Id;
  encounterId: Id;
  baseType: StoredCombatantBaseType;
  baseId: string;
  name: string;
  label: string;
  initiative: number | null;
  friendly: boolean;
  color: string;
  overrides: StoredOverrides;
  hpCurrent: number | null;
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: unknown | null;
  conditions: StoredConditionInstance[];
  /** Encounter-scoped death save tracking for player combatants (success/fail). */
  deathSaves?: StoredDeathSaves;
  /** Whether this combatant has used their reaction this turn. Resets at the start of their next turn. */
  usedReaction?: boolean;
  /** How many legendary actions have been spent this round. Resets at the start of this combatant's turn. */
  usedLegendaryActions?: number;
  /** Spell slots spent per level. Keys are spell level as string ("1"–"9"), values are count of used slots. */
  usedSpellSlots?: Record<string, number>;
  sort?: number;
}

export interface StoredCombat extends Timestamps {
  encounterId: Id;
  round: number;
  activeIndex: number;
  activeCombatantId: string | null;
  combatants: StoredCombatant[];
}

// ---------------------------------------------------------------------------
// UserData — the root in-memory store
// ---------------------------------------------------------------------------

export interface UserData {
  version: number;
  campaigns: Record<Id, StoredCampaign>;
  adventures: Record<Id, StoredAdventure>;
  encounters: Record<Id, StoredEncounter>;
  notes: Record<Id, StoredNote>;
  treasure: Record<Id, StoredTreasure>;
  players: Record<Id, StoredPlayer>;
  inpcs: Record<Id, StoredINpc>;
  conditions: Record<Id, StoredCondition>;
  combats: Record<Id, StoredCombat>;
}
