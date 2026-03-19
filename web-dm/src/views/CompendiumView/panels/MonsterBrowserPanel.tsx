import * as React from "react";
import { Panel } from "@/ui/Panel";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import { IconPencil, IconTrash, IconPlus } from "@/icons";
import type { CompendiumMonsterRow, PreparedMonsterRow, SortMode } from "@/views/CampaignView/monsterPicker/types";
import { useMonsterPickerRows } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerRows";
import { MonsterPickerFilters } from "@/views/CampaignView/monsterPicker/components/MonsterPickerFilters";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";
import { MonsterFormModal, type MonsterForEdit } from "@/views/CompendiumView/panels/MonsterFormModal";

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
  const m = props.row;
  const [hovered, setHovered] = React.useState(false);
  const crLabel = m.cr != null ? `CR ${formatCr(m.cr)}` : "CR —";
  const type = m.type ? String(m.type).charAt(0).toUpperCase() + String(m.type).slice(1) : null;

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
      {/* Monster info — clickable */}
      <button
        type="button"
        onClick={props.onClick}
        style={{
          flex: 1, height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: "0 10px", border: "none",
          background: "transparent", color: theme.colors.text,
          cursor: "pointer", textAlign: "left", minWidth: 0,
        }}
      >
        <div style={{ fontWeight: 700, lineHeight: 1.15 }}>{m.name}</div>
        <div style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2 }}>
          {crLabel}{type ? ` • ${type}` : ""}{m.environment ? ` • ${m.environment}` : ""}
        </div>
      </button>

      {/* Edit / delete — only when editable */}
      {props.editable && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4, padding: "0 8px", flexShrink: 0,
          opacity: hovered || props.confirmingDelete ? 1 : 0,
          transition: "opacity 0.1s",
          pointerEvents: hovered || props.confirmingDelete ? "auto" : "none",
        }}>
          {props.confirmingDelete ? (
            <>
              <span style={{ fontSize: 11, color: theme.colors.muted, marginRight: 2 }}>Delete?</span>
              <button type="button" onClick={props.onConfirmDelete} disabled={props.deleteBusy}
                style={actionBtn(theme.colors.red)} title="Yes, delete">Yes</button>
              <button type="button" onClick={props.onCancelDelete}
                style={actionBtn(theme.colors.muted)} title="Cancel">No</button>
            </>
          ) : (
            <>
              <button type="button" onClick={props.onEdit} style={actionBtn(theme.colors.muted)} title="Edit monster">
                <IconPencil size={13} />
              </button>
              <button type="button" onClick={props.onDelete} style={actionBtn(theme.colors.muted)} title="Delete monster">
                <IconTrash size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 26, height: 26, padding: 0,
    border: `1px solid ${withAlpha(color, 0.3)}`,
    borderRadius: 6, background: withAlpha(color, 0.1),
    color, cursor: "pointer", fontSize: 11, fontWeight: 700,
  };
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

  const refresh = React.useCallback(() => setRefreshKey((k) => k + 1), []);

  // Fetch monster index
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    api<CompendiumMonsterRow[]>("/api/compendium/monsters")
      .then((rows) => { if (alive) setBaseRows(rows); })
      .catch((e) => { if (alive) setLoadError(String(e?.message ?? e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey]);

  // Filter state
  const [compQ, setCompQ] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [crMin, setCrMin] = React.useState("");
  const [crMax, setCrMax] = React.useState("");

  const { filteredRows, envOptions, sizeOptions, typeOptions, lettersInList, letterFirstIndex } = useMonsterPickerRows({
    rows: baseRows, compQ, sortMode, envFilter, sizeFilter, typeFilter, crMin, crMax,
  });

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 8 });
  const { start, end, padTop, padBottom } = vl.getRange(filteredRows.length);

  // CRUD state
  const [formTarget, setFormTarget] = React.useState<{ mode: "create" } | { mode: "edit"; monster: MonsterForEdit } | null>(null);
  const [editLoading, setEditLoading] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

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
        title="Monsters"
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: 12 }}>
              {loading ? "Loading…" : `${filteredRows.length.toLocaleString()} / ${baseRows.length.toLocaleString()}`}
            </div>
            {props.editable && (
              <button
                type="button"
                title="New monster"
                onClick={() => setFormTarget({ mode: "create" })}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 8,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: theme.colors.accentPrimary,
                  color: theme.colors.textDark,
                  cursor: "pointer",
                }}
              >
                <IconPlus size={14} />
              </button>
            )}
          </div>
        }
        style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
      >
        {/* Filters */}
        <MonsterPickerFilters
          compQ={compQ} onChangeCompQ={setCompQ}
          sortMode={sortMode} onChangeSortMode={setSortMode}
          envFilter={envFilter} onChangeEnvFilter={setEnvFilter} envOptions={envOptions}
          sizeFilter={sizeFilter} onChangeSizeFilter={setSizeFilter} sizeOptions={sizeOptions}
          typeFilter={typeFilter} onChangeTypeFilter={setTypeFilter} typeOptions={typeOptions}
          crMin={crMin} crMax={crMax}
          onChangeCrMin={setCrMin} onChangeCrMax={setCrMax}
          onQuickCr={(min, max) => { setCrMin(min); setCrMax(max); }}
          onClear={() => {
            setCompQ(""); setSortMode("az");
            setEnvFilter("all"); setSizeFilter("all"); setTypeFilter("all");
            setCrMin(""); setCrMax("");
          }}
        />

        {/* Letter jump pills */}
        {lettersInList.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {lettersInList.map((letter) => (
              <button
                key={letter} type="button"
                onClick={() => {
                  const idx = letterFirstIndex[letter];
                  if (idx == null) return;
                  const el = vl.scrollRef.current;
                  if (el) el.scrollTop = idx * ROW_HEIGHT;
                }}
                style={{
                  padding: "2px 7px", borderRadius: 6,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: "transparent", color: theme.colors.muted,
                  cursor: "pointer", fontSize: 11, fontWeight: 700,
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable virtual list */}
        <div
          ref={vl.scrollRef} onScroll={vl.onScroll}
          style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12,
          }}
        >
          {loadError && (
            <div style={{ padding: 12, color: theme.colors.red }}>Failed to load: {loadError}</div>
          )}
          {!loading && !loadError && filteredRows.length === 0 && (
            <div style={{ padding: 12, color: theme.colors.muted }}>
              {baseRows.length === 0
                ? "No compendium data loaded. Import an XML file in the Import section."
                : "No monsters match the current filters."}
            </div>
          )}
          {filteredRows.length > 0 && (
            <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
              {filteredRows.slice(start, end).map((m) => (
                <MonsterBrowserRow
                  key={m.id}
                  row={m}
                  active={m.id === props.selectedMonsterId}
                  editable={!!props.editable}
                  onClick={() => props.onSelectMonster(m.id)}
                  onEdit={() => handleEditClick(m.id)}
                  onDelete={() => setConfirmDeleteId(m.id)}
                  confirmingDelete={confirmDeleteId === m.id}
                  onConfirmDelete={() => handleDeleteConfirm(m.id)}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  deleteBusy={deleteBusy && confirmDeleteId === m.id}
                />
              ))}
            </div>
          )}
        </div>
      </Panel>

      {formTarget && (
        <MonsterFormModal
          monster={formTarget.mode === "edit" ? formTarget.monster : null}
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
