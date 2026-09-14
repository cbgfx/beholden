import { api } from "@/services/api";
import { useCompendiumItemSearch } from "@beholden/shared/domain/compendium/useItemSearch";
import type { ItemSearchRow } from "@beholden/shared/domain/compendium/itemSearch";
import type { UseCompendiumItemSearchOptions } from "@beholden/shared/domain/compendium/useItemSearch";

export type { ItemSearchRow };

export function useItemSearch(options?: UseCompendiumItemSearchOptions) {
  // Errors are surfaced rather than swallowed: paging stops after a failed page, so a silently
  // dropped error would leave a half-loaded list looking like the complete set of results.
  return useCompendiumItemSearch(api, { ...options, includeError: true });
}
