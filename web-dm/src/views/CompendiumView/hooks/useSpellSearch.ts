import { useCompendiumSpellSearch } from "@beholden/shared/domain/compendium/useSpellSearch";
import { api } from "@/services/api";

export function useSpellSearch() {
  return useCompendiumSpellSearch(api);
}
