import * as React from "react";
import { api } from "../../api/browserClient";

type SpellLookupRow = {
  query: string;
  match: { id: string; name: string; level: number | null } | null;
};

export type SpellDetailText = { name: string; text?: string | string[] | null };

/** The monster's spells that were found in the compendium, grouped by spell level. */
export type GroupedSpell = {
  level: number;
  spells: Array<{ key: string; display: string; spellId: string | null }>;
};

/** The spell names a monster lists, split on commas and semicolons. */
function parseSpellNames(monster: Record<string, unknown>): string[] {
  const raw = (monster.spells ?? (monster.raw_json as Record<string, unknown> | undefined)?.spells) as unknown;
  const names = Array.isArray(raw)
    ? raw.map((entry) => (entry && typeof entry === "object" && "name" in entry ? (entry as { name?: unknown }).name : entry))
    : typeof raw === "string" ? [raw] : [];
  return names.flatMap((name) => String(name ?? "").split(/[,;]/g)).map((name) => name.trim()).filter(Boolean);
}

function spellLookup(names: string[], ruleset: "5e" | "5.5e" | undefined) {
  return api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names, ruleset }),
  });
}

/**
 * Looks up a monster's spells in the compendium (for their levels) and loads one spell's text on
 * demand. A monster's spells are not individually ruleset-tagged: the monster's own ruleset applies.
 */
export function useMonsterSpells(monster: Record<string, unknown> | null) {
  const ruleset = monster?.ruleset === "5e" || monster?.ruleset === "5.5e" ? monster.ruleset : undefined;
  const spellNames = React.useMemo(() => (monster ? parseSpellNames(monster) : []), [monster]);

  const [matches, setMatches] = React.useState<Record<string, { id: string; name: string; level: number | null }>>({});
  const [spellOpen, setSpellOpen] = React.useState(false);
  const [spellLoading, setSpellLoading] = React.useState(false);
  const [spellError, setSpellError] = React.useState<string | null>(null);
  const [spellDetail, setSpellDetail] = React.useState<SpellDetailText | null>(null);

  // A different monster closes whatever spell was open.
  const monsterKey = `${String(monster?.id ?? "")}:${String(monster?.name ?? "")}`;
  React.useEffect(() => {
    setSpellOpen(false);
    setSpellLoading(false);
    setSpellError(null);
    setSpellDetail(null);
  }, [monsterKey]);

  React.useEffect(() => {
    let cancelled = false;
    setMatches({});
    if (!spellNames.length) return;
    spellLookup(spellNames, ruleset)
      .then((payload) => {
        if (cancelled) return;
        const found: Record<string, { id: string; name: string; level: number | null }> = {};
        for (const row of payload.rows ?? []) if (row?.match?.id) found[row.query] = row.match;
        setMatches(found);
      })
      .catch(() => {
        // Spells missing from the compendium are simply not listed.
      });
    return () => { cancelled = true; };
  }, [spellNames, ruleset]);

  const groupedSpells = React.useMemo((): GroupedSpell[] => {
    const byLevel = new Map<number, GroupedSpell>();
    for (const key of spellNames) {
      const match = matches[key];
      const level = match?.level != null ? Number(match.level) : NaN;
      if (!match || !Number.isFinite(level)) continue;
      if (!byLevel.has(level)) byLevel.set(level, { level, spells: [] });
      byLevel.get(level)!.spells.push({ key, display: match.name ?? key, spellId: match.id ?? null });
    }
    return [...byLevel.values()]
      .sort((a, b) => a.level - b.level)
      .map((group) => ({ ...group, spells: group.spells.sort((a, b) => a.display.localeCompare(b.display)) }));
  }, [spellNames, matches]);

  const openSpell = React.useCallback(async (ref: { id?: string | null; name: string }) => {
    setSpellOpen(true);
    setSpellLoading(true);
    setSpellError(null);
    setSpellDetail(null);
    try {
      const rulesetParam = ruleset ? `?ruleset=${ruleset}` : "";
      const id = ref.id || (await spellLookup([ref.name], ruleset)).rows?.[0]?.match?.id;
      if (!id) {
        setSpellError("not-found");
        return;
      }
      setSpellDetail(await api<SpellDetailText>(`/api/spells/${encodeURIComponent(id)}${rulesetParam}`));
    } catch (error) {
      setSpellError(error instanceof Error ? error.message : String(error));
    } finally {
      setSpellLoading(false);
    }
  }, [ruleset]);

  return { spellNames, groupedSpells, openSpell, spellOpen, spellLoading, spellError, spellDetail };
}

export type MonsterSpells = ReturnType<typeof useMonsterSpells>;
