import React from "react";

export type CompendiumApi = <T>(path: string, init?: RequestInit) => Promise<T>;
export type CompendiumRuleset = "5e" | "5.5e";

type Page<Row> = { rows: Row[]; total: number };

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

export function usePaginatedCompendiumSearch<Row>(options: {
  enabled?: boolean;
  debounceMs?: number;
  refreshKey: number;
  requestPage: (offset: number, signal: AbortSignal) => Promise<Page<Row>>;
  onError?: (error: unknown) => void;
}) {
  const { enabled = true, debounceMs = 220, refreshKey, requestPage, onError } = options;
  const [rows, setRows] = React.useState<Row[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const merged: Row[] = [];
        let total = 0;
        let offset = 0;
        while (!controller.signal.aborted) {
          const page = await requestPage(offset, controller.signal);
          if (controller.signal.aborted) return;
          total = page.total;
          merged.push(...page.rows);
          if (page.rows.length === 0 || merged.length >= 10_000) break;
          offset += page.rows.length;
          if (offset >= total) break;
        }
        setRows(merged);
        setTotalCount(total || merged.length);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotalCount(0);
        onError?.(error);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [debounceMs, enabled, onError, refreshKey, requestPage]);

  return { rows, totalCount, busy };
}
