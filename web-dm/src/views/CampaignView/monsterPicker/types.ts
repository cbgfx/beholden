import type { AttackOverride } from "@/domain/types/domain";

export type CompendiumMonsterRow = {
  id: string;
  name: string;
  cr?: number | string;
  type?: string;
  environment?: string;
  size?: string; // raw single-letter code: T S M L H G
};

export type PreparedMonsterRow = CompendiumMonsterRow & {
  nameLower: string;
  sortNameLower: string;
  envParts: string[];
  envPartsLower: string[];
  crNum: number | null;
  firstLetter: string; // "A".."Z" or "#"
  sizeLabel: string;   // e.g. "Medium", "Large" — empty string if unknown
};

export type SortMode = "az" | "crAsc" | "crDesc";

export type { AttackOverride } from "@/domain/types/domain";

export type AttackOverridesByActionName = Record<string, AttackOverride>;

export type AttackOverridesByMonsterId = Record<string, AttackOverridesByActionName>;
