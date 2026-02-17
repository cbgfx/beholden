import type { Combatant } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

export type StoreDispatch = (action: any) => void;

export type BaseActionArgs = {
  campaignId?: string;
  encounterId: string | undefined;
  orderedCombatants: Combatant[];
  setActiveId: (id: string | null) => void;
  setTargetId: (id: string | null) => void;
  setRound: (n: number | ((prev: number) => number)) => void;
  persistCombatState: (next: { round: number; activeId: string | null }) => Promise<void>;
  refresh: () => Promise<void>;
  dispatch: StoreDispatch;
};

export type MonsterActionArgs = {
  inpcsById: Record<string, { monsterId?: string } | undefined>;
  monsterCache: Record<string, MonsterDetail>;
  setMonsterCache: (next: Record<string, MonsterDetail>) => void;
};
