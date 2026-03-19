/**
 * compendium.ts (types)
 *
 * Minimal structural type for the compendium service returned by createCompendium().
 * Keeps compendium internals (any[] monster data) isolated from the rest of the type system.
 */

export interface CompendiumMonster {
  id: string;
  name: string;
  nameKey: string | null;
  cr: number | string | null;
  typeFull: string | null;
  typeKey: string | null;
  size: string | null;
  environment: string | null;
  source: string | null;
  ac: unknown;
  hp: unknown;
  speed: unknown;
  str: number | null;
  dex: number | null;
  con: number | null;
  int: number | null;
  wis: number | null;
  cha: number | null;
  save: unknown;
  skill: unknown;
  senses: unknown;
  languages: unknown;
  immune: unknown;
  resist: unknown;
  vulnerable: unknown;
  conditionImmune: unknown;
  trait: unknown[];
  action: unknown[];
  reaction: unknown[];
  legendary: unknown[];
  spellcasting: unknown[];
  spells: unknown[];
  xp?: number | null;
}

export interface CompendiumItem {
  id: string;
  name: string;
  nameKey: string | null;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
  text: string;
}

export interface CompendiumSpell {
  id: string;
  name: string;
  nameKey: string | null;
  level: number | null;
  school: string | null;
  time: string | null;
  [k: string]: unknown;
}

export interface CompendiumState {
  loaded: boolean;
  monsters: CompendiumMonster[];
  spells: CompendiumSpell[];
  items: CompendiumItem[];
}

export interface Compendium {
  state: CompendiumState;
  path: string;
  load: () => void;
  clear: () => void;
  searchMonsters: (q: unknown, filters: unknown, limit: unknown) => CompendiumMonster[];
  writeMerged: (rawDoc: unknown) => void;
}
