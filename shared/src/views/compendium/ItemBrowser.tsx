import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { api } from "../../api/browserClient";
import { useCompendiumItemSearch } from "../../domain/compendium/useItemSearch";
import type { ItemSearchRow } from "../../domain/compendium/itemSearch";
import { useVirtualList } from "../../domain/compendium/monsterPicker";
import { titleCase } from "../../domain/text/titleCase";
import { IconChest } from "../../icons";
import { togglePillStyle } from "../../ui/browserStyles";
import { EmptyState } from "../../ui/EmptyState";
import { ItemListRow } from "../../ui/ItemListRow";
import { ListShell } from "../../ui/ListShell";
import { rarityColor } from "../../ui/RarityDot";
import { useInfiniteScroll } from "../../ui/useInfiniteScroll";
import { useCompendiumHost, useOnRevisionChange, type CompendiumEntryEditing, type Ruleset } from "./CompendiumHost";
import { ACTIVE_ROW_BACKGROUND, BrowserTitle, COMPENDIUM_COLORS as C, COMPENDIUM_ROW_HEIGHT, CompendiumSelect, searchInputStyle } from "./compendiumStyle";
import { BrowserHeaderActions, EntryRowActions } from "./EntryRowActions";

function ItemRow(props: {
  item: ItemSearchRow;
  active: boolean;
  /** Show which ruleset the item belongs to (when the compendium holds more than one). */
  showRuleset: boolean;
  editing?: CompendiumEntryEditing;
  onClick: () => void;
  onError: (message: string) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const [hovered, setHovered] = React.useState(false);
  const { item } = props;
  const subtitle = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? translateUi("Attunement") : null,
    props.showRuleset ? item.ruleset ?? null : null,
  ]
    .filter(Boolean)
    .join(" • ");
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: COMPENDIUM_ROW_HEIGHT,
        borderBottom: `1px solid ${C.panelBorder}`,
        background: props.active ? ACTIVE_ROW_BACKGROUND : "transparent",
        flexShrink: 0,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <ItemListRow
          name={item.name}
          subtitle={subtitle || null}
          rarityColor={item.rarity ? rarityColor(item.rarity, C.muted) : null}
          magic={Boolean(item.magic)}
          magicColor={C.colorMagic}
          active={props.active}
          activeBackground={ACTIVE_ROW_BACKGROUND}
          borderColor={C.panelBorder}
          textColor={C.text}
          mutedColor={C.muted}
          height={COMPENDIUM_ROW_HEIGHT}
          padding="0 10px"
          onClick={props.onClick}
        />
      </div>
      {props.editing && (
        <EntryRowActions editing={props.editing} id={item.id} ruleset={item.ruleset ?? undefined} noun="item" hovered={hovered} onError={props.onError} />
      )}
    </div>
  );
}

