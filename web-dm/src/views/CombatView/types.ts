import type { SharedConditionInstance } from "@beholden/shared/domain";
export type {
  MonsterDetail,
  SpellSummary,
  SpellDetail,
} from "@/domain/types/compendium";

// Conditions are stored on combatants and are edited via the Conditions drawer.
// Keep this type intentionally minimal; the UI only requires key + (optional) caster info.
export type ConditionInstance = SharedConditionInstance;

// Spell levels are resolved async; unknown levels may be null until fetched.
export type SpellLevels = Record<string, number | null>;
