export interface PreparedSpellProgressionRow {
  level: number;
  spells: string[];
}

export interface PreparedSpellProgressionTable {
  label: string | null;
  levelLabel: string;
  spellLabel: string;
  rows: PreparedSpellProgressionRow[];
  choiceGroupKey?: string | null;
  choicePrompt?: string | null;
  choiceOptionLabel?: string | null;
  choiceOptions?: string[] | null;
}
