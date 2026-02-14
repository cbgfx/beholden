import type { MonsterDetail, SpellSummary } from "@/views/CombatView/types";

export function parseMonsterSpells(detail: MonsterDetail | null): string[] {
  if (!detail) return [];

  // The server imports monsters from Fight Club XML and preserves `spells` as either:
  // - an array of spell names
  // - a CSV/semicolon-separated string
  // And we may receive them either on the top-level monster record or inside `raw_json`.
  const raw = (detail as any)?.raw_json ?? {};
  const v = (raw as any)?.spells ?? (detail as any)?.spells;

  const out: string[] = [];
  const push = (name: any) => {
    const s = String(name ?? "").trim();
    if (!s) return;
    // Some sources may pack multiple spells into one string.
    for (const part of s.split(/[,;]/g)) {
      const n = part.trim();
      if (n) out.push(n);
    }
  };

  if (Array.isArray(v)) {
    for (const item of v) {
      // Sometimes the array contains objects; prefer a `name` field.
      if (item && typeof item === "object" && "name" in (item as any)) push((item as any).name);
      else push(item);
    }
  } else if (typeof v === "string") {
    push(v);
  }

  // De-dupe while keeping stable order.
  const seen = new Set<string>();
  const uniq: string[] = [];
  for (const s of out) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(s);
  }
  return uniq;
}

export function bestSpellMatch(rows: SpellSummary[], name: string): SpellSummary | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const exact = rows.find((r) => String(r.name).trim().toLowerCase() === n);
  if (exact) return exact;
  const starts = rows.find((r) => String(r.name).trim().toLowerCase().startsWith(n));
  return starts ?? rows[0] ?? null;
}

export function sortSpellNames(names: string[], levelCache: Record<string, number | null | undefined>): string[] {
  const rows = [...names];
  rows.sort((a, b) => {
    const al = levelCache[a.trim().toLowerCase()] ?? 99;
    const bl = levelCache[b.trim().toLowerCase()] ?? 99;
    if (al !== bl) return al - bl;
    return a.localeCompare(b);
  });
  return rows;
}
