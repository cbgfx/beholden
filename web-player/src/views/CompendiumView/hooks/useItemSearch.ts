import { api } from "@/services/api";
import { useCompendiumItemSearch } from "@beholden/shared/domain/compendium/useItemSearch";
import type { UseCompendiumItemSearchOptions } from "@beholden/shared/domain/compendium/useItemSearch";

export function useItemSearch(options?: UseCompendiumItemSearchOptions) {
  return useCompendiumItemSearch(api, {
    ...options,
    includeError: true,
  });
}
