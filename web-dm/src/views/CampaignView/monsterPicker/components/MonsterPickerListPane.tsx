import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import * as React from "react";
import { EmptyState, ListShell } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { CompendiumMonsterRow, AttackOverridesByMonsterId } from "@/views/CampaignView/monsterPicker/types";
import { MonsterFilters } from "@beholden/shared/views/compendium/MonsterFilters";
import { LettersBar } from "@/views/CampaignView/monsterPicker/components/LettersBar";
import { MonsterRow } from "@/views/CampaignView/monsterPicker/components/MonsterRow";
import type { SortMode } from "@/views/CampaignView/monsterPicker/types";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";

/** A row whose window is still in flight: keeps the list the right height while it arrives. */
function MonsterRowPlaceholder() {
  return (
    <div
      aria-hidden
      style={{
        height: 86,
        marginBottom: 8,
        borderRadius: theme.radius.control,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.panelBg,
        opacity: 0.4,
      }}
    />
  );
}

export function MonsterPickerListPane(props: {
  isOpen: boolean;
  compQ: string;
  onChangeCompQ: (q: string) => void;
  sortMode: SortMode;
  onChangeSortMode: (s: SortMode) => void;
  envFilter: string;
  onChangeEnvFilter: (e: string) => void;
  envOptions: string[];
  sizeFilter: string;
  onChangeSizeFilter: (s: string) => void;
  sizeOptions: string[];
  typeFilter: string;
  onChangeTypeFilter: (t: string) => void;
  typeOptions: string[];
  crMin: string;
  crMax: string;
  onChangeCrMin: (v: string) => void;
  onChangeCrMax: (v: string) => void;
  onClear: () => void;
  rulesetFilter?: "5e" | "5.5e" | "";
  onChangeRulesetFilter?: (r: "5e" | "5.5e" | "") => void;
  showRulesetFilter?: boolean;
  loadingIndex: boolean;
  indexError: string | null;
  /** Sparse: as long as `totalRows`, with holes where that window has not been fetched. */
  rows: (CompendiumMonsterRow | undefined)[];
  totalRows: number;
  ensureRange: (start: number, end: number) => void;
  selectedMonsterId: string | null;
  onSelectMonster: (id: string) => void;
  lettersInList: string[];
  onJumpToLetter: (letter: string) => void;
  qtyById: Record<string, number>;
  setQtyForId: (id: string, qty: number) => void;
  labelById: Record<string, string>;
  acById: Record<string, string>;
  acDetailById: Record<string, string>;
  hpById: Record<string, string>;
  hpDetailById: Record<string, string>;
  friendlyById: Record<string, boolean>;
  attackOverridesById: AttackOverridesByMonsterId;
  onAddMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
  onProvideScrollToIndex?: (fn: (idx: number) => void) => void;
}) {
  const translateUi = useUiTranslation("dmUi");
  // Row is 86px tall + 8px bottom gap in MonsterRow.
  const ROW_HEIGHT = 94;
  const v = useVirtualList({ isEnabled: props.isOpen, rowHeight: ROW_HEIGHT, overscan: 6 });
  const onProvideScrollToIndex = props.onProvideScrollToIndex;

  // The list is as tall as the whole result, not as what has been fetched, so the scrollbar and the
  // A-Z jump address every match. Whatever the viewport is over gets loaded.
  const visible = v.getRange(props.totalRows);
  const { ensureRange, totalRows } = props;
  React.useEffect(() => {
    if (totalRows > 0) ensureRange(visible.start, visible.end);
  }, [ensureRange, totalRows, visible.start, visible.end]);

  React.useEffect(() => {
    onProvideScrollToIndex?.(v.scrollToIndex);
  }, [onProvideScrollToIndex, v.scrollToIndex]);

  const renderRows = () => {
    if (!props.totalRows) return null;

    const { start, end, padTop, padBottom } = visible;
    const items = props.rows.slice(start, end);

    return (
      <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
        {items.map((m, offset) => {
          if (!m) return <MonsterRowPlaceholder key={`pending-${start + offset}`} />;
          const qty = props.qtyById[m.id] ?? 1;
          const active = m.id === props.selectedMonsterId;
          return (
            <MonsterRow
              key={m.id}
              row={m}
              active={active}
              qty={qty}
              onSelect={() => props.onSelectMonster(m.id)}
              onChangeQty={(n) => props.setQtyForId(m.id, n)}
              labelBase={props.labelById[m.id] ?? m.name}
              acRaw={props.acById[m.id] ?? ""}
              acDetail={props.acDetailById[m.id] ?? ""}
              hpRaw={props.hpById[m.id] ?? ""}
              hpDetail={props.hpDetailById[m.id] ?? ""}
              friendly={props.friendlyById[m.id] ?? false}
              attackOverridesById={props.attackOverridesById}
              onSetLabelBase={() => {
                // kept for parity; label is edited on right panel
              }}
              onAddMonster={props.onAddMonster}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        borderRight: `1px solid ${theme.colors.panelBorder}`,
        paddingRight: 14,
        minHeight: 0,
      }}
    >
      <MonsterFilters
        compQ={props.compQ}
        onChangeCompQ={props.onChangeCompQ}
        sortMode={props.sortMode}
        onChangeSortMode={props.onChangeSortMode}
        envFilter={props.envFilter}
        onChangeEnvFilter={props.onChangeEnvFilter}
        envOptions={props.envOptions}
        sizeFilter={props.sizeFilter}
        onChangeSizeFilter={props.onChangeSizeFilter}
        sizeOptions={props.sizeOptions}
        typeFilter={props.typeFilter}
        onChangeTypeFilter={props.onChangeTypeFilter}
        typeOptions={props.typeOptions}
        crMin={props.crMin}
        crMax={props.crMax}
        onChangeCrMin={props.onChangeCrMin}
        onChangeCrMax={props.onChangeCrMax}
        onClear={props.onClear}
        rulesetFilter={props.rulesetFilter}
        onChangeRulesetFilter={props.onChangeRulesetFilter}
        showRulesetFilter={props.showRulesetFilter}
      />

      <ListShell
        style={{
          border: "none",
          borderRadius: 0,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          paddingRight: 22,
          position: "relative",
        }}
        ref={v.scrollRef}
        onScroll={v.onScroll as React.UIEventHandler<HTMLDivElement>}
      >
        {renderRows()}

        {props.loadingIndex ? (
          <EmptyState textColor={theme.colors.muted}>{translateUi("Loading compendium...")}</EmptyState>
        ) : props.indexError ? (
          <EmptyState textColor={theme.colors.red} style={{ fontWeight: 700 }}>
            {translateUi("Failed to load compendium:")} {props.indexError}
          </EmptyState>
        ) : !props.rows.length ? (
          <EmptyState textColor={theme.colors.muted}>{translateUi("No results.")}</EmptyState>
        ) : null}

        <LettersBar letters={props.lettersInList} onJump={props.onJumpToLetter} />
      </ListShell>
    </div>
  );
}
