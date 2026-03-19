import React from "react";
import { api } from "@/services/api";
import { ordinal } from "@/lib/format/ordinal";
import { normalizeSpellName } from "@/utils/compendiumFormat";

export type GroupedSpell = {
  level: number;
  title: string;
  spells: { key: string; display: string; meta: any }[];
};

function extractSpellNamesFromText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\*([^*]+)\*/g)) {
    const s = m[1].trim();
    if (s) out.push(s);
  }
  return out;
}

function parseSpellNames(monster: any): string[] {
  const v = monster?.spells ?? monster?.raw_json?.spells;
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const x of v) {
      const s = String(x ?? "").trim();
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

function isSpellSection(name: unknown): boolean {
  const s = String(name ?? "");
  return /spellcasting/i.test(s) || /innate spellcasting/i.test(s);
}

export function useMonsterSpells(monster: any | null): {
  spellNames: string[];
  groupedSpells: GroupedSpell[];
  openSpellByName: (name: string) => Promise<void>;
  spellOpen: boolean;
  spellLoading: boolean;
  spellError: string | null;
  spellDetail: any | null;
} {
  const m = monster;

  // Derive spell names from the monster data (stable across renders)
  const { spellNames, spellTextCombined } = React.useMemo(() => {
    if (!m) return { spellNames: [] as string[], spellTextCombined: "" };

    const traitArr: any[] = Array.isArray(m.traits ?? m.trait) ? (m.traits ?? m.trait) : [];
    const actionArr: any[] = Array.isArray(m.actions ?? m.action) ? (m.actions ?? m.action) : [];

    const spellTraits = traitArr.filter((t) => isSpellSection(t?.name ?? t?.title));
    const spellActions = actionArr.filter((a) => isSpellSection(a?.name ?? a?.title));

    const combined = [...spellTraits, ...spellActions]
      .map((x: any) => String(x?.text ?? x?.description ?? ""))
      .filter(Boolean)
      .join("\n");

    const fromMonster = parseSpellNames(m);
    const names = fromMonster.length ? fromMonster : extractSpellNamesFromText(combined);

    return { spellNames: names, spellTextCombined: combined };
  }, [m?.id, m?.name]);

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

    const nextSlots: Record<number, number> = {};
    const slotRegex = /(\d+)(?:st|nd|rd|th)\s+level\s*\((\d+)\s+slots?\)/gi;
    let match: RegExpExecArray | null;
    while ((match = slotRegex.exec(spellTextCombined))) {
      const lvl = Number(match[1]);
      const cnt = Number(match[2]);
      if (Number.isFinite(lvl) && Number.isFinite(cnt)) nextSlots[lvl] = cnt;
    }
    setSlotsByLevel(nextSlots);

    async function loadMeta() {
      const out: Record<string, any> = {};
      for (const name of spellNames) {
        try {
          const q = encodeURIComponent(name);
          const results = await api<any[]>(`/api/spells/search?q=${q}&limit=50`);
          const wantExact = String(name).trim().toLowerCase();
          const base = wantExact.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
          const pick =
            results.find((r) => String(r?.name ?? "").trim().toLowerCase() === wantExact) ??
            results.find((r) => String(r?.name ?? "").trim().toLowerCase() === base) ??
            results[0];
          if (pick?.id) out[name] = pick;
        } catch {
          // ignore — spell not in compendium
        }
      }
      if (!cancelled) setSpellMetaByName(out);
    }

    setSpellMetaByName({});
    if (spellNames.length) void loadMeta();
    return () => { cancelled = true; };
  }, [m?.id, spellTextCombined, spellNames.join("|")]);

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
      byLevel.get(level)!.spells.push({ key, display: String(meta.name ?? key), meta });
    }
    return Array.from(byLevel.keys())
      .sort((a, b) => a - b)
      .map((level) => ({
        ...byLevel.get(level)!,
        spells: byLevel.get(level)!.spells.sort((a, b) => a.display.localeCompare(b.display)),
      }));
  }, [spellNames, spellMetaByName, slotsByLevel]);

  const openSpellByName = React.useCallback(async (name: string) => {
    setSpellOpen(true);
    setSpellLoading(true);
    setSpellError(null);
    setSpellDetail(null);
    try {
      const q = encodeURIComponent(name);
      const results = await api<any[]>(`/api/spells/search?q=${q}&limit=20`);
      const want = normalizeSpellName(name);
      const best =
        results.find((r) => normalizeSpellName(String(r?.name ?? "")) === want) ??
        results[0];
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

  return { spellNames, groupedSpells, openSpellByName, spellOpen, spellLoading, spellError, spellDetail };
}