export function ItemBrowser(props: {
  selectedItemId?: string | null;
  selectedItemRuleset?: Ruleset | null;
  onSelectItem: (id: string | null, ruleset?: Ruleset | null) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, editing, revision } = useCompendiumHost();
  // Errors are surfaced rather than swallowed: paging stops after a failed page, so a silently
  // dropped error would leave a half-loaded list looking like the complete set of results.
  const search = useCompendiumItemSearch(api, { includeError: true });
  const {
    q, setQ, rarityFilter, setRarityFilter, rarityOptions, typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement, filterMagic, setFilterMagic,
    rulesetFilter, setRulesetFilter, showRulesetFilter, hasActiveFilters, clearFilters,
    rows, busy, totalCount, loadingMore, hasMore, loadMore, error, refresh,
  } = search;
  const [actionError, setActionError] = React.useState<string | null>(null);
  useOnRevisionChange(revision, refresh);

  const virtualList = useVirtualList({ isEnabled: true, rowHeight: COMPENDIUM_ROW_HEIGHT, overscan: 6 });
  const { start, end, padTop, padBottom } = virtualList.getRange(rows.length);
  // The virtual list owns the scroll container, so paging watches that same element.
  const { onScroll: onScrollForPaging } = useInfiniteScroll({ hasMore, loadingMore, loadMore, containerRef: virtualList.scrollRef });
  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    virtualList.onScroll(event);
    onScrollForPaging(event);
  }, [onScrollForPaging, virtualList]);

  // A new search starts from the top of the list.
  React.useEffect(() => {
    const element = virtualList.scrollRef.current;
    if (element) element.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic, rulesetFilter, virtualList.scrollRef]);

  // A new item opens once saved; deleting the open item also closes its detail.
  const itemEditing = React.useMemo<CompendiumEntryEditing | undefined>(() => editing?.items && {
    ...editing.items,
    create: () => editing.items!.create((id, ruleset) => props.onSelectItem(id, ruleset ?? null)),
    remove: async (id, ruleset) => {
      await editing.items!.remove(id, ruleset);
      if (id === props.selectedItemId) props.onSelectItem(null);
    },
  }, [editing?.items, props]);

  const pill = (active: boolean) => togglePillStyle(active, C.highlight, C.panelBorder, C.muted);

  return (
    <Panel
      storageKey="compendium-items"
      title={<BrowserTitle icon={<IconChest size={28} />}>{translateUi("Items")}</BrowserTitle>}
      actions={<BrowserHeaderActions busy={busy} count={totalCount} addTitle={translateUi("New item")} editing={itemEditing} />}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <input value={q} placeholder={translateUi("Search items...")} onChange={(event) => setQ(event.target.value)} style={searchInputStyle} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
        <CompendiumSelect value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)} style={{ width: "100%" }} title={translateUi("Filter by rarity")}>
          {rarityOptions.map((rarity) => (
            <option key={rarity} value={rarity}>{rarity === "all" ? translateUi("All Rarities") : titleCase(rarity)}</option>
          ))}
        </CompendiumSelect>
        <CompendiumSelect value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ width: "100%" }} title={translateUi("Filter by type")}>
          {typeOptions.map((type) => (
            <option key={type} value={type}>{type === "all" ? translateUi("All Types") : type}</option>
          ))}
        </CompendiumSelect>
        {showRulesetFilter && (
          <CompendiumSelect
            value={rulesetFilter}
            onChange={(event) => setRulesetFilter(event.target.value as Ruleset | "")}
            style={{ width: "100%" }}
            title={translateUi("Filter by ruleset")}
          >
            <option value="">{translateUi("All Rulesets")}</option>
            <option value="5.5e">5.5e</option>
            <option value="5e">5e</option>
          </CompendiumSelect>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={pill(filterAttunement)}>{translateUi("Attunement")}</button>
        <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={pill(filterMagic)}>{translateUi("Magic")}</button>
        {hasActiveFilters && <button type="button" onClick={clearFilters} style={pill(false)}>{translateUi("Clear")}</button>}
      </div>

      {actionError && <div role="alert" style={{ color: C.red, padding: "4px 8px", fontSize: "var(--fs-small)" }}>{actionError}</div>}

      <ListShell ref={virtualList.scrollRef} onScroll={handleScroll} borderColor={C.panelBorder}>
        <div style={{ height: padTop }} />
        {rows.slice(start, end).map((item) => (
          <ItemRow
            key={`${item.ruleset ?? ""}:${item.id}`}
            item={item}
            active={item.id === props.selectedItemId && (props.selectedItemRuleset == null || item.ruleset === props.selectedItemRuleset)}
            showRuleset={showRulesetFilter}
            editing={itemEditing}
            onClick={() => props.onSelectItem(item.id, item.ruleset ?? null)}
            onError={setActionError}
          />
        ))}
        <div style={{ height: padBottom }} />
        {loadingMore && <EmptyState textColor={C.muted} style={{ padding: 10 }}>{translateUi("Loading more...")}</EmptyState>}
        {error && <EmptyState textColor={C.red} style={{ padding: 10 }}>{translateUi("Could not load items. Try again.")}</EmptyState>}
        {!busy && !error && rows.length === 0 && <EmptyState textColor={C.muted} style={{ padding: 10 }}>{translateUi("No items found.")}</EmptyState>}
      </ListShell>
    </Panel>
  );
}
