// server/src/server/userData.ts
// Canonical server-side domain types for persisted data.
// These are richer than the client domain types — they include internal fields
// like sort, createdAt, updatedAt, and server-only state.

export type Id = string;

export interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

export interface StoredOptionalAbilities {
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
}

export interface StoredSheetAbilities {
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
}

export interface StoredActorVitals {
  hpMax: number;
  hpCurrent: number;
  ac: number;
}

export interface StoredCharacterSheetState
  extends StoredActorVitals,
    StoredSheetAbilities {
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  speed: number;
  color: string | null;
  deathSaves?: StoredDeathSaves;
}

export interface StoredCampaignCharacterSheetState
  extends Omit<StoredActorVitals, "hpCurrent">,
    StoredOptionalAbilities {
  playerName: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  speed?: number;
  color?: string | null;
  /** Effective AC computed client-side by the player (armor + features + shield, without DM acBonus override).
   *  Never used by the player's own formula — only surfaced to the DM. */
  syncedAc?: number;
}

export interface StoredCampaignCharacterLiveState {
  hpCurrent: number;
  overrides?: StoredOverrides;
  conditions?: StoredConditionInstance[];
  deathSaves?: StoredDeathSaves;
}

export interface StoredEncounterActorSnapshot {
  name: string;
  label: string;
  friendly: boolean;
  color: string;
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: unknown | null;
}

export interface StoredEncounterActorLiveState {
  initiative: number | null;
  hpCurrent: number | null;
  overrides: StoredOverrides;
  conditions: StoredConditionInstance[];
  deathSaves?: StoredDeathSaves;
  usedReaction?: boolean;
  usedLegendaryActions?: number;
  usedLegendaryResistances?: number;
  usedSpellSlots?: Record<string, number>;
}

export interface StoredNoteState {
  title: string;
  text: string;
}

export interface StoredTreasureState {
  source: "compendium" | "custom";
  itemId: string | null;
  name: string;
  rarity: string | null;
  type: string | null;
  type_key: string | null;
  attunement: boolean;
  magic: boolean;
  text: string;
  qty: number;
}

export interface StoredPartyInventoryItemState {
  name: string;
  quantity: number;
  weight: number | null;
  notes: string;
  source: string | null;
  itemId: string | null;
  rarity: string | null;
  type: string | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Overrides & sub-types
// ---------------------------------------------------------------------------

export interface StoredOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
  inspiration?: boolean;
  abilityScores?: {
    str?: number | undefined;
    dex?: number | undefined;
    con?: number | undefined;
    int?: number | undefined;
    wis?: number | undefined;
    cha?: number | undefined;
  } | undefined;
}

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

export interface StoredUser extends Timestamps {
  id: Id;
  username: string;
  name: string;
  isAdmin: boolean;
}

export interface StoredCampaign extends Timestamps {
  id: Id;
  name: string;
  color: string | null;
  imageUrl?: string | null;
  sharedNotes: string;
}

export interface StoredAdventure extends Timestamps {
  id: Id;
  campaignId: Id;
  name: string;
  status: string;
  sort: number;
}

export interface StoredCombatState {
  round: number;
  activeCombatantId: string | null;
}

export interface StoredEncounter extends Timestamps {
  id: Id;
  campaignId: Id;
  adventureId: Id;
  name: string;
  status: string;
  sort?: number;
  /** Active combat state for this encounter. Absent when no combat has started. */
  combat?: StoredCombatState;
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
  qty: number;
  sort: number;
}

export interface StoredPartyInventoryItem extends Timestamps {
  id: Id;
  campaignId: Id;
  name: string;
  quantity: number;
  weight: number | null;
  notes: string;
  source: string | null;
  itemId: string | null;
  rarity: string | null;
  type: string | null;
  description: string | null;
  sort: number;
}

export interface StoredCampaignCharacter extends Timestamps, StoredActorVitals, StoredOptionalAbilities {
  id: Id;
  campaignId: Id;
  userId?: string | null;
  characterId?: string | null;
  playerName: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  speed?: number;
  syncedAc?: number;
  overrides?: StoredOverrides;
  conditions?: StoredConditionInstance[];
  deathSaves?: StoredDeathSaves;
  color?: string;
  imageUrl?: string | null;
  sharedNotes?: string;
}

export interface StoredCharacterSheet extends Timestamps, StoredActorVitals, StoredSheetAbilities {
  id: Id;
  userId: Id;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  speed: number;
  color: string | null;
  imageUrl: string | null;
  characterData: Record<string, unknown> | null;
  deathSaves?: StoredDeathSaves;
  sharedNotes: string;
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

export type StoredEncounterActorBaseType = "player" | "monster" | "inpc";

export interface StoredEncounterActor extends Timestamps {
  id: Id;
  encounterId: Id;
  baseType: StoredEncounterActorBaseType;
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
  /** How many legendary resistance uses have been spent this fight. */
  usedLegendaryResistances?: number;
  /** Spell slots spent per level. Keys are spell level as string ("1"–"9"), values are count of used slots. */
  usedSpellSlots?: Record<string, number>;
  sort?: number;
}

