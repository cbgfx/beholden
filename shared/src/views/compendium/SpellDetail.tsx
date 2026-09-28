import { useUiTranslation } from "../../i18n/useUiTranslation";
import { expandSchool } from "../../domain/compendium/expandSchool";
import { spellLevelLabel, type CompendiumSpellDetail } from "../../domain/compendium/spellDetail";
import { FormattedText } from "../../ui/FormattedText";
import { useCompendiumHost, type Ruleset } from "./CompendiumHost";
import { COMPENDIUM_COLORS as C } from "./compendiumStyle";
import { entryPath, useCompendiumEntry } from "./useCompendiumEntry";

export function SpellDetail(props: { spellId: string; ruleset?: Ruleset | null }) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, revision } = useCompendiumHost();
  const { data: spell, busy, error } = useCompendiumEntry<CompendiumSpellDetail>(entryPath("/api/spells", props.spellId, props.ruleset), revision);

  const header = spell ? `${spellLevelLabel(spell.level)}${spell.school ? ` • ${expandSchool(spell.school)}` : ""}` : "";

  return (
    <Panel
      title={spell ? spell.name : translateUi("Spell")}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{busy ? translateUi("Loading...") : header}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: "hidden" }}
    >
      {error ? (
        <div style={{ color: C.red }}>{translateUi("Could not load this spell: {{value1}}", { value1: error })}</div>
      ) : !spell ? (
        <div style={{ color: C.muted, lineHeight: 1.4 }}>{busy ? translateUi("Loading...") : translateUi("Pick a spell on the left to view details.")}</div>
      ) : (
        <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 10, minHeight: 0, height: "100%", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: C.muted, fontSize: "var(--fs-small)" }}>
            {spell.time ? <span>{translateUi("Cast: {{value1}}", { value1: spell.time })}</span> : null}
            {spell.range ? <span>{translateUi("Range: {{value1}}", { value1: spell.range })}</span> : null}
            {spell.duration ? <span>{translateUi("Duration: {{value1}}", { value1: spell.duration })}</span> : null}
            {spell.components ? <span>{translateUi("Components: {{value1}}", { value1: spell.components })}</span> : null}
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              overscrollBehavior: "contain",
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 12,
              padding: 10,
              whiteSpace: "pre-wrap",
              lineHeight: 1.35,
            }}
          >
            <FormattedText text={spell.text} />
          </div>

          {spell.school ? <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{translateUi("School: {{value1}}", { value1: expandSchool(spell.school) })}</div> : null}
          {spell.classes ? <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{translateUi("Classes: {{value1}}", { value1: spell.classes })}</div> : null}
        </div>
      )}
    </Panel>
  );
}
