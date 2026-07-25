import React from "react";
import { EmptyState, ListShell } from "@beholden/shared/ui";
import { Panel } from "@/ui/Panel";
import { Select } from "@/ui/Select";
import { IconSpells } from "@/icons";
import { theme } from "@/theme/theme";
import { useStore } from "@/store";
import { api } from "@/services/api";
import { useSpellSearch } from "@/views/CompendiumView/hooks/useSpellSearch";
import { expandSchool } from "@beholden/shared/domain/compendium/expandSchool";
import { SpellFormModal, SpellForEdit } from "@/views/CompendiumView/panels/SpellFormModal";
import { BrowserAddButton, togglePillStyle } from "./browserParts";
import { SpellBrowserRow } from "./SpellBrowserRow";

type SpellsPanelProps = {
  embedded?: boolean;
  selectedSpellId?: string | null;
  selectedSpellRuleset?: "5e" | "5.5e" | null;
  onSelectSpell?: (id: string, ruleset?: "5e" | "5.5e" | null) => void;
  editable?: boolean;
};

type FormTarget =
  | { mode: "create" }
  | { mode: "edit"; spell: SpellForEdit };

// Spell ids collide across rulesets (composite PK) -- (id, ruleset) together, not id alone,
// identify a specific row for selection/edit/delete.
function rowKey(id: string, ruleset: "5e" | "5.5e" | null | undefined): string {
  return `${id}::${ruleset ?? ""}`;
}

export function SpellsPanel(props: SpellsPanelProps) {
  const { dispatch } = useStore();
  const [activeId, setActiveId] = React.useState("");
  const [activeRuleset, setActiveRuleset] = React.useState<"5e" | "5.5e" | null>(null);

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
    rulesetFilter, setRulesetFilter, availableRulesets,
    hasActiveFilters, clearFilters,
    rows,
    busy,
    refresh,
  } = useSpellSearch();

  const [formTarget, setFormTarget] = React.useState<FormTarget | null>(null);
  const [editLoadingKey, setEditLoadingKey] = React.useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  React.useEffect(() => {
    if (!props.embedded) return;
    setActiveId(props.selectedSpellId ?? "");
    setActiveRuleset(props.selectedSpellRuleset ?? null);
  }, [props.embedded, props.selectedSpellId, props.selectedSpellRuleset]);

  async function handleEditClick(id: string, ruleset: "5e" | "5.5e" | null) {
    setEditLoadingKey(rowKey(id, ruleset));
    try {
      const params = ruleset ? `?view=grand&ruleset=${ruleset}` : "?view=grand";
      const spell = await api<SpellForEdit>(`/api/spells/${encodeURIComponent(id)}${params}`);
      setFormTarget({ mode: "edit", spell });
    } catch {
      // ignore
    } finally {
      setEditLoadingKey(null);
    }
  }

  async function handleDeleteConfirm(id: string, ruleset: "5e" | "5.5e" | null) {
    setDeleteBusy(true);
    try {
      const params = ruleset ? `?ruleset=${ruleset}` : "";
      await api(`/api/spells/${encodeURIComponent(id)}${params}`, { method: "DELETE" });
      if (activeId === id && activeRuleset === ruleset) {
        setActiveId("");
        setActiveRuleset(null);
      }
      setConfirmDeleteKey(null);
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
        storageKey="compendium-spells"
        title={(
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconSpells size={36} title="Spells" />
            <span>Spells</span>
          </span>
        )}
        actions={(
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {busy ? "Loading..." : `${rows.length}`}
            </div>
            {props.editable && <BrowserAddButton title="New spell" onClick={() => setFormTarget({ mode: "create" })} />}
          </div>
        )}
        style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
        bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
      >
        <input
          value={q}
          placeholder="Search..."
          onChange={(event) => setQ(event.target.value)}
          style={{
            background: theme.colors.panelBg,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 10,
            padding: "8px 10px",
            outline: "none",
          }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
          <Select value={level} onChange={(event) => setLevel(event.target.value)} style={{ width: "100%" }} title="Filter by level">
            <option value="all">All Levels</option>
            <option value="0">Cantrip</option>
            {Array.from({ length: 9 }).map((_, index) => {
              const n = index + 1;
              return <option key={n} value={String(n)}>Level {n}</option>;
            })}
          </Select>
          <Select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)} style={{ width: "100%" }} title="Filter by school">
            {schoolOptions.map((school) => (
              <option key={school} value={school}>{school === "all" ? "All Schools" : expandSchool(school)}</option>
            ))}
          </Select>
          <Select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} style={{ width: "100%" }} title="Filter by class">
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>{cls === "all" ? "All Classes" : cls}</option>
            ))}
          </Select>
          {availableRulesets.length > 1 && (
            <Select
              value={rulesetFilter}
              onChange={(event) => setRulesetFilter(event.target.value as "5e" | "5.5e" | "")}
              style={{ width: "100%" }}
              title="Filter by ruleset"
            >
              <option value="">All Rulesets</option>
              <option value="5.5e">5.5e</option>
              <option value="5e">5e</option>
            </Select>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {([
            ["V", filterV, setFilterV, "Verbal"],
            ["S", filterS, setFilterS, "Somatic"],
            ["M", filterM, setFilterM, "Material"],
          ] as const).map(([label, active, setActive, title]) => (
            <button
              key={label}
              type="button"
              onClick={() => setActive(!active)}
              title={`${active ? "Showing" : "Hiding"} ${title} component spells`}
              style={togglePillStyle(active, true)}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={() => setFilterConcentration(!filterConcentration)} style={togglePillStyle(filterConcentration)}>
            Concentration
          </button>
          <button type="button" onClick={() => setFilterRitual(!filterRitual)} style={togglePillStyle(filterRitual)}>
            Ritual
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} style={togglePillStyle(false)}>
              Clear
            </button>
          )}
        </div>

        <ListShell style={{ borderColor: theme.colors.panelBorder }}>
          {rows.map((spell) => {
            const key = rowKey(spell.id, spell.ruleset);
            return (
              <SpellBrowserRow
                key={key}
                row={spell}
                active={spell.id === activeId && spell.ruleset === activeRuleset}
                editable={props.editable}
                editLoading={editLoadingKey === key}
                deleteBusy={deleteBusy}
                confirmingDelete={confirmDeleteKey === key}
                onClick={() => {
                  const safeName = typeof spell.name === "string" ? spell.name : String((spell as { name?: unknown }).name ?? "");
                  setActiveId(spell.id);
                  setActiveRuleset(spell.ruleset);
                  if (props.onSelectSpell) {
                    props.onSelectSpell(spell.id, spell.ruleset);
                    return;
                  }
                  if (!props.embedded) {
                    dispatch({
                      type: "openDrawer",
                      drawer: { type: "viewSpell", spellId: spell.id, ruleset: spell.ruleset ?? undefined, title: safeName },
                    });
                  }
                }}
                onEdit={() => handleEditClick(spell.id, spell.ruleset)}
                onDelete={() => setConfirmDeleteKey(key)}
                onConfirmDelete={() => handleDeleteConfirm(spell.id, spell.ruleset)}
                onCancelDelete={() => setConfirmDeleteKey(null)}
              />
            );
          })}

          {!rows.length && (
            <EmptyState textColor={theme.colors.muted} style={{ padding: 10 }}>
              No spells found.
            </EmptyState>
          )}
        </ListShell>
      </Panel>

      {formTarget && (
        <SpellFormModal
          spell={formTarget.mode === "edit" ? formTarget.spell : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            refresh();
          }}
        />
      )}
    </>
  );
}
