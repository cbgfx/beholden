import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { useMonsterBrowser } from "../../domain/compendium/useMonsterBrowser";
import { useVirtualList, type CompendiumMonsterRow } from "../../domain/compendium/monsterPicker";
import { formatCr } from "../../domain/monsters";
import { withAlpha } from "../../ui/colors";
import { IconMonster } from "../../icons";
import { EmptyState } from "../../ui/EmptyState";
import { ListShell } from "../../ui/ListShell";
import { useCompendiumHost, useOnRevisionChange, type CompendiumEntryEditing, type Ruleset } from "./CompendiumHost";
import { ACTIVE_ROW_BACKGROUND, BrowserTitle, COMPENDIUM_COLORS as C, COMPENDIUM_ROW_HEIGHT, plainPillStyle } from "./compendiumStyle";
import { BrowserHeaderActions, EntryRowActions } from "./EntryRowActions";
import { MonsterFilters } from "./MonsterFilters";

/** Stands in for a row whose window hasn't arrived yet, so the list keeps its geometry. */
function MonsterRowPlaceholder() {
  return (
    <div style={{ height: COMPENDIUM_ROW_HEIGHT, borderBottom: `1px solid ${C.panelBorder}`, display: "flex", alignItems: "center", padding: "0 10px", flexShrink: 0 }}>
      <div style={{ height: 10, width: "40%", borderRadius: 5, background: withAlpha(C.muted, 0.18) }} />
    </div>
  );
}

function MonsterRow(props: {
  row: CompendiumMonsterRow;
  active: boolean;
  /** Show which ruleset the monster belongs to (when the compendium holds more than one). */
  showRuleset: boolean;
  editing?: CompendiumEntryEditing;
  onClick: () => void;
  onError: (message: string) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const { row } = props;
  const type = row.type ? String(row.type).charAt(0).toUpperCase() + String(row.type).slice(1) : null;
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
      <button
        type="button"
        onClick={props.onClick}
        style={{
          flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 10px", border: "none", background: "transparent", color: C.text, cursor: "pointer", textAlign: "left", minWidth: 0,
        }}
      >
        <div style={{ fontWeight: 700, lineHeight: 1.15 }}>{row.name}</div>
        <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
          {row.cr != null ? `CR ${formatCr(row.cr)}` : "CR -"}
          {type ? ` • ${type}` : ""}
          {row.environment ? ` • ${row.environment}` : ""}
          {props.showRuleset && row.ruleset ? ` • ${row.ruleset}` : ""}
        </div>
      </button>
      {props.editing && (
        <EntryRowActions editing={props.editing} id={row.id} ruleset={row.ruleset ?? undefined} noun="monster" hovered={hovered} onError={props.onError} />
      )}
    </div>
  );
}

