import React from "react";

type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;
export type Ruleset = "5e" | "5.5e";
type CompendiumRulesetsResponse = Record<string, Ruleset[]>;

/**
 * Fetches which rulesets have content for a given compendium category (e.g. "monsters", "feats")
 * and picks a sensible default. Used by search/browse UIs that don't go through the shared
 * useItemSearch/useSpellSearch hooks (those embed the same logic directly).
 *
 * The filter should be hidden entirely when only one ruleset has content -- nothing to choose
 * between. Defaults to "all rulesets" (not a specific one) even when both are present: many
 * categories (items especially) don't have a complete duplicate catalog per ruleset, so silently
 * picking one hides content that only exists under the other with no visible indication why.
 */
export function useAvailableRulesets(api: ApiFn, category: string, enabled = true) {
  const [availableRulesets, setAvailableRulesets] = React.useState<Ruleset[]>([]);
  const [rulesetFilter, setRulesetFilter] = React.useState<Ruleset | "">("");

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let alive = true;
    api<CompendiumRulesetsResponse>("/api/compendium/rulesets", { signal: controller.signal })
      .then((data) => {
        if (!alive) return;
        const available = Array.isArray(data?.[category]) ? data[category]! : [];
        setAvailableRulesets(available);
        setRulesetFilter("");
      })
      .catch(() => {
        if (!alive) return;
        setAvailableRulesets([]);
        setRulesetFilter("");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [api, category, enabled]);

  return {
    availableRulesets,
    rulesetFilter,
    setRulesetFilter,
    showRulesetFilter: availableRulesets.length > 1,
  };
}
