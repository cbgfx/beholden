import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import * as React from "react";
import { EmptyState, ListShell } from "@beholden/shared/ui";
import { useMonsterBrowser } from "@beholden/shared/domain/compendium/useMonsterBrowser";
import { Panel } from "@/ui/Panel";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import { IconPencil, IconTrash } from "@/icons";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import { MonsterPickerFilters } from "@/views/CampaignView/monsterPicker/components/MonsterPickerFilters";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";
import { MonsterFormModal, type MonsterForEdit } from "@/views/CompendiumView/panels/MonsterFormModal";
import { MonsterCreateChoiceModal, MonsterDuplicatePickerModal } from "./MonsterBrowserModals";
import { BrowserAddButton } from "./browserParts";

const ROW_HEIGHT = 52;

/** Stands in for a row whose window hasn't arrived yet, so the list keeps its geometry. */
function MonsterRowPlaceholder() {
  return (
    <div
      style={{
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        flexShrink: 0,
      }}
    >
      <div style={{ height: 10, width: "40%", borderRadius: 5, background: withAlpha(theme.colors.muted, 0.18) }} />
    </div>
  );
}

function MonsterBrowserRow(props: {
  row: CompendiumMonsterRow;
  active: boolean;
  editable: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deleteBusy: boolean;
}) {
  const translateUi = useUiTranslation("dmUi");
  const monster = props.row;
  const [hovered, setHovered] = React.useState(false);
  const crLabel = monster.cr != null ? `CR ${formatCr(monster.cr)}` : "CR -";
  const type = monster.type ? String(monster.type).charAt(0).toUpperCase() + String(monster.type).slice(1) : null;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: ROW_HEIGHT,
        borderBottom: `1px solid ${theme.colors.panelBorder}`,
        background: props.active ? withAlpha(theme.colors.accentHighlight, 0.18) : "transparent",
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={props.onClick}
        style={{
          flex: 1,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 10px",
          border: "none",
          background: "transparent",
          color: theme.colors.text,
          cursor: "pointer",
          textAlign: "left",
          minWidth: 0,
        }}
      >
        <div style={{ fontWeight: 700, lineHeight: 1.15 }}>{monster.name}</div>
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
          {crLabel}
          {type ? ` • ${type}` : ""}
          {monster.environment ? ` • ${monster.environment}` : ""}
        </div>
      </button>

      {props.editable && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "0 8px",
            flexShrink: 0,
            opacity: hovered || props.confirmingDelete ? 1 : 0.65,
            transition: "opacity 0.1s",
            pointerEvents: "auto",
          }}
        >
          {props.confirmingDelete ? (
            <>
              <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginRight: 2 }}>{translateUi("Delete?")}</span>
              <Button type="button" variant="danger" onClick={props.onConfirmDelete} disabled={props.deleteBusy} title={translateUi("Yes, delete")}>
                {translateUi("Yes")}
              </Button>
              <Button type="button" variant="ghost" onClick={props.onCancelDelete} title={translateUi("Cancel")}>
                {translateUi("No")}
              </Button>
            </>
          ) : (
            <>
              <IconButton onClick={props.onEdit} variant="ghost" size="sm" title={translateUi("Edit monster")}>
                <IconPencil size={13} />
              </IconButton>
              <IconButton onClick={props.onDelete} variant="ghost" size="sm" title={translateUi("Delete monster")}>
                <IconTrash size={13} />
              </IconButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MonsterBrowserPanel(props: {
  selectedMonsterId: string | null;
  onSelectMonster: (id: string) => void;
  editable?: boolean;
}) {
  const translateUi = useUiTranslation("dmUi");
  const { rows, loading, loadError, totalRows, ensureRange, envOptions, sizeOptions, typeOptions, refresh, compQ, setCompQ, sortMode, setSortMode, envFilter, setEnvFilter, sizeFilter, setSizeFilter, typeFilter, setTypeFilter, crMin, setCrMin, crMax, setCrMax, rulesetFilter, setRulesetFilter, showRulesetFilter, lettersInList, letterFirstIndex } = useMonsterBrowser();

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 8 });
  // The list is sized by the server's total, not by how many rows have been fetched, so the
  // scrollbar and the A-Z jump both address the whole result set.
  const { start, end, padTop, padBottom } = vl.getRange(totalRows);

  // The filtered total can't tell an empty catalogue from a filter that matched nothing, so lean on
  // the facet lists: they come back empty only when there are no monsters at all.
  const hasAnyMonsters = typeOptions.length > 1;

  // Fetch whatever window the viewport is over. Scrolling changes `start`/`end`, so this covers
  // both dragging the scrollbar and jumping straight to a letter.
  React.useEffect(() => {
    if (totalRows > 0) ensureRange(start, end);
  }, [ensureRange, start, end, totalRows]);

  const [formTarget, setFormTarget] = React.useState<
    { mode: "create" } | { mode: "edit"; monster: MonsterForEdit } | { mode: "duplicate"; source: MonsterForEdit } | null
  >(null);
  const [, setEditLoading] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [showCreateChoice, setShowCreateChoice] = React.useState(false);
  const [dupPickerOpen, setDupPickerOpen] = React.useState(false);
  const [dupSearchQ, setDupSearchQ] = React.useState("");
  const [dupLoading, setDupLoading] = React.useState<string | null>(null);

  // The duplicate picker runs its own search rather than filtering the browser's rows: those are
  // now only the windows that have been scrolled past, so a name further down the list wouldn't
  // be there to match.
  const [dupRows, setDupRows] = React.useState<CompendiumMonsterRow[]>([]);
  React.useEffect(() => {
    if (!dupPickerOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: dupSearchQ.trim(), limit: "200", sort: "az", fields: "id,name,cr,type,environment" });
      api<CompendiumMonsterRow[] | { rows?: CompendiumMonsterRow[] }>(`/api/compendium/search?${params.toString()}`, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          setDupRows(Array.isArray(result) ? result : Array.isArray(result?.rows) ? result.rows : []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setDupRows([]);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [dupPickerOpen, dupSearchQ]);

  async function handleEditClick(id: string) {
    setEditLoading(id);
    try {
      const monster = await api<MonsterForEdit>(`/api/compendium/monsters/${encodeURIComponent(id)}?view=grand`);
      setFormTarget({ mode: "edit", monster });
    } catch {
      // ignore
    } finally {
      setEditLoading(null);
    }
  }

  async function handleDuplicateClick(id: string) {
    setDupLoading(id);
    try {
      const source = await api<MonsterForEdit>(`/api/compendium/monsters/${encodeURIComponent(id)}?view=grand`);
      setDupPickerOpen(false);
      setDupSearchQ("");
      setFormTarget({ mode: "duplicate", source });
    } catch {
      // ignore
    } finally {
      setDupLoading(null);
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleteBusy(true);
    try {
      await api(`/api/compendium/monsters/${encodeURIComponent(id)}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      if (props.selectedMonsterId === id) props.onSelectMonster("");
      refresh();
    } catch {
      // ignore
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <Panel
        storageKey="compendium-monsters"
        title={translateUi("Monsters")}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {loading ? translateUi("Loading...") : totalRows.toLocaleString()}
            </div>
            {props.editable && <BrowserAddButton title={translateUi("New monster")} onClick={() => setShowCreateChoice(true)} />}
          </div>
        }
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
      >
        <MonsterPickerFilters
          compQ={compQ}
          onChangeCompQ={setCompQ}
          sortMode={sortMode}
          onChangeSortMode={setSortMode}
          envFilter={envFilter}
          onChangeEnvFilter={setEnvFilter}
          envOptions={envOptions}
          sizeFilter={sizeFilter}
          onChangeSizeFilter={setSizeFilter}
          sizeOptions={sizeOptions}
          typeFilter={typeFilter}
          onChangeTypeFilter={setTypeFilter}
          typeOptions={typeOptions}
          crMin={crMin}
          crMax={crMax}
          onChangeCrMin={setCrMin}
          onChangeCrMax={setCrMax}
          onQuickCr={(min, max) => {
            setCrMin(min);
            setCrMax(max);
          }}
          onClear={() => {
            setCompQ("");
            setSortMode("az");
            setEnvFilter("all");
            setSizeFilter("all");
            setTypeFilter("all");
            setCrMin("");
            setCrMax("");
          }}
          rulesetFilter={rulesetFilter}
          onChangeRulesetFilter={setRulesetFilter}
          showRulesetFilter={showRulesetFilter}
        />

        {lettersInList.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {lettersInList.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => {
                  const idx = letterFirstIndex[letter];
                  if (idx == null) return;
                  const element = vl.scrollRef.current;
                  if (element) element.scrollTop = idx * ROW_HEIGHT;
                }}
                style={{
                  padding: "2px 7px",
                  borderRadius: 6,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: "transparent",
                  color: theme.colors.muted,
                  cursor: "pointer",
                  fontSize: "var(--fs-small)",
                  fontWeight: 700,
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        <ListShell ref={vl.scrollRef} onScroll={vl.onScroll as React.UIEventHandler<HTMLDivElement>} style={{ borderColor: theme.colors.panelBorder }}>
          {loadError && (
            <EmptyState textColor={theme.colors.red} style={{ padding: 12 }}>
              {translateUi("Failed to load:")} {loadError}
            </EmptyState>
          )}
          {!loading && !loadError && totalRows === 0 && (
            <EmptyState textColor={theme.colors.muted} style={{ padding: 12 }}>
              {hasAnyMonsters ? translateUi("No monsters match the current filters.") : translateUi("No compendium data loaded. Import canonical Beholden JSON in the Compendium section.")}
            </EmptyState>
          )}
          {totalRows > 0 && (
            <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
              {rows.slice(start, end).map((monster, offset) => (
                monster ? (
                  <MonsterBrowserRow
                    key={monster.id}
                    row={monster}
                    active={monster.id === props.selectedMonsterId}
                    editable={!!props.editable}
                    onClick={() => props.onSelectMonster(monster.id)}
                    onEdit={() => handleEditClick(monster.id)}
                    onDelete={() => setConfirmDeleteId(monster.id)}
                    confirmingDelete={confirmDeleteId === monster.id}
                    onConfirmDelete={() => handleDeleteConfirm(monster.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    deleteBusy={deleteBusy && confirmDeleteId === monster.id}
                  />
                ) : (
                  <MonsterRowPlaceholder key={`pending-${start + offset}`} />
                )
              ))}
            </div>
          )}
        </ListShell>
      </Panel>

      {showCreateChoice && (
        <MonsterCreateChoiceModal
          onClose={() => setShowCreateChoice(false)}
          onCreateNew={() => {
            setShowCreateChoice(false);
            setFormTarget({ mode: "create" });
          }}
          onDuplicateExisting={() => {
            setShowCreateChoice(false);
            setDupPickerOpen(true);
          }}
        />
      )}

      {dupPickerOpen && (
        <MonsterDuplicatePickerModal
          searchQuery={dupSearchQ}
          rows={dupRows}
          loadingId={dupLoading}
          onClose={() => {
            setDupPickerOpen(false);
            setDupSearchQ("");
          }}
          onSearchChange={setDupSearchQ}
          onPick={handleDuplicateClick}
        />
      )}

      {formTarget && (
        <MonsterFormModal
          monster={formTarget.mode === "edit" ? formTarget.monster : formTarget.mode === "duplicate" ? formTarget.source : null}
          isDuplicate={formTarget.mode === "duplicate"}
          onClose={() => setFormTarget(null)}
          onSaved={(id) => {
            setFormTarget(null);
            refresh();
            props.onSelectMonster(id);
          }}
        />
      )}
    </>
  );
}
