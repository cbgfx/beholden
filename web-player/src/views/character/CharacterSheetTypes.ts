import type {
  SharedCombatOverrides,
  SharedConditionInstance,
  SharedDeathSaves,
} from "@beholden/shared/domain";
import type { InventoryContainer, InventoryItem } from "@/views/character/CharacterInventory";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";

export type AbilKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface TaggedItem {
  name: string;
  source: string;
  id?: string;
  ability?: AbilKey | null;
  sourceKey?: string | null;
}

export interface ProficiencyMap {
  skills: TaggedItem[];
  expertise: TaggedItem[];
  saves: TaggedItem[];
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  languages: TaggedItem[];
  spells: TaggedItem[];
  invocations: TaggedItem[];
  maneuvers: TaggedItem[];
  plans: TaggedItem[];
}

export interface PlayerNote {
  id: string;
  title: string;
  text: string;
}

export interface ClassFeatureEntry {
  id: string;
  name: string;
  text: string;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

export interface ResourceCounter {
  key: string;
  name: string;
  current: number;
  max: number;
  reset: string;
  restoreAmount?: "all" | "one" | number;
}

export interface CharacterCreature {
  id: string;
  monsterId: string;
  name: string;
  label?: string | null;
  friendly?: boolean;
  hpMax: number;
  hpCurrent: number;
  hpDetails?: string | null;
  ac: number;
  acDetails?: string | null;
  notes?: string | null;
}

export interface GrantedSpellCast {
  key: string;
  spellName: string;
  sourceName: string;
  mode: "at_will" | "limited" | "known" | "always_prepared" | "expanded_list";
  note: string;
  spellId?: string;
  ability?: AbilKey | null;
  resourceKey?: string;
  reset?: string;
}

export interface ConditionInstance extends SharedConditionInstance {
  casterName?: string | null;
  sourceName?: string | null;
}

export interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

export interface CharacterClassEntry {
  id: string;
  classId?: string | null;
  className?: string | null;
  level: number;
  subclass?: string | null;
}

export interface CharacterData {
  classes?: CharacterClassEntry[];
  raceId?: string;
  bgId?: string;
  alignment?: string | null;
  hair?: string | null;
  skin?: string | null;
  height?: string | null;
  age?: string | null;
  weight?: string | null;
  gender?: string | null;
  sheetOverrides?: SharedCombatOverrides | null;
  chosenRaceFeatId?: string | null;
  chosenBgOriginFeatId?: string | null;
  abilityMethod?: string;
  hd?: number | null;
  hitDiceCurrent?: number | null;
  xp?: number;
  chosenOptionals?: string[];
  selectedFeatureNames?: string[];
  chosenClassFeatIds?: Record<string, string>;
  chosenLevelUpFeats?: Array<{ level: number; featId?: string | null; type?: "asi" | "feat"; abilityBonuses?: Record<string, number> }>;
  chosenSkills?: string[];
  chosenClassLanguages?: string[];
  chosenFeatOptions?: Record<string, string[]>;
  chosenFeatureChoices?: Record<string, string[]>;
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  resources?: ResourceCounter[];
  proficiencies?: ProficiencyMap;
  inventory?: InventoryItem[];
  inventoryContainers?: InventoryContainer[];
  creatures?: CharacterCreature[];
  playerNotesList?: PlayerNote[];
  usedSpellSlots?: Record<string, number>;
  preparedSpells?: string[];
  customResistances?: string[];
  customImmunities?: string[];
  deathSaves?: SharedDeathSaves;
}

