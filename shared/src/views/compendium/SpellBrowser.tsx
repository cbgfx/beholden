import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { api } from "../../api/browserClient";
import { expandSchool } from "../../domain/compendium/expandSchool";
import { useCompendiumSpellSearch } from "../../domain/compendium/useSpellSearch";
import type { SpellSearchRow } from "../../domain/compendium/normalizeSpellSearchRow";
import { IconSpells } from "../../icons";
import { EmptyState } from "../../ui/EmptyState";
import { ListShell } from "../../ui/ListShell";
import { useCompendiumHost, useOnRevisionChange, type CompendiumEntryEditing, type Ruleset } from "./CompendiumHost";
import { ACTIVE_ROW_BACKGROUND, BrowserTitle, COMPENDIUM_COLORS as C } from "./compendiumStyle";
import { BrowserHeaderActions, EntryRowActions } from "./EntryRowActions";
import { SpellFilterBar, useSpellListScroll } from "./SpellFilterBar";

// Spell ids repeat across rulesets, so a row is identified by id and ruleset together.
const rowKey = (id: string, ruleset: Ruleset | null | undefined) => `${id}::${ruleset ?? ""}`;

function SpellRow(props: {
  row: SpellSearchRow;
  active: boolean;
  /** Show which ruleset the spell belongs to (when the compendium holds more than one). */
  showRuleset: boolean;
  editing?: CompendiumEntryEditing;
  onClick: () => void;
  onError: (message: string) => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const { row } = props;
  const level = row.level == null ? "?" : String(row.level);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: `1px solid ${C.panelBorder}`,
        background: props.active ? ACTIVE_ROW_BACKGROUND : "transparent",
      }}
    >
      <button
        type="button"
        onClick={props.onClick}
        style={{ flex: 1, textAlign: "left", padding: "10px", border: "none", background: "transparent", color: C.text, cursor: "pointer", minWidth: 0 }}
      >
        <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{row.name}</div>
        <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          L{level}
          {row.school ? ` • ${expandSchool(row.school)}` : ""}
          {row.time ? ` • ${row.time}` : ""}
          {props.showRuleset && row.ruleset ? ` • ${row.ruleset}` : ""}
        </div>
      </button>
      {props.editing && (
        <EntryRowActions editing={props.editing} id={row.id} ruleset={row.ruleset ?? undefined} noun="spell" hovered={hovered} onError={props.onError} />
      )}
    </div>
  );
}

export function SpellBrowser(props: {
  selectedSpellId?: string | null;
  selectedSpellRuleset?: Ruleset | null;
  onSelectSpell: (id: string | null, ruleset?: Ruleset | null) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, editing, revision } = useCompendiumHost();
  const search = useCompendiumSpellSearch(api);
  const { rows, busy, totalCount, loadingMore, error, refresh } = search;
  const { containerRef, onScroll } = useSpellListScroll(search);
  const [actionError, setActionError] = React.useState<string | null>(null);
  useOnRevisionChange(revision, refresh);

  // Deleting the open spell also closes its detail.
  const spellEditing = React.useMemo<CompendiumEntryEditing | undefined>(() => editing?.spells && {
    ...editing.spells,
    remove: async (id, ruleset) => {
      await editing.spells!.remove(id, ruleset);
      if (id === props.selectedSpellId && (ruleset ?? null) === (props.selectedSpellRuleset ?? null)) props.onSelectSpell(null);
    },
  }, [editing?.spells, props]);

  return (
    <Panel
      storageKey="compendium-spells"
      title={<BrowserTitle icon={<IconSpells size={36} />}>{translateUi("Spells")}</BrowserTitle>}
      actions={<BrowserHeaderActions busy={busy} count={totalCount} addTitle={translateUi("New spell")} editing={spellEditing} />}
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}
    >
      <SpellFilterBar search={search} />
      {actionError && <div role="alert" style={{ color: C.red, padding: "4px 8px", fontSize: "var(--fs-small)" }}>{actionError}</div>}
      <ListShell ref={containerRef} onScroll={onScroll} borderColor={C.panelBorder}>
        {rows.map((row) => (
          <SpellRow
            key={rowKey(row.id, row.ruleset)}
            row={row}
            active={row.id === props.selectedSpellId && (row.ruleset ?? null) === (props.selectedSpellRuleset ?? null)}
            showRuleset={search.showRulesetFilter}
            editing={spellEditing}
            onClick={() => props.onSelectSpell(row.id, row.ruleset ?? null)}
            onError={setActionError}
          />
        ))}
        {loadingMore && <EmptyState textColor={C.muted} style={{ padding: 10 }}>{translateUi("Loading more...")}</EmptyState>}
        {/* Paging stops on a failed page, so say so: an empty list would otherwise read as
            "no such spell" rather than "the request failed". */}
        {error && <EmptyState textColor={C.red} style={{ padding: 10 }}>{translateUi("Could not load spells. Try again.")}</EmptyState>}
        {!busy && !error && rows.length === 0 && <EmptyState textColor={C.muted} style={{ padding: 10 }}>{translateUi("No spells found.")}</EmptyState>}
      </ListShell>
    </Panel>
  );
}
