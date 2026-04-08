export type CompendiumMonsterRow = {
  id: string;
  name: string;
  cr?: number | string;
  type?: string;
  environment?: string;
  size?: string;
};

export type PreparedMonsterRow = CompendiumMonsterRow & {
  nameLower: string;
  envParts: string[];
  envPartsLower: string[];
  crNum: number | null;
  firstLetter: string;
  sizeLabel: string;
};

export type SortMode = "az" | "crAsc" | "crDesc";
