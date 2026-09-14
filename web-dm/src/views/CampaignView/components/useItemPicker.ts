import React from "react";
import type { CompendiumItemDetail, CompendiumItemRow } from "@/domain/types/compendium";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import { api } from "@/services/api";
import { useItemSearch } from "@/views/CompendiumView/hooks/useItemSearch";
import { useInfiniteScroll } from "@beholden/shared/ui";

const ROW_HEIGHT = 52;

export function useItemPicker(isOpen: boolean) {
  const {
    q,
    setQ,
    rarityFilter,
    setRarityFilter,
    rarityOptions: rawRarityOptions,
    typeFilter,
    setTypeFilter,
    typeOptions: rawTypeOptions,
    setFilterMagic,
    setFilterNonMagic,
    rows: serverRows,
    busy,
    loadingMore,
    hasMore,
    loadMore,
    totalCount,
    refresh,
  } = useItemSearch({ enabled: isOpen });
  const [magicFilter, setMagicFilter] = React.useState<"" | "magic" | "nonmagic">("");

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CompendiumItemDetail | null>(null);
  const [detailCache, setDetailCache] = React.useState<Record<string, CompendiumItemDetail>>({});

  React.useEffect(() => {
    setFilterMagic(magicFilter === "magic");
    setFilterNonMagic(magicFilter === "nonmagic");
  }, [magicFilter, setFilterMagic, setFilterNonMagic]);

  React.useEffect(() => {
    if (!isOpen) return;
    refresh();
  }, [isOpen, refresh]);

  // Reset all state when modal closes
  React.useEffect(() => {
    if (isOpen) return;
    setQ(""); setRarityFilter("all"); setTypeFilter("all"); setMagicFilter("");
    setSelectedId(null); setDetail(null); setDetailCache({});
  }, [isOpen, setQ, setRarityFilter, setTypeFilter]);

  // Fetch detail when selection changes
  React.useEffect(() => {
    if (!isOpen || !selectedId) { setDetail(null); return; }
    const cached = detailCache[selectedId];
    if (cached) {
      setDetail(cached);
      return;
    }
    let alive = true;
    api<CompendiumItemDetail>(`/api/compendium/items/${selectedId}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setDetailCache((prev) => ({ ...prev, [selectedId]: d }));
      })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [isOpen, selectedId, detailCache]);

  const rarityOptions = React.useMemo(
    () => rawRarityOptions.filter((value) => value !== "all"),
    [rawRarityOptions],
  );

  const typeOptions = React.useMemo(
    () => rawTypeOptions.filter((value) => value !== "all"),
    [rawTypeOptions],
  );

  const filtered = serverRows;

  React.useEffect(() => {
    setSelectedId((current) => (current && filtered.some((row) => row.id === current) ? current : null));
  }, [filtered]);

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 6 });
  const scrollRef = vl.scrollRef;

  // The virtual list owns the scroll container; paging watches that same element.
  const { onScroll: onScrollForPaging } = useInfiniteScroll({ hasMore, loadingMore, loadMore, containerRef: scrollRef });
  const onScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    vl.onScroll(event);
    onScrollForPaging(event);
  }, [onScrollForPaging, vl]);

  // Scroll to top when filters change
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, magicFilter, scrollRef]);

  return {
    rows: serverRows as CompendiumItemRow[],
    totalCount,
    loading: busy,
    q, setQ,
    rarity: rarityFilter === "all" ? "" : rarityFilter,
    setRarity: (value: string) => setRarityFilter(value || "all"),
    rarityOptions,
    type: typeFilter === "all" ? "" : typeFilter,
    setType: (value: string) => setTypeFilter(value || "all"),
    typeOptions,
    magicFilter, setMagicFilter,
    selectedId, setSelectedId,
    detail,
    filtered,
    vl,
    onScroll,
    loadingMore,
    ROW_HEIGHT,
  };
}
