import * as React from "react";
import { theme } from "@/theme/theme";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { CompendiumMonsterRow, AttackOverridesByMonsterId } from "@/views/CampaignView/monsterPicker/types";
import { MonsterPickerFilters } from "@/views/CampaignView/monsterPicker/components/MonsterPickerFilters";
import { LettersBar } from "@/views/CampaignView/monsterPicker/components/LettersBar";
import { MonsterRow } from "@/views/CampaignView/monsterPicker/components/MonsterRow";
import type { SortMode } from "@/views/CampaignView/monsterPicker/types";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";

export function MonsterPickerListPane(props: {
  isOpen: boolean;
  compQ: string;
  onChangeCompQ: (q: string) => void;
  sortMode: SortMode;
  onChangeSortMode: (s: SortMode) => void;
  envFilter: string;
  onChangeEnvFilter: (e: string) => void;
  envOptions: string[];
  crMin: string;
  crMax: string;
  onChangeCrMin: (v: string) => void;
  onChangeCrMax: (v: string) => void;
  onQuickCr: (min: string, max: string) => void;
  onClear: () => void;

  loadingIndex: boolean;
  indexError: string | null;

  rows: CompendiumMonsterRow[];
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
  const ROW_HEIGHT = 86;
  const v = useVirtualList({ isEnabled: props.isOpen, rowHeight: ROW_HEIGHT, overscan: 6 });

  React.useEffect(() => {
    props.onProvideScrollToIndex?.(v.scrollToIndex);
  }, [props.onProvideScrollToIndex, v.scrollToIndex]);

  const renderRows = () => {
    const total = props.rows.length;
    if (!total) return null;

    const { start, end, padTop, padBottom } = v.getRange(total);
    const items = props.rows.slice(start, end);

    return (
      <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
        {items.map((m) => {
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
                /* kept for parity; label is edited on right panel */
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
        minHeight: 0
      }}
    >
      <MonsterPickerFilters
        compQ={props.compQ}
        onChangeCompQ={props.onChangeCompQ}
        sortMode={props.sortMode}
        onChangeSortMode={props.onChangeSortMode}
        envFilter={props.envFilter}
        onChangeEnvFilter={props.onChangeEnvFilter}
        envOptions={props.envOptions}
        crMin={props.crMin}
        crMax={props.crMax}
        onChangeCrMin={props.onChangeCrMin}
        onChangeCrMax={props.onChangeCrMax}
        onQuickCr={props.onQuickCr}
        onClear={props.onClear}
      />

      <div
        style={{ flex: 1, minHeight: 0, overflow: "auto", paddingRight: 22, position: "relative" }}
        ref={v.scrollRef}
        onScroll={v.onScroll}
      >
        {renderRows()}

        {props.loadingIndex ? (
          <div style={{ color: theme.colors.muted }}>Loading compendium…</div>
        ) : props.indexError ? (
          <div style={{ color: theme.colors.red, fontWeight: 700 }}>Failed to load compendium: {props.indexError}</div>
        ) : !props.rows.length ? (
          <div style={{ color: theme.colors.muted }}>No results.</div>
        ) : null}

        <LettersBar letters={props.lettersInList} onJump={props.onJumpToLetter} />
      </div>
    </div>
  );
}
