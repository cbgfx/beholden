import React from "react";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { IconSpells, IconPencil, IconTrash, IconPlus } from "@/icons";
import { theme, withAlpha } from "@/theme/theme";
import { titleCase } from "@/lib/format/titleCase";
import { expandSchool } from "@/lib/format/expandSchool";
import { useStore } from "@/store";
import { useSpellSearch } from "@/views/CompendiumView/hooks/useSpellSearch";
import { SpellFormModal, SpellForEdit } from "@/views/CompendiumView/panels/SpellFormModal";
import { api } from "@/services/api";

type SpellsPanelProps = {
  /**
   * When true, this panel is being rendered "inside something else"
   * (ex: the Combat Spell Book drawer), where we do NOT want to open
   * the global DrawerHost to show spell details.
   */
  embedded?: boolean;

  /**
   * When embedded, the parent split-view owns the selected spell id.
   * We accept it here so the list can highlight the current selection.
   */
  selectedSpellId?: string | null;

  /**
   * When embedded, clicking a spell should notify the parent split-view
   * so it can render <SpellDetailPanel spellId=.../> on the right.
   */
  onSelectSpell?: (id: string) => void;

  /**
   * When true, shows + / edit / delete controls for spell management.
   * Should only be set in the Compendium admin view.
   */
  editable?: boolean;
};

type FormTarget =
  | { mode: "create" }
  | { mode: "edit"; spell: SpellForEdit };

