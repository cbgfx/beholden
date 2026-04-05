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
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
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
              <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginRight: 2 }}>Delete?</span>
              <button type="button" onClick={props.onConfirmDelete} disabled={props.deleteBusy}
                style={actionBtnStyle(theme.colors.red)} title="Yes, delete">Yes</button>
              <button type="button" onClick={props.onCancelDelete}
                style={actionBtnStyle(theme.colors.muted)} title="Cancel">No</button>
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
  const [formTarget, setFormTarget] = React.useState<{ mode: "create" } | { mode: "edit"; monster: MonsterForEdit } | { mode: "duplicate"; source: MonsterForEdit } | null>(null);
  const [editLoading, setEditLoading] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  // Create-choice + duplicate-picker state
  const [showCreateChoice, setShowCreateChoice] = React.useState(false);
  const [dupPickerOpen, setDupPickerOpen] = React.useState(false);
  const [dupSearchQ, setDupSearchQ] = React.useState("");
  const [dupLoading, setDupLoading] = React.useState<string | null>(null);

  const dupFilteredRows = React.useMemo(() => {
    const q = dupSearchQ.trim().toLowerCase();
    const rows = q ? baseRows.filter((m) => m.name.toLowerCase().includes(q)) : baseRows;
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
              {loading ? "Loading…" : `${filteredRows.length.toLocaleString()} / ${baseRows.length.toLocaleString()}`}
            </div>
            {props.editable && (
              <BrowserAddButton title="New monster" onClick={() => setShowCreateChoice(true)} />
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
                  cursor: "pointer", fontSize: "var(--fs-small)", fontWeight: 700,
                }}
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable virtual list */}
        <ListShell
          ref={vl.scrollRef}
          onScroll={vl.onScroll as React.UIEventHandler<HTMLDivElement>}
          style={{ borderColor: theme.colors.panelBorder }}
        >
          {loadError && (
            <EmptyState textColor={theme.colors.red} style={{ padding: 12 }}>Failed to load: {loadError}</EmptyState>
          )}
          {!loading && !loadError && filteredRows.length === 0 && (
            <EmptyState textColor={theme.colors.muted} style={{ padding: 12 }}>
              {baseRows.length === 0
                ? "No compendium data loaded. Import an XML file in the Import section."
                : "No monsters match the current filters."}
            </EmptyState>
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
        </ListShell>
      </Panel>

      {/* Create-choice modal */}
      {showCreateChoice && (
        <div
          onClick={() => setShowCreateChoice(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: theme.colors.scrim }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: theme.colors.modalBg, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 10, width: 260 }}
          >
            <div style={{ fontWeight: 700, fontSize: "var(--fs-body)", marginBottom: 4 }}>New Monster</div>
            <button type="button"
              onClick={() => { setShowCreateChoice(false); setFormTarget({ mode: "create" }); }}
              style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.accentPrimary, color: theme.colors.textDark, fontWeight: 700, cursor: "pointer", fontSize: "var(--fs-subtitle)", textAlign: "left" }}>
              Create New
            </button>
            <button type="button"
              onClick={() => { setShowCreateChoice(false); setDupPickerOpen(true); }}
              style={{ padding: "9px 14px", borderRadius: 8, border: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, fontWeight: 600, cursor: "pointer", fontSize: "var(--fs-subtitle)", textAlign: "left" }}>
              Duplicate Existing…
            </button>
          </div>
        </div>
      )}

      {/* Duplicate picker modal */}
      {dupPickerOpen && (
        <div
          onClick={() => { setDupPickerOpen(false); setDupSearchQ(""); }}
          style={{ position: "fixed", inset: 0, zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", background: theme.colors.scrim }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: theme.colors.modalBg, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, width: "min(480px, 95vw)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}
          >
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${theme.colors.panelBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>Pick a monster to duplicate</span>
              <button type="button" onClick={() => { setDupPickerOpen(false); setDupSearchQ(""); }}
                style={{ background: "none", border: "none", color: theme.colors.muted, cursor: "pointer", fontSize: "var(--fs-hero)", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "10px 16px", borderBottom: `1px solid ${theme.colors.panelBorder}`, flexShrink: 0 }}>
              <input
                autoFocus
                type="text"
                placeholder="Search monsters…"
                value={dupSearchQ}
                onChange={(e) => setDupSearchQ(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.inputBg, color: theme.colors.text, fontSize: "var(--fs-subtitle)", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {dupFilteredRows.map((m) => (
                <button key={m.id} type="button"
                  disabled={dupLoading === m.id}
                  onClick={() => handleDuplicateClick(m.id)}
                  style={{ width: "100%", padding: "10px 16px", border: "none", borderBottom: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, cursor: dupLoading === m.id ? "wait" : "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 2, opacity: dupLoading === m.id ? 0.5 : 1 }}
                >
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-subtitle)" }}>{m.name}</div>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                    {m.cr != null ? `CR ${formatCr(m.cr)}` : "CR —"}{m.type ? ` • ${m.type}` : ""}
                  </div>
                </button>
              ))}
              {dupFilteredRows.length === 0 && (
                <div style={{ padding: 16, color: theme.colors.muted, fontSize: "var(--fs-subtitle)" }}>No monsters found.</div>
              )}
            </div>
          </div>
        </div>
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
