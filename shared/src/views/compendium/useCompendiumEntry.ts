import * as React from "react";
import { api } from "../../api/browserClient";
import type { Ruleset } from "./CompendiumHost";

/** The detail URL for one entry, scoped to its ruleset when known (ids can repeat across rulesets). */
export function entryPath(base: string, id: string, ruleset?: Ruleset | null): string {
  return `${base}/${encodeURIComponent(id)}${ruleset ? `?ruleset=${encodeURIComponent(ruleset)}` : ""}`;
}

/**
 * Loads one compendium entry for a detail panel. Reloads when the path or the compendium revision
 * changes, and ignores responses for a selection that has since changed.
 */
export function useCompendiumEntry<T>(path: string | null, revision: number) {
  const [data, setData] = React.useState<T | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setData(null);
    setError(null);
    if (!path) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    api<T>(path)
      .then((value) => { if (!cancelled) setData(value ?? null); })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [path, revision]);

  return { data, busy, error };
}
