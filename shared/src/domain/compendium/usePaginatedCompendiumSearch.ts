import React from "react";

export type CompendiumApi = <T>(path: string, init?: RequestInit) => Promise<T>;
export type CompendiumRuleset = "5e" | "5.5e";

type Page<Row> = { rows: Row[]; total: number };
type RequestPage<Row> = (offset: number, signal: AbortSignal) => Promise<Page<Row>>;

const DEFAULT_ERROR_MESSAGE = "Could not load results. Please try again.";

export function useAvailableCompendiumRulesets(
  api: CompendiumApi,
  category: string,
  enabled = true,
) {
  const [availableRulesets, setAvailableRulesets] = React.useState<CompendiumRuleset[]>([]);
  const [rulesetFilter, setRulesetFilter] = React.useState<CompendiumRuleset | "">("");

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    api<Record<string, CompendiumRuleset[]>>("/api/compendium/rulesets", {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setAvailableRulesets(Array.isArray(data?.[category]) ? data[category] : []);
        setRulesetFilter("");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAvailableRulesets([]);
        setRulesetFilter("");
      });
    return () => controller.abort();
  }, [api, category, enabled]);

  return {
    availableRulesets,
    rulesetFilter,
    setRulesetFilter,
    showRulesetFilter: availableRulesets.length > 1,
  };
}

/**
 * Paged compendium search.
 *
 * The first page is fetched as soon as the query settles; later pages are fetched only when the
 * caller asks via loadMore(). That makes one rule non-negotiable for callers: every filter must be
 * applied server-side. Filtering the loaded rows in the browser would hide matches sitting on a
 * page nobody has requested yet, and would put `rows.length` permanently out of step with
 * `totalCount`.
 */
export function usePaginatedCompendiumSearch<Row>(options: {
  enabled?: boolean;
  debounceMs?: number;
  refreshKey: number;
  requestPage: RequestPage<Row>;
  onError?: (error: unknown) => void;
}) {
  const { enabled = true, debounceMs = 220, refreshKey, requestPage, onError } = options;

  const [rows, setRows] = React.useState<Row[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // The in-flight search is tracked in a ref rather than state so loadMore() can keep a stable
  // identity. A scroll handler or IntersectionObserver that had to re-subscribe every time a row
  // was appended would be worse than useless.
  const searchRef = React.useRef({
    // Bumped once per search. A page that resolves under an older generation is discarded.
    generation: 0,
    offset: 0,
    exhausted: true,
    inFlight: false,
    controller: null as AbortController | null,
    requestPage: null as RequestPage<Row> | null,
    onError: undefined as ((error: unknown) => void) | undefined,
  });

  const fetchPage = React.useCallback(async (generation: number) => {
    const search = searchRef.current;
    const request = search.requestPage;
    const controller = search.controller;
    if (!request || !controller || search.inFlight || search.exhausted) return;

    const isFirstPage = search.offset === 0;
    search.inFlight = true;
    if (isFirstPage) setBusy(true);
    else setLoadingMore(true);

    try {
      const page = await request(search.offset, controller.signal);
      if (controller.signal.aborted || searchRef.current.generation !== generation) return;

      search.offset += page.rows.length;
      // An empty page ends the results whatever `total` claims -- otherwise a total that overshoots
      // the real row count would leave the caller asking for the same offset forever.
      search.exhausted = page.rows.length === 0 || search.offset >= page.total;
      setRows((current) => (isFirstPage ? page.rows : [...current, ...page.rows]));
      setTotalCount(page.total || search.offset);
      setHasMore(!search.exhausted);
      setError(null);
    } catch (cause) {
      if (controller.signal.aborted || searchRef.current.generation !== generation) return;
      // Stop paging on failure: re-requesting the same offset on the next scroll tick would spin.
      search.exhausted = true;
      setHasMore(false);
      setError(cause instanceof Error ? cause.message : DEFAULT_ERROR_MESSAGE);
      search.onError?.(cause);
    } finally {
      if (searchRef.current.generation === generation) {
        search.inFlight = false;
        if (isFirstPage) setBusy(false);
        else setLoadingMore(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    const search = searchRef.current;
    const generation = search.generation + 1;

    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      search.generation = generation;
      search.offset = 0;
      search.exhausted = false;
      search.inFlight = false;
      search.controller = controller;
      search.requestPage = requestPage;
      search.onError = onError;

      setRows([]);
      setTotalCount(0);
      setHasMore(false);
      setError(null);
      void fetchPage(generation);
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      // Only abandon the run this effect actually started; if the timer never fired there is
      // nothing in flight to cancel.
      if (search.generation === generation) {
        search.controller?.abort();
        search.exhausted = true;
        search.inFlight = false;
      }
    };
  }, [debounceMs, enabled, fetchPage, onError, refreshKey, requestPage]);

  const loadMore = React.useCallback(() => {
    const search = searchRef.current;
    if (search.exhausted || search.inFlight) return;
    void fetchPage(search.generation);
  }, [fetchPage]);

  return { rows, totalCount, busy, loadingMore, hasMore, loadMore, error };
}
