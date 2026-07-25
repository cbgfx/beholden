import type { ParsedFeatChoiceLike as CreatorParsedFeatChoiceLike, ParsedFeatDetailLike } from "./FeatChoiceTypes";
import type { StructuredStartingEquipmentOption } from "./CharacterCreatorClassCoreUtils";

export interface CreatorItemSummaryLike {
  id: string;
  name: string;
  type: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  mastery?: string | null;
}

export interface CreatorInventoryItemSeed {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  equipState?: "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand";
  notes?: string;
  source?: "compendium" | "custom";
  itemId?: string;
  type?: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

export type CreatorBackgroundFeatLike = ParsedFeatDetailLike<CreatorParsedFeatChoiceLike>;

export interface CreatorLevelUpFeatDetailLike {
  level: number;
  featId: string;
  feat: CreatorBackgroundFeatLike;
}

export interface CreatorClassDetailLike {
  name: string;
  subclasses?: { level: number; options: Record<string, string> } | null;
  choices?: Array<{ id: string; name: string; options: Array<{ id: string; name: string; features: string[] }> }>;
  equipmentOptions?: StructuredStartingEquipmentOption[];
  armor: string;
  weapons: string;
  tools?: string;
  proficiency: string;
  /** Structured proficiencies present for Grand classes. */
  proficiencies?: {
    savingThrows?: string[];
    skills?: { choose: number; from: string[] };
    armor?: string[];
    weapons?: string[];
    tools: {
      fixed: string[];
      choices: Array<{ count: number; from: string[] }>;
      notes: string[];
    };
  };
  autolevels: Array<{
    level: number | null;
    features: Array<{ id?: string; name: string; text: string; optional: boolean; subclass?: string | null; effects?: unknown[]; noteTemplate?: { id: string; title: string; text: string } | null; choices?: Array<
      | { kind: "feat"; category: "F"; count?: number; replace?: true }
      | { kind: "weapon_mastery"; known: Record<string, number>; melee?: true }
      | { kind: "expertise"; known: Record<string, number>; from?: string[] }
      | { kind: "proficiency"; category: "skill" | "tool" | "language" | "saving_throw"; count: number; from?: string | string[]; ifProficient?: string }
      | { id: string; kind: "spell"; lists: string[]; count?: number; level?: number; maxLevel?: number; school?: string; mode: "known" | "prepared" | "spellbook"; replace?: true; perNewSlotLevel?: true; freeCast?: true; ifKnown?: string }
    > }>;
  }>;
}

export interface CreatorRaceDetailLike {
  id?: string;
  name: string;
  speed?: number | null;
  traits: Array<{ name: string; text: string; modifier: string[]; effects?: unknown[] }>;
  parsedChoices?: { languageChoice?: { count: number; from: string[] | null } | null } | null;
}

export interface CreatorBgDetailLike {
  name: string;
  proficiency: string;
  equipment?: string;
  equipmentOptions?: Array<{
    id: string;
    entries: Array<
      | { kind: "item"; itemId?: string; name?: string; quantity: number; sourceLabel?: string }
      | { kind: "choiceRef"; choiceKey: "background.tools" | "class.tools"; quantity: number; sourceLabel: string }
      | { kind: "itemChoice"; choiceKey: string; itemIds: string[]; quantity: number; sourceLabel: string }
      | { kind: "currency"; denomination: "PP" | "GP" | "EP" | "SP" | "CP"; amount: number }
    >;
  }>;
  proficiencies?: {
    skills: { fixed: string[] };
    tools: { fixed: string[] };
    languages: { fixed: string[] };
    feats: CreatorBackgroundFeatLike[];
  };
  traits: Array<{ name: string; text: string }>;
}

export interface CreatorSpellSummaryLike {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
  effects?: unknown[];
}

export interface CreatorFormLike {
  level: number;
  subclass?: string | null;
  chosenSkills: string[];
  chosenClassLanguages: string[];
  chosenClassTools: string[];
  chosenWeaponMasteries: string[];
  chosenOptionals: string[];
  chosenFeatOptions: Record<string, string[]>;
  chosenFeatureChoices: Record<string, string[]>;
  chosenBgSkills: string[];
  chosenBgTools: string[];
  chosenBgLanguages: string[];
  chosenRaceSkills: string[];
  chosenRaceLanguages: string[];
  chosenRaceTools: string[];
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  chosenBgEquipmentOption: string | null;
  chosenClassEquipmentOption: string | null;
}

export interface CreatorWeaponMasteryChoice {
  source: string;
  count: number;
}
