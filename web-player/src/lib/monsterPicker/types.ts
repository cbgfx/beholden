export type CompendiumMonsterRow = {
  id: string;
  name: string;
  cr?: number | string;
  type?: string;
  environment?: string;
  size?: string;
};

export type SortMode = "az" | "crAsc" | "crDesc";
