import React from "react";
import { api } from "@/services/api";
import { ordinal } from "@/lib/format/ordinal";

type SpellLookupRow = {
  query: string;
  match: { id: string; name: string; level: number | null } | null;
};

export type GroupedSpell = {
  level: number;
  title: string;
  spells: { key: string; display: string; spellId: string | null; meta: any }[];
};

function parseSpellNames(monster: any): string[] {
  const v = monster?.spells ?? monster?.raw_json?.spells;
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const x of v) {
      const rawName = x && typeof x === "object" && "name" in x ? (x as { name?: unknown }).name : x;
      const s = String(rawName ?? "").trim();
      if (!s) continue;
      for (const part of s.split(/[,;]/g)) {
        const p = part.trim();
        if (p) out.push(p);
      }
    }
    return out;
  }
  if (typeof v === "string") return v.split(/[,;]/g).map((x) => x.trim()).filter(Boolean);
  return [];
}

export function useMonsterSpells(monster: any | null): {
  spellNames: string[];
  groupedSpells: GroupedSpell[];
  openSpell: (ref: { id?: string | null; name: string }) => Promise<void>;
  spellOpen: boolean;
  spellLoading: boolean;
  spellError: string | null;
  spellDetail: any | null;
} {
  const m = monster;

  // Derive spell names from the monster data (stable across renders)
  const spellNames = React.useMemo(() => m ? parseSpellNames(m) : [], [m]);

  const [spellMetaByName, setSpellMetaByName] = React.useState<Record<string, any>>({});
  const [slotsByLevel, setSlotsByLevel] = React.useState<Record<number, number>>({});
  const [spellOpen, setSpellOpen] = React.useState(false);
  const [spellLoading, setSpellLoading] = React.useState(false);
  const [spellError, setSpellError] = React.useState<string | null>(null);
  const [spellDetail, setSpellDetail] = React.useState<any>(null);

  // Reset spell detail panel when monster changes
  React.useEffect(() => {
    setSpellOpen(false);
    setSpellLoading(false);
    setSpellError(null);
    setSpellDetail(null);
  }, [m?.id, m?.name]);

  // Parse slot counts and fetch spell metadata
  React.useEffect(() => {
    let cancelled = false;

    setSlotsByLevel({});

    async function loadMeta() {
      const out: Record<string, { id: string; name: string; level: number | null }> = {};
      try {
        const payload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: spellNames }),
        });
        for (const row of payload.rows ?? []) {
          if (!row?.match?.id) continue;
          out[row.query] = row.match;
        }
      } catch {
        // ignore — spell not in compendium
      }
      if (!cancelled) setSpellMetaByName(out);
    }

    setSpellMetaByName({});
    if (spellNames.length) void loadMeta();
    return () => { cancelled = true; };
  }, [m?.id, spellNames]);

  const groupedSpells = React.useMemo((): GroupedSpell[] => {
    const byLevel = new Map<number, GroupedSpell>();
    for (const key of spellNames) {
      const meta = spellMetaByName[key] ?? null;
      const lvl = meta?.level != null ? Number(meta.level) : null;
      if (!Number.isFinite(lvl as number)) continue;
      const level = lvl as number;
      if (!byLevel.has(level)) {
        const slot = slotsByLevel[level];
        const title =
          level === 0
            ? "Cantrips (at will)"
            : slot
              ? `${ordinal(level)} level (${slot} slots)`
              : `${ordinal(level)} level`;
        byLevel.set(level, { level, title, spells: [] });
      }
      byLevel.get(level)!.spells.push({ key, display: String(meta.name ?? key), spellId: meta?.id ? String(meta.id) : null, meta });
    }
    return Array.from(byLevel.keys())
      .sort((a, b) => a - b)
      .map((level) => ({
        ...byLevel.get(level)!,
        spells: byLevel.get(level)!.spells.sort((a, b) => a.display.localeCompare(b.display)),
      }));
  }, [spellNames, spellMetaByName, slotsByLevel]);

  const openSpell = React.useCallback(async (ref: { id?: string | null; name: string }) => {
    setSpellOpen(true);
    setSpellLoading(true);
    setSpellError(null);
    setSpellDetail(null);
    try {
      const directId = ref.id ? String(ref.id) : "";
      if (directId) {
        const detail = await api<any>(`/api/spells/${directId}`);
        setSpellDetail(detail);
        return;
      }
      const payload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: [ref.name] }),
      });
      const best = payload.rows?.[0]?.match ?? null;
      if (!best?.id) {
        setSpellError("Spell not found in compendium.");
        return;
      }
      const detail = await api<any>(`/api/spells/${best.id}`);
      setSpellDetail(detail);
    } catch (e: any) {
      setSpellError(String(e?.message ?? "Failed to load spell."));
    } finally {
      setSpellLoading(false);
    }
  }, []);

  return { spellNames, groupedSpells, openSpell, spellOpen, spellLoading, spellError, spellDetail };
}
