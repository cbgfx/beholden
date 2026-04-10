import { api } from "@/services/api";
import { useCompendiumItemSearch } from "@beholden/shared/domain/compendium/useItemSearch";
import type { ItemSearchRow } from "@beholden/shared/domain/compendium/itemSearch";

export type { ItemSearchRow };

export function useItemSearch() {
  const result = useCompendiumItemSearch(api);
  return {
    ...result,
    error: undefined,
  };
}
