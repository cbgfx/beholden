import type { AttackOverride } from "@/domain/types/domain";

export type CompendiumMonsterRow = {
  id: string;
  name: string;
  cr?: number | string;
  type?: string;
  environment?: string;
  size?: string; // raw single-letter code: T S M L H G
};

export type SortMode = "az" | "crAsc" | "crDesc";

type AttackOverridesByActionName = Record<string, AttackOverride>;

export type AttackOverridesByMonsterId = Record<string, AttackOverridesByActionName>;
