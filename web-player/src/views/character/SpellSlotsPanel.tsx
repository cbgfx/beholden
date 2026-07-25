interface ClassCounterDef {
  name: string;
  value: number;
  reset: string;
}

export interface ClassRestDetail {
  id: string;
  name: string;
  hd: number | null;
  spellAbility?: string | null;
  slotsReset?: string | null;
  autolevels: Array<{
    level: number;
    slots: number[] | null;
    counters: ClassCounterDef[];
  }>;
}