export function MonsterBrowser(props: {
  selectedMonsterId: string | null;
  selectedMonsterRuleset?: Ruleset | null;
  onSelectMonster: (id: string | null, ruleset?: Ruleset | null) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, editing, revision } = useCompendiumHost();
  const browser = useMonsterBrowser();
  const { rows, loading, loadError, totalRows, ensureRange, typeOptions, refresh, lettersInList, letterFirstIndex } = browser;
  const [actionError, setActionError] = React.useState<string | null>(null);
  useOnRevisionChange(revision, refresh);

  const virtualList = useVirtualList({ isEnabled: true, rowHeight: COMPENDIUM_ROW_HEIGHT, overscan: 8 });
  // The list is sized by the server's total, not by how many rows have been fetched, so the
  // scrollbar and the A-Z jump both address the whole result set.
  const { start, end, padTop, padBottom } = virtualList.getRange(totalRows);

  // Fetch whatever window the viewport is over. Scrolling changes `start`/`end`, so this covers
  // both dragging the scrollbar and jumping straight to a letter.
  React.useEffect(() => {
    if (totalRows > 0) ensureRange(start, end);
  }, [ensureRange, start, end, totalRows]);

  // The filtered total can't tell an empty catalogue from a filter that matched nothing, so lean on
  // the facet lists: they come back empty only when there are no monsters at all.
  const hasAnyMonsters = typeOptions.length > 1;

  // A new monster opens once saved; deleting the open monster also closes its stat block.
  const monsterEditing = React.useMemo<CompendiumEntryEditing | undefined>(() => editing?.monsters && {
    ...editing.monsters,
    create: () => editing.monsters!.create((id, ruleset) => props.onSelectMonster(id, ruleset ?? null)),
    remove: async (id, ruleset) => {
      await editing.monsters!.remove(id, ruleset);
      if (id === props.selectedMonsterId) props.onSelectMonster(null);
    },
  }, [editing?.monsters, props]);

  const clearFilters = () => {
    browser.setCompQ("");
    browser.setSortMode("az");
    browser.setEnvFilter("all");
    browser.setSizeFilter("all");
    browser.setTypeFilter("all");
    browser.setCrMin("");
    browser.setCrMax("");
  };

  return (
    <Panel
      storageKey="compendium-monsters"
      title={<BrowserTitle icon={<IconMonster size={28} />}>{translateUi("Monsters")}</BrowserTitle>}
      actions={<BrowserHeaderActions busy={loading} count={totalRows} addTitle={translateUi("New monster")} editing={monsterEditing} />}
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <MonsterFilters
        compQ={browser.compQ}
        onChangeCompQ={browser.setCompQ}
        sortMode={browser.sortMode}
        onChangeSortMode={browser.setSortMode}
        envFilter={browser.envFilter}
        onChangeEnvFilter={browser.setEnvFilter}
        envOptions={browser.envOptions}
        sizeFilter={browser.sizeFilter}
        onChangeSizeFilter={browser.setSizeFilter}
        sizeOptions={browser.sizeOptions}
        typeFilter={browser.typeFilter}
        onChangeTypeFilter={browser.setTypeFilter}
        typeOptions={browser.typeOptions}
        crMin={browser.crMin}
        crMax={browser.crMax}
        onChangeCrMin={browser.setCrMin}
        onChangeCrMax={browser.setCrMax}
        rulesetFilter={browser.rulesetFilter}
        onChangeRulesetFilter={browser.setRulesetFilter}
        showRulesetFilter={browser.showRulesetFilter}
        onClear={clearFilters}
      />

      {actionError && <div role="alert" style={{ color: C.red, padding: "4px 8px", fontSize: "var(--fs-small)" }}>{actionError}</div>}

      {lettersInList.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {lettersInList.map((letter) => (
            <button
              key={letter}
              type="button"
              title={translateUi("Jump to {{value1}}", { value1: letter })}
              onClick={() => {
                const index = letterFirstIndex[letter];
                const element = virtualList.scrollRef.current;
                if (index != null && element) element.scrollTop = index * COMPENDIUM_ROW_HEIGHT;
              }}
              style={plainPillStyle}
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      <ListShell ref={virtualList.scrollRef} onScroll={virtualList.onScroll as React.UIEventHandler<HTMLDivElement>} borderColor={C.panelBorder}>
        {loadError && <EmptyState textColor={C.red} style={{ padding: 12 }}>{translateUi("Failed to load: {{value1}}", { value1: loadError })}</EmptyState>}
        {!loading && !loadError && totalRows === 0 && (
          <EmptyState textColor={C.muted} style={{ padding: 12 }}>
            {hasAnyMonsters ? translateUi("No monsters match the current filters.") : translateUi("No monsters in the compendium yet.")}
          </EmptyState>
        )}
        {totalRows > 0 && (
          <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
            {rows.slice(start, end).map((monster, offset) => (
              monster ? (
                <MonsterRow
                  key={`${monster.ruleset ?? ""}:${monster.id}`}
                  row={monster}
                  active={monster.id === props.selectedMonsterId && (props.selectedMonsterRuleset == null || monster.ruleset === props.selectedMonsterRuleset)}
                  showRuleset={browser.showRulesetFilter}
                  editing={monsterEditing}
                  onClick={() => props.onSelectMonster(monster.id, monster.ruleset ?? null)}
                  onError={setActionError}
                />
              ) : (
                <MonsterRowPlaceholder key={`pending-${start + offset}`} />
              )
            ))}
          </div>
        )}
      </ListShell>
    </Panel>
  );
}
