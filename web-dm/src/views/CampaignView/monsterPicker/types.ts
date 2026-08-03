import type { AttackOverride } from "@/domain/types/domain";

export type { CompendiumMonsterRow, SortMode } from "@beholden/shared/domain/compendium/monsterPicker";

type AttackOverridesByActionName = Record<string, AttackOverride>;

export type AttackOverridesByMonsterId = Record<string, AttackOverridesByActionName>;
