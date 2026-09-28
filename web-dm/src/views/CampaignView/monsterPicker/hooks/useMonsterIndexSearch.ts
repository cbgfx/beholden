import * as React from "react";
import { useMonsterBrowser } from "@beholden/shared/domain/compendium/useMonsterBrowser";
import type { SortMode } from "@/views/CampaignView/monsterPicker/types";

/**
 * The picker's list, backed by the same paged search the compendium browser uses.
 *
 * It used to fetch the whole index eagerly: 200 rows a request, in a loop, until a short page came
 * back - about eleven requests and 37KB every time the modal opened, and again on every debounced
 * keystroke or filter change. That cost grows with the compendium, which is the wrong direction.
 *
 * Now a window is fetched when the list scrolls over it. `rows` is sparse and as long as the
 * server's total, so a slot that has not arrived yet is `undefined` and renders as a placeholder,
 * and the A-Z bar can jump straight to row 1,500 without anything in between being loaded.
 */
export function useMonsterIndexSearch(args: { isOpen: boolean; query: string }) {
  const { isOpen, query } = args;
  const browser = useMonsterBrowser({ enabled: isOpen });
  const { setCompQ } = browser;

  // The picker owns its search box; the browser owns the query the fetches are built from.
  React.useEffect(() => {
    setCompQ(query);
  }, [query, setCompQ]);

  const listScrollToIndexRef = React.useRef<((index: number) => void) | null>(null);
  const onJumpToLetter = React.useCallback((letter: string) => {
    const index = browser.letterFirstIndex[letter];
    if (index != null) listScrollToIndexRef.current?.(index);
  }, [browser.letterFirstIndex]);

  const { setEnvFilter, setSizeFilter, setTypeFilter, setCrMin, setCrMax, setSortMode } = browser;
  const clearFilters = React.useCallback(() => {
    setEnvFilter("all");
    setSizeFilter("all");
    setTypeFilter("all");
    setCrMin("");
    setCrMax("");
    setSortMode("az" as SortMode);
  }, [setCrMax, setCrMin, setEnvFilter, setSizeFilter, setSortMode, setTypeFilter]);

  return {
    sortMode: browser.sortMode,
    setSortMode: browser.setSortMode,
    envFilter: browser.envFilter,
    setEnvFilter: browser.setEnvFilter,
    envOptions: browser.envOptions,
    sizeFilter: browser.sizeFilter,
    setSizeFilter: browser.setSizeFilter,
    sizeOptions: browser.sizeOptions,
    typeFilter: browser.typeFilter,
    setTypeFilter: browser.setTypeFilter,
    typeOptions: browser.typeOptions,
    crMin: browser.crMin,
    setCrMin: browser.setCrMin,
    crMax: browser.crMax,
    setCrMax: browser.setCrMax,
    rulesetFilter: browser.rulesetFilter,
    setRulesetFilter: browser.setRulesetFilter,
    showRulesetFilter: browser.showRulesetFilter,
    /** Sparse: indexed by position in the whole result, `undefined` where nothing is loaded yet. */
    rows: browser.rows,
    /** How many rows the search matched on the server, which is what the list is sized by. */
    totalRows: browser.totalRows,
    ensureRange: browser.ensureRange,
    loadingIndex: browser.loading,
    indexError: browser.loadError,
    lettersInList: browser.lettersInList,
    onJumpToLetter,
    listScrollToIndexRef,
    clearFilters,
  };
}
