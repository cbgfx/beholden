import React from "react";
import { api } from "@/services/api";
import { normalizeSpellSearchRow, SpellSearchRow } from "@/domain/compendium/normalizeSpellSearchRow";

export function useSpellSearch() {
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState<string>("all");
  const [rows, setRows] = React.useState<SpellSearchRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setBusy(true);
      try {
        const lv = level === "all" ? "" : `&level=${encodeURIComponent(level)}`;
        const res = await api<any[]>(`/api/spells/search?q=${encodeURIComponent(q)}&limit=500${lv}`);
        if (cancelled) return;

        const cleaned = (Array.isArray(res) ? res : [])
          .map(normalizeSpellSearchRow)
          .filter((r): r is SpellSearchRow => Boolean(r));

        setRows(cleaned);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    const t = window.setTimeout(run, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, level]);

  return { q, setQ, level, setLevel, rows, busy };
}
