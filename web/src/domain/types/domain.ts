
export type Campaign = { id: string; name: string; updatedAt: number };
export type Adventure = { id: string; campaignId: string; name: string; updatedAt: number; status: string };
export type Encounter = { id: string; campaignId: string; adventureId: string | null; name: string; status: string; updatedAt: number };
export type Note = { id: string; campaignId: string; adventureId: string | null; title: string; text: string; updatedAt: number };
export type Player = {
  id: string;
  campaignId?: string; // present in server payload; optional for legacy safety
  playerName: string;
  characterName: string;
  level: number;
  class: string;
  species: string;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  color: string;
  // Player-wide combat state that must persist across encounters.
  // Stored server-side on the player record; merged onto player combatants.
  overrides?: CombatantOverrides | null;
  conditions?: Array<{ key: string; casterId?: string | null }>;
  // Ability scores (optional for legacy data; default to 10 when absent).
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  // Movement speed (feet). Optional for legacy data; default to 30.
  speed?: number;
};

// Campaign-level NPC roster entry ("iNPC"). Sourced from the monster compendium,
// reusable across encounters, with persistent HP/AC you can manage between fights.
export type INpc = {
  id: string;
  campaignId: string;

  // Compendium monster id (source).
  monsterId: string;

  // Display.
  name: string;
  label?: string | null;

  // Sheet stats.
  hpMax: number;
  hpCurrent: number;
  hpDetails?: string | null;

  ac: number;
  acDetails?: string | null;

  friendly: boolean;
  createdAt?: number;
  updatedAt?: number;
};
export type CombatantOverrides = {
  // Temporary HP that is consumed before hpCurrent when taking damage.
  tempHp: number | null;
  // Applied on top of ac for display + play.
  acBonus: number | null;
  // If set, display + treat max HP as this value.
  hpMaxOverride: number | null;
};

export type AddMonsterOptions = {
  labelBase?: string;
  ac?: number;
  acDetail?: string;
  hpMax?: number;
  hpDetail?: string;
  friendly?: boolean;
  // Per-instance overrides for parsed attacks (keyed by action name)
  attackOverrides?: Record<string, { toHit?: number; damage?: string; damageType?: string }>;
};

export type TreasureEntry = {
  id: string;
  campaignId: string;
  adventureId?: string | null;
  source: "compendium" | "custom";
  itemId?: string | null;
  name: string;
  rarity?: string | null;
  type?: string | null;
  type_key?: string | null;
  attunement: boolean;
  text: string;
  sort?: number;
  createdAt?: number;
  updatedAt?: number;
};

export type Monster = {
  id: string;
  name: string;

  // “Sheet” stats — enough to power CharacterSheetPanel cleanly
  ac: number;
  acDetails?: string | null;

  hpMax: number;
  hpDetails?: string | null;

  speed?: number | null;

  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;

  // optional extras
  cr?: string | number | null;
  type?: string | null;

  // “Details panels”
  spells?: string[];   // store names for now
  traits?: string[];   // store strings for now

  // raw source (optional, keeps you future-proof)
  statBlock?: string | null;
};


export type Combatant = {
  id: string;
  encounterId: string;
  baseType: "player" | "monster" | "inpc";
  baseId: string;
  name: string;
  playerName: string;
  label: string;
  // Initiative for combat ordering. Null/undefined means not set yet.
  initiative?: number | null;
  friendly: boolean;
  color: string;
  overrides: CombatantOverrides | null;
  hpCurrent: number | null;
  hpMax: number | null;
  // Freeform details that accompany the numeric stat, e.g. "(natural armor)" or "(25d8+25)".
  hpDetail: string | null;
  ac: number | null;
  acDetail: string | null;
  // Combat conditions applied to this combatant.
  // Some conditions (e.g. Hexed/Marked) may be applied by different casters,
  // so casterId differentiates entries.
  conditions?: Array<{ key: string; casterId?: string | null }>;
};
export type Meta = { ok: boolean; ips: string[]; host: string; port: number; hasCompendium: boolean };
