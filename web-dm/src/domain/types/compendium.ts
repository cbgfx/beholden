type JsonRecord = Record<string, unknown>;

type MonsterStatValue = number | string | null | JsonRecord;

export type MonsterTextEntry = {
  name?: string;
  text?: string;
  description?: string;
  entries?: unknown;
  [key: string]: unknown;
};

export type MonsterDetail = {
  id: string;
  name: string;
  cr: number | null;
  // Some compendium imports include this directly.
  xp?: number | null;
  ac: MonsterStatValue;
  hp: MonsterStatValue;
  speed: MonsterStatValue;
  str: number | null;
  dex: number | null;
  con: number | null;
  int: number | null;
  wis: number | null;
  cha: number | null;
  treasure?: string | null;
  trait: MonsterTextEntry[];
  action: MonsterTextEntry[];
  reaction: MonsterTextEntry[];
  legendary: MonsterTextEntry[];
  legendaryUses?: number | null;
  spellcasting: MonsterTextEntry[];
  spells?: JsonRecord | string[] | null;
  type?: string | null;
  raw_json: JsonRecord;
};

export type SpellDetail = JsonRecord & {
  id?: string;
  name?: string;
  level?: number | string | null;
  school?: string | null;
  time?: string | null;
  text?: string | string[] | null;
  raw_json?: JsonRecord;
};

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
  text: string | string[] | null;
  weight?: number | null;
  value?: number | null;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  ac?: number | null;
  modifiers?: Array<{ target?: string; amount?: number }>;
};
