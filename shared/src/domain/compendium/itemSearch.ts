export type ItemSearchRow = {
  id: string;
  ruleset?: "5e" | "5.5e";
  name: string;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
};

const RARITY_ORDER = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];

export function buildItemRarityOptions(rows: ItemSearchRow[]): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    if (row.rarity) values.add(row.rarity);
  }

  const ordered = RARITY_ORDER.filter((value) => values.has(value));
  const extras = Array.from(values).filter((value) => !RARITY_ORDER.includes(value)).sort();
  return ["all", ...ordered, ...extras];
}

export function buildItemTypeOptions(rows: ItemSearchRow[]): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    if (row.type) values.add(row.type);
  }
  return ["all", ...Array.from(values).sort()];
}
