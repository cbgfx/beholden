import { useUiTranslation } from "../../i18n/useUiTranslation";
import { expandSchool } from "../../domain/compendium/expandSchool";
import { spellLevelLabel, type CompendiumSpellDetail } from "../../domain/compendium/spellDetail";
import { useCompendiumHost, type Ruleset } from "./CompendiumHost";
import { COMPENDIUM_COLORS as C } from "./compendiumStyle";
import { DetailBody, DetailFacts, DetailFooter, DetailHeader, DetailProse, splitDescription, type DetailFact } from "./DetailLayout";
import { entryPath, useCompendiumEntry } from "./useCompendiumEntry";

/** "V, S, M (a pinch of salt)" → value "V, S, M" with the material component as a note. */
function splitComponents(components: string): { value: string; material: string | null } {
  const open = components.indexOf(" (");
  if (open < 0 || !components.endsWith(")")) return { value: components, material: null };
  return { value: components.slice(0, open), material: components.slice(open + 2, -1) };
}

export function SpellDetail(props: { spellId: string; ruleset?: Ruleset | null }) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, revision } = useCompendiumHost();
  const { data: spell, busy, error } = useCompendiumEntry<CompendiumSpellDetail>(entryPath("/api/spells", props.spellId, props.ruleset), revision);

  const facts: DetailFact[] = [];
  if (spell?.time) facts.push({ label: translateUi("Casting Time"), value: spell.time });
  if (spell?.range) facts.push({ label: translateUi("Range"), value: spell.range });
  if (spell?.components) {
    const { value, material } = splitComponents(spell.components);
    facts.push({ label: translateUi("Components"), value, note: material });
  }
  if (spell?.duration) facts.push({ label: translateUi("Duration"), value: spell.duration });
  if (spell?.classes) facts.push({ label: translateUi("Classes"), value: spell.classes });
  const { paragraphs, source } = splitDescription(spell?.text);

  return (
    <Panel
      title={translateUi("Spell")}
      actions={busy ? <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{translateUi("Loading...")}</div> : null}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: "auto", WebkitOverflowScrolling: "touch", touchAction: "pan-y", overscrollBehavior: "contain" }}
    >
      {error ? (
        <div style={{ color: C.red }}>{translateUi("Could not load this spell: {{value1}}", { value1: error })}</div>
      ) : !spell ? (
        <div style={{ color: C.muted, lineHeight: 1.4 }}>{busy ? translateUi("Loading...") : translateUi("Pick a spell on the left to view details.")}</div>
      ) : (
        <DetailBody>
          <DetailHeader name={spell.name} subtitle={`${spellLevelLabel(spell.level)}${spell.school ? ` • ${expandSchool(spell.school)}` : ""}`} />
          <DetailFacts facts={facts} />
          <DetailProse label={translateUi("Description")} paragraphs={paragraphs} empty={translateUi("No description.")} />
          <DetailFooter>{[source, spell.ruleset].filter(Boolean).join(" · ")}</DetailFooter>
        </DetailBody>
      )}
    </Panel>
  );
}
