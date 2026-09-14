import React from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { C, withAlpha } from "@/lib/theme";
import { titleCase } from "@beholden/shared/domain/text/titleCase";
import { useItemSearch, type ItemSearchRow } from "@/views/CompendiumView/hooks/useItemSearch";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import { IconChest } from "@/ui/Icons";
import { EmptyState, ItemListRow, ListShell, togglePillStyle, useInfiniteScroll } from "@beholden/shared/ui";

const ROW_HEIGHT = 52;

function rarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":    return C.muted;
    case "uncommon":  return "#1eff00";
    case "rare":      return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact":  return "#e6cc80";
    default:          return C.muted;
  }
}

export function ItemsBrowserPanel(props: {
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const {
    q, setQ,
    rarityFilter, setRarityFilter, rarityOptions,
    typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement,
    filterMagic, setFilterMagic,
    rulesetFilter, setRulesetFilter, showRulesetFilter,
    hasActiveFilters, clearFilters,
    rows, busy, totalCount, loadingMore, hasMore, loadMore, error,
  } = useItemSearch();

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 6 });
  const scrollRef = vl.scrollRef;
  const { start, end, padTop, padBottom } = vl.getRange(rows.length);

  // The virtual list owns the scroll container, so paging watches that same element rather than
  // creating one of its own.
  const { onScroll: onScrollForPaging } = useInfiniteScroll({ hasMore, loadingMore, loadMore, containerRef: scrollRef });
  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    vl.onScroll(event);
    onScrollForPaging(event);
  }, [onScrollForPaging, vl]);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic, rulesetFilter, scrollRef]);

  return (
    <Panel
      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}><IconChest size={28} /><span>{t("compendiumItems.title")}</span></span>}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{busy ? t("compendiumItems.loading") : totalCount}</div>}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input
        value={q} placeholder={t("compendiumItems.searchPlaceholder")} onChange={(e) => setQ(e.target.value)}
        style={{
          background: C.panelBg, color: C.text, border: `1px solid ${C.panelBorder}`,
          borderRadius: 10, padding: "8px 10px", outline: "none",
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <Select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} style={{ width: "100%" }}>
          {rarityOptions.map((r) => (
            <option key={r} value={r}>{r === "all" ? t("compendiumItems.allRarities") : titleCase(r)}</option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }}>
          {typeOptions.map((ty) => (
            <option key={ty} value={ty}>{ty === "all" ? t("compendiumItems.allTypes") : ty}</option>
          ))}
        </Select>
        {showRulesetFilter && (
          <Select value={rulesetFilter} onChange={(e) => setRulesetFilter(e.target.value as "5e" | "5.5e" | "")} style={{ width: "100%" }}>
            <option value="">{t("compendiumItems.allRulesets")}</option>
            <option value="5.5e">5.5e</option>
            <option value="5e">5e</option>
          </Select>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={togglePillStyle(filterAttunement, C.accentHl, C.panelBorder, C.muted)}>
          {t("compendiumItems.attunement")}
        </button>
        <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={togglePillStyle(filterMagic, C.accentHl, C.panelBorder, C.muted)}>
          {t("compendiumItems.magic")}
        </button>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} style={togglePillStyle(false, C.accentHl, C.panelBorder, C.muted)}>{t("compendiumItems.clear")}</button>
        )}
      </div>

      <ListShell ref={vl.scrollRef} onScroll={handleScroll} borderColor={C.panelBorder}>
        <div style={{ height: padTop }} />
        {rows.slice(start, end).map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            active={item.id === (props.selectedItemId ?? "")}
            onClick={() => props.onSelectItem?.(item.id)}
          />
        ))}
        <div style={{ height: padBottom }} />
        {loadingMore && (
          <div style={{ padding: 10, color: C.muted }}>{t("compendiumItems.loadingMore")}</div>
        )}
        {/* Paging stops on a failed page, so say so -- an empty list would otherwise read as
            "no such item" rather than "the request failed". */}
        {error && (
          <div style={{ padding: 10, color: C.red }}>{t("compendiumItems.loadFailed")}</div>
        )}
        {!busy && !error && rows.length === 0 && (
          <EmptyState textColor={C.muted} style={{ padding: 10 }}>{t("compendiumItems.noItemsFound")}</EmptyState>
        )}
      </ListShell>
    </Panel>
  );
}

function ItemRow({ item, active, onClick }: { item: ItemSearchRow; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const subtitle = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? t("compendiumItems.attunement") : null,
  ].filter(Boolean).join(" • ");

  return (
    <ItemListRow
      name={item.name}
      subtitle={subtitle || null}
      rarityColor={item.rarity ? rarityColor(item.rarity) : null}
      magic={!!item.magic}
      magicColor={C.colorMagic}
      active={active}
      onClick={onClick}
      height={ROW_HEIGHT}
      padding="0 12px"
      textColor={C.text}
      mutedColor={C.muted}
      borderColor={C.panelBorder}
      activeBackground={withAlpha(C.accentHl, 0.16)}
    />
  );
}
