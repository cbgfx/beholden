import type { ParsedFeatChoiceLike as CreatorParsedFeatChoiceLike, ParsedFeatDetailLike } from "./FeatChoiceTypes";

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
  armor: string;
  weapons: string;
  tools?: string;
  proficiency: string;
  autolevels: Array<{
    level: number | null;
    features: Array<{ name: string; text: string; optional: boolean }>;
  }>;
}

export interface CreatorRaceDetailLike {
  name: string;
  traits: Array<{ name: string; text: string; modifier: string[] }>;
}

export interface CreatorBgDetailLike {
  name: string;
  proficiency: string;
  equipment?: string;
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
}

export interface CreatorFormLike {
  level: number;
  subclass?: string | null;
  chosenSkills: string[];
  chosenClassLanguages: string[];
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