export function SpellsPanel(props: SpellsPanelProps) {
  const { dispatch } = useStore();

  // Local active state so the list can highlight the clicked spell.
  const [activeId, setActiveId] = React.useState<string>("");

  const {
    q, setQ,
    level, setLevel,
    schoolFilter, setSchoolFilter, schoolOptions,
    classFilter, setClassFilter, classOptions,
    filterV, setFilterV,
    filterS, setFilterS,
    filterM, setFilterM,
    filterConcentration, setFilterConcentration,
    filterRitual, setFilterRitual,
    hasActiveFilters, clearFilters,
    rows, busy, refresh,
  } = useSpellSearch();
  const filtered = rows;

  // CRUD state (only used when editable)
  const [formTarget, setFormTarget] = React.useState<FormTarget | null>(null);
  const [editLoading, setEditLoading] = React.useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [hoveredRowId, setHoveredRowId] = React.useState<string | null>(null);

  // If we're embedded and the parent controls selection, sync the highlight.
  React.useEffect(() => {
    if (!props.embedded) return;
    const next = props.selectedSpellId ?? "";
    setActiveId(next);
  }, [props.embedded, props.selectedSpellId]);

  async function handleEditClick(id: string) {
    setEditLoading(id);
    try {
      const spell = await api<SpellForEdit>(`/api/spells/${encodeURIComponent(id)}`);
      setFormTarget({ mode: "edit", spell });
    } catch {
      // ignore
    } finally {
      setEditLoading(null);
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleteBusy(true);
    try {
      await api(`/api/spells/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (activeId === id) setActiveId("");
      setConfirmDeleteId(null);
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
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconSpells size={36} title="Spells" />
            <span>Spells</span>
          </span>
        }
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: 12 }}>
              {busy ? "Loading…" : `${filtered.length}`}
            </div>
            {props.editable && (
              <button
                type="button"
                title="New spell"
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
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
        bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
      >
        {/* Row 1: search */}
        <input
          value={q}
          placeholder="Search…"
          onChange={(e) => setQ(e.target.value)}
          style={{
            background: theme.colors.panelBg,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 10,
            padding: "8px 10px",
            outline: "none",
          }}
        />

        {/* Row 2: level + school + class */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <Select value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: "100%" }} title="Filter by level">
            <option value="all">All Levels</option>
            <option value="0">Cantrip</option>
            {Array.from({ length: 9 }).map((_, i) => {
              const n = i + 1;
              return <option key={n} value={String(n)}>Level {n}</option>;
            })}
          </Select>
          <Select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} style={{ width: "100%" }} title="Filter by school">
            {schoolOptions.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All Schools" : expandSchool(s)}</option>
            ))}
          </Select>
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={{ width: "100%" }} title="Filter by class">
            {classOptions.map((c) => (
              <option key={c} value={c}>{c === "all" ? "All Classes" : c}</option>
            ))}
          </Select>
        </div>

        {/* Row 3: V S M (gold, exclude-mode) + concentration + ritual + clear */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {([ ["V", filterV, setFilterV, "Verbal"], ["S", filterS, setFilterS, "Somatic"], ["M", filterM, setFilterM, "Material"] ] as const).map(
            ([label, active, setActive, title]) => (
              <button
                key={label} type="button"
                onClick={() => setActive(!active)}
                title={`${active ? "Showing" : "Hiding"} ${title} component spells`}
                style={togglePill(active, true)}
              >
                {label}
              </button>
            )
          )}
          <button type="button" onClick={() => setFilterConcentration(!filterConcentration)} style={togglePill(filterConcentration)}>
            Concentration
          </button>
          <button type="button" onClick={() => setFilterRitual(!filterRitual)} style={togglePill(filterRitual)}>
            Ritual
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} style={togglePill(false)}>
              Clear
            </button>
          )}
        </div>

        {/* List container */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
          }}
        >
          {filtered.map((s) => {
            const active = s.id === activeId;
            const lvl = s.level == null ? "?" : s.level === 0 ? "0" : String(s.level);
            const safeName = typeof s.name === "string" ? s.name : String((s as any).name ?? "");
            const isConfirmingDelete = confirmDeleteId === s.id;
            const isHovered = hoveredRowId === s.id;

            return (
              <div
                key={s.id}
                onMouseEnter={() => setHoveredRowId(s.id)}
                onMouseLeave={() => setHoveredRowId(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderBottom: `1px solid ${theme.colors.panelBorder}`,
                  background: active ? withAlpha(theme.colors.accentHighlight, 0.18) : "transparent",
                }}
              >
                {/* Spell info — clickable */}
                <button
                  onClick={() => {
                    setActiveId(s.id);
                    if (props.onSelectSpell) {
                      props.onSelectSpell(s.id);
                      return;
                    }
                    if (!props.embedded) {
                      dispatch({
                        type: "openDrawer",
                        drawer: { type: "viewSpell", spellId: s.id, title: safeName },
                      });
                    }
                  }}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    padding: "10px 10px",
                    border: "none",
                    background: "transparent",
                    color: theme.colors.text,
                    cursor: "pointer",
                    minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{safeName}</div>
                  <div
                    style={{
                      color: theme.colors.muted,
                      fontSize: 12,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    L{lvl} • {s.school ? expandSchool(s.school) : ""}
                    {s.time ? ` • ${s.time}` : ""}
                  </div>
                </button>

                {/* Edit / Delete — only in editable mode */}
                {props.editable && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "0 8px",
                      flexShrink: 0,
                      opacity: isHovered || isConfirmingDelete ? 1 : 0,
                      transition: "opacity 0.1s",
                      pointerEvents: isHovered || isConfirmingDelete ? "auto" : "none",
                    }}
                  >
                    {isConfirmingDelete ? (
                      /* Delete confirmation inline */
                      <>
                        <span style={{ fontSize: 11, color: theme.colors.muted, marginRight: 4 }}>Delete?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteConfirm(s.id)}
                          disabled={deleteBusy}
                          style={actionBtnStyle(theme.colors.red)}
                          title="Yes, delete"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          style={actionBtnStyle(theme.colors.muted)}
                          title="Cancel"
                        >
                          No
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditClick(s.id)}
                          disabled={editLoading === s.id}
                          style={actionBtnStyle(theme.colors.muted)}
                          title="Edit spell"
                        >
                          {editLoading === s.id
                            ? <span style={{ fontSize: 10 }}>…</span>
                            : <IconPencil size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(s.id)}
                          style={actionBtnStyle(theme.colors.muted)}
                          title="Delete spell"
                        >
                          <IconTrash size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!filtered.length && (
            <div style={{ padding: 10, color: theme.colors.muted }}>No spells found.</div>
          )}
        </div>
      </Panel>

      {/* Create / Edit modal */}
      {formTarget && (
        <SpellFormModal
          spell={formTarget.mode === "edit" ? formTarget.spell : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); refresh(); }}
        />
      )}
    </>
  );
}

function togglePill(active: boolean, gold = false): React.CSSProperties {
  const accent = gold ? theme.colors.accentPrimary : theme.colors.accentHighlight;
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? accent : theme.colors.panelBorder}`,
    background: active ? withAlpha(accent, 0.18) : withAlpha(theme.colors.shadowColor, 0.12),
    color: active ? accent : theme.colors.muted,
    cursor: "pointer",
    fontSize: "var(--fs-pill, 11px)",
    fontWeight: 700,
  };
}

function actionBtnStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 26,
    height: 26,
    padding: 0,
    border: `1px solid ${withAlpha(color, 0.3)}`,
    borderRadius: 6,
    background: withAlpha(color, 0.1),
    color,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  };
}
