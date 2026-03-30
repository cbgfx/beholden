export type MonsterDetail = {
  id: string;
  name: string;
  cr: number | null;
  // Some compendium imports include this directly.
  xp?: number | null;
  ac: any;
  hp: any;
  speed: any;
  str: number | null;
  dex: number | null;
  con: number | null;
  int: number | null;
  wis: number | null;
  cha: number | null;
  trait: any[];
  action: any[];
  reaction: any[];
  legendary: any[];
  spellcasting: any[];
  spells?: any;
  raw_json: any;
};

export type SpellSummary = {
  id: string;
  name: string;
  level: number;
  school?: string;
  time?: string;
};

export type SpellDetail = any;

export type CompendiumItemRow = {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
};

export type CompendiumItemDetail = CompendiumItemRow & {
  nameKey?: string | null;
  text: string;
  weight?: number | null;
  value?: number | null;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  ac?: number | null;
  modifiers?: Array<{ category: string; text: string }>;
};
