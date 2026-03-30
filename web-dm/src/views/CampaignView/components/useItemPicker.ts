import React from "react";
import { api } from "@/services/api";
import type { CompendiumItemDetail, CompendiumItemRow } from "@/domain/types/compendium";
import { uniqSorted, sortedRarities } from "./ItemPickerModalParts";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";

const ROW_HEIGHT = 52;

export function useItemPicker(isOpen: boolean) {
  const [rows, setRows] = React.useState<CompendiumItemRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [rarity, setRarity] = React.useState("");
  const [type, setType] = React.useState("");
  const [magicFilter, setMagicFilter] = React.useState<"" | "magic" | "nonmagic">("");

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CompendiumItemDetail | null>(null);

  // Fetch item list when modal opens
  React.useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);
    api<CompendiumItemRow[]>("/api/compendium/items")
      .then((r) => { if (alive) setRows(r); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isOpen]);

  // Reset all state when modal closes
  React.useEffect(() => {
    if (isOpen) return;
    setQ(""); setRarity(""); setType(""); setMagicFilter("");
    setSelectedId(null); setDetail(null);
  }, [isOpen]);

  // Fetch detail when selection changes
  React.useEffect(() => {
    if (!isOpen || !selectedId) { setDetail(null); return; }
    let alive = true;
    api<CompendiumItemDetail>(`/api/compendium/items/${selectedId}`)
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [isOpen, selectedId]);

  const rarityOptions = React.useMemo(() =>
    sortedRarities(rows.map((r) => (r.rarity ?? "").trim())), [rows]);

  const typeOptions = React.useMemo(() =>
    uniqSorted(rows.map((r) => (r.type ?? "").trim())), [rows]);

  const filtered = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows
      .filter((r) => !rarity || r.rarity === rarity)
      .filter((r) => !type || r.type === type)
      .filter((r) => !magicFilter || (magicFilter === "magic" ? r.magic : !r.magic))
      .filter((r) => !ql || r.name.toLowerCase().replace(/\s*\[.*?\]\s*$/, "").includes(ql));
  }, [rows, q, rarity, type, magicFilter]);

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 6 });

  // Scroll to top when filters change
  React.useEffect(() => {
    const el = vl.scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarity, type, magicFilter]);

  return {
    rows, loading,
    q, setQ,
    rarity, setRarity, rarityOptions,
    type, setType, typeOptions,
    magicFilter, setMagicFilter,
    selectedId, setSelectedId,
    detail,
    filtered,
    vl,
    ROW_HEIGHT,
  };
}
