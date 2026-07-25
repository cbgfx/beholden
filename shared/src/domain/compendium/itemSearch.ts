export type ItemSearchRow = {
  id: string;
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

type ItemSearchFilters = {
  q: string;
  rarityFilter: string;
  typeFilter: string;
  filterAttunement: boolean;
  filterMagic: boolean;
  nameSearchValue?: (name: string) => string;
};

export function filterItemRows(rows: ItemSearchRow[], filters: ItemSearchFilters): ItemSearchRow[] {
  const {
    q,
    rarityFilter,
    typeFilter,
    filterAttunement,
    filterMagic,
    nameSearchValue = (name) => name,
  } = filters;
  const qLow = q.toLowerCase().trim();
  return rows.filter((row) => {
    const searchName = nameSearchValue(row.name).toLowerCase();
    if (qLow && !searchName.includes(qLow)) return false;
    if (rarityFilter !== "all" && (row.rarity ?? "") !== rarityFilter) return false;
    if (typeFilter !== "all" && row.type !== typeFilter) return false;
    if (filterAttunement && !row.attunement) return false;
    if (filterMagic && !row.magic) return false;
    return true;
  });
}
