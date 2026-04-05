import type { SharedConditionInstance } from "@beholden/shared/domain";

export type MonsterDetail = {
  id: string;
  name: string;
  cr: number | null;
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
  raw_json: any;
};

export type SpellSummary = { id: string; name: string; level: number; school?: string; time?: string };
export type SpellDetail = any;

// Conditions are stored on combatants and are edited via the Conditions drawer.
// Keep this type intentionally minimal; the UI only requires key + (optional) caster info.
export type ConditionInstance = SharedConditionInstance;

// Spell levels are resolved async; unknown levels may be null until fetched.
export type SpellLevels = Record<string, number | null>;
