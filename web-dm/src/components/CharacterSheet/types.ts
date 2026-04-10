export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export type CharacterSheetStats = {
  ac: number;
  hpCur: number;
  hpMax: number;
  tempHp?: number;
  speed: number | null;
  speedDisplay?: string;
  abilities: Record<AbilityKey, number>;
  saves?: Partial<Record<AbilityKey, number>>;
  infoLines?: Array<{ label: string; value: string }>;
};
