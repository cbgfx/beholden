import * as React from "react";
import { EmptyState, ListShell } from "@beholden/shared/ui";
import { Panel } from "@/ui/Panel";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import { IconPencil, IconTrash } from "@/icons";
import type { CompendiumMonsterRow, PreparedMonsterRow, SortMode } from "@/views/CampaignView/monsterPicker/types";
import { useMonsterPickerRows } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerRows";
import { MonsterPickerFilters } from "@/views/CampaignView/monsterPicker/components/MonsterPickerFilters";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";
import { MonsterFormModal, type MonsterForEdit } from "@/views/CompendiumView/panels/MonsterFormModal";
import { MonsterCreateChoiceModal, MonsterDuplicatePickerModal } from "./MonsterBrowserModals";
import { actionBtnStyle, BrowserAddButton } from "./browserParts";

const ROW_HEIGHT = 52;

function MonsterBrowserRow(props: {
  row: PreparedMonsterRow;
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
            opacity: hovered || props.confirmingDelete ? 1 : 0,
            transition: "opacity 0.1s",
            pointerEvents: hovered || props.confirmingDelete ? "auto" : "none",
          }}
        >
          {props.confirmingDelete ? (
            <>
              <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginRight: 2 }}>Delete?</span>
              <button type="button" onClick={props.onConfirmDelete} disabled={props.deleteBusy} style={actionBtnStyle(theme.colors.red)} title="Yes, delete">
                Yes
              </button>
              <button type="button" onClick={props.onCancelDelete} style={actionBtnStyle(theme.colors.muted)} title="Cancel">
                No
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={props.onEdit} style={actionBtnStyle(theme.colors.muted)} title="Edit monster">
                <IconPencil size={13} />
              </button>
              <button type="button" onClick={props.onDelete} style={actionBtnStyle(theme.colors.muted)} title="Delete monster">
                <IconTrash size={13} />
              </button>
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
  const [baseRows, setBaseRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const refresh = React.useCallback(() => setRefreshKey((value) => value + 1), []);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    api<CompendiumMonsterRow[]>("/api/compendium/monsters")
      .then((rows) => {
        if (alive) setBaseRows(rows);
      })
      .catch((error) => {
        if (alive) setLoadError(String(error?.message ?? error));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const [compQ, setCompQ] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [crMin, setCrMin] = React.useState("");
  const [crMax, setCrMax] = React.useState("");

  const { filteredRows, envOptions, sizeOptions, typeOptions, lettersInList, letterFirstIndex } = useMonsterPickerRows({
    rows: baseRows,
    compQ,
    sortMode,
    envFilter,
    sizeFilter,
    typeFilter,
    crMin,
    crMax,
  });

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 8 });
  const { start, end, padTop, padBottom } = vl.getRange(filteredRows.length);

  const [formTarget, setFormTarget] = React.useState<
    { mode: "create" } | { mode: "edit"; monster: MonsterForEdit } | { mode: "duplicate"; source: MonsterForEdit } | null
  >(null);
  const [editLoading, setEditLoading] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [showCreateChoice, setShowCreateChoice] = React.useState(false);
  const [dupPickerOpen, setDupPickerOpen] = React.useState(false);
  const [dupSearchQ, setDupSearchQ] = React.useState("");
  const [dupLoading, setDupLoading] = React.useState<string | null>(null);

  const dupFilteredRows = React.useMemo(() => {
    const query = dupSearchQ.trim().toLowerCase();
    const rows = query ? baseRows.filter((monster) => monster.name.toLowerCase().includes(query)) : baseRows;
    return rows.slice(0, 200);
  }, [baseRows, dupSearchQ]);

  async function handleEditClick(id: string) {
    setEditLoading(id);
    try {
      const monster = await api<MonsterForEdit>(`/api/compendium/monsters/${encodeURIComponent(id)}`);
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
      const source = await api<MonsterForEdit>(`/api/compendium/monsters/${encodeURIComponent(id)}`);
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
        title="Monsters"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {loading ? "Loading..." : `${filteredRows.length.toLocaleString()} / ${baseRows.length.toLocaleString()}`}
            </div>
            {props.editable && <BrowserAddButton title="New monster" onClick={() => setShowCreateChoice(true)} />}
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
              Failed to load: {loadError}
            </EmptyState>
          )}
          {!loading && !loadError && filteredRows.length === 0 && (
            <EmptyState textColor={theme.colors.muted} style={{ padding: 12 }}>
              {baseRows.length === 0 ? "No compendium data loaded. Import an XML file in the Import section." : "No monsters match the current filters."}
            </EmptyState>
          )}
          {filteredRows.length > 0 && (
            <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
              {filteredRows.slice(start, end).map((monster) => (
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
          rows={dupFilteredRows}
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
