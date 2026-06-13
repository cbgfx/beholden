import { api } from "@/services/api";
import { useCompendiumItemSearch } from "@beholden/shared/domain/compendium/useItemSearch";
import type { ItemSearchRow } from "@beholden/shared/domain/compendium/itemSearch";
import type { UseCompendiumItemSearchOptions } from "@beholden/shared/domain/compendium/useItemSearch";

export type { ItemSearchRow };

export function useItemSearch(options?: UseCompendiumItemSearchOptions) {
  return useCompendiumItemSearch(api, {
    ...options,
    includeError: true,
    nameSearchValue: (name) => name.replace(/\s*\[.*?\]\s*$/, ""),
  });
}
