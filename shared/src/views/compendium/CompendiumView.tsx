import * as React from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useIsNarrow } from "../../ui/useIsNarrow";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { IconChest, IconInspiration, IconMonster, IconNotes, IconSpells } from "../../icons";
import { withAlpha } from "../../ui/colors";
import {
  CompendiumHostProvider,
  useCompendiumHost,
  useCompendiumRevision,
  type CompendiumEditableKind,
  type CompendiumEntryEditing,
  type CompendiumPanelProps,
  type Ruleset,
} from "./CompendiumHost";
import { COMPENDIUM_COLORS as C, plainPillStyle } from "./compendiumStyle";
import { CompendiumSectionPicker } from "./CompendiumSectionPicker";
import { FeatBrowser, FeatDetail } from "./FeatPanels";
import { ItemBrowser } from "./ItemBrowser";
import { ItemDetail } from "./ItemDetail";
import { MonsterBrowser } from "./MonsterBrowser";
import { MonsterDetail } from "./MonsterDetail";
import { RulesReference } from "./RulesReference";
import { SpellBrowser } from "./SpellBrowser";
import { SpellDetail } from "./SpellDetail";

/** A section only one app has (the DM's import admin, the AI guide). It has no detail column. */
export type CompendiumExtraSection = {
  id: string;
  label: string;
  icon: React.ReactNode;
  render: () => React.ReactNode;
};

type BuiltInSection = "monsters" | "spells" | "items" | "feats" | "rules";
type Selection = { id: string; ruleset: Ruleset | null } | null;

function NavButton(props: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      type="button"
      onClick={props.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 14px",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        fontWeight: props.active ? 800 : 500,
        fontSize: "var(--fs-medium)",
        color: props.active ? C.highlight : C.text,
        background: props.active ? withAlpha(C.highlight, 0.12) : hovered ? withAlpha(C.highlight, 0.07) : "transparent",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      {props.icon}
      {props.label}
    </button>
  );
}

/** Placeholder for the detail column before anything is selected. */
function DetailPrompt(props: { title: string; text: string }) {
  const { Panel } = useCompendiumHost();
  return (
    <Panel title={props.title} style={{ flex: 1, display: "flex", flexDirection: "column" }} bodyStyle={{ flex: 1 }}>
      <div style={{ color: C.muted, lineHeight: 1.5 }}>{props.text}</div>
    </Panel>
  );
}

const columnStyle: React.CSSProperties = { minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" };

/**
 * The compendium page shared by the DM and player apps: a section list, a browser, and the
 * selected entry's details. Each app supplies its panel frame; the DM app also supplies editing
 * and its own extra sections.
 */
export function CompendiumView(props: {
  Panel: React.ComponentType<CompendiumPanelProps>;
  editing?: Partial<Record<CompendiumEditableKind, CompendiumEntryEditing>>;
  /** Bumped by the app after its own edits, so they show even if the live connection is down. */
  localRevision?: number;
  extraSections?: CompendiumExtraSection[];
  /** Shown under the section list. */
  navFooter?: React.ReactNode;
}) {
  const translateUi = useUiTranslation("sharedUi");
  // The three desktop columns need 972px at their minimums, including gaps and padding.
  const compact = useIsNarrow("(max-width: 1024px)");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverRevision] = useCompendiumRevision();
  const revision = serverRevision + (props.localRevision ?? 0);
  const host = React.useMemo(() => ({ Panel: props.Panel, editing: props.editing, revision }), [props.Panel, props.editing, revision]);

  const [desktopSection, setDesktopSection] = React.useState<string>("monsters");
  const requestedSection = params.get("compendiumSection") ?? desktopSection;
  const section = ["monsters", "spells", "items", "feats", "rules", ...(props.extraSections ?? []).map((entry) => entry.id)].includes(requestedSection) ? requestedSection : "monsters";
  const [selections, setSelections] = React.useState<Record<string, Selection>>({});
  const entry = params.get("compendiumEntry");
  const ruleset = params.get("compendiumRuleset");
  const selected: Selection = entry ? { id: entry, ruleset: ruleset === "5e" || ruleset === "5.5e" ? ruleset : null } : selections[section] ?? null;
  const monster = section === "monsters" ? selected : null;
  const spell = section === "spells" ? selected : null;
  const item = section === "items" ? selected : null;
  const feat = section === "feats" ? selected : null;
  const select = (id: string | null, ruleset?: Ruleset | null) => {
    setSelections((current) => ({ ...current, [section]: id ? { id, ruleset: ruleset ?? null } : null }));
    if (compact || entry) {
      const next = new URLSearchParams(params);
      next.set("compendiumSection", section);
      next.delete("compendiumEntry");
      next.delete("compendiumRuleset");
      if (id) next.set("compendiumEntry", id);
      if (id && ruleset) next.set("compendiumRuleset", ruleset);
      setParams(next, { replace: Boolean(entry), state: { ...location.state, compendiumDetail: Boolean(id) && (Boolean(entry) ? Boolean(location.state?.compendiumDetail) : true) } });
    }
  };
  const changeSection = (value: string) => {
    if (compact || params.has("compendiumSection")) {
      const next = new URLSearchParams(params);
      next.set("compendiumSection", value);
      next.delete("compendiumEntry");
      next.delete("compendiumRuleset");
      setParams(next, { replace: Boolean(entry), state: { ...location.state, compendiumDetail: false } });
    } else setDesktopSection(value);
  };
  const backToList = () => {
    if (location.state?.compendiumDetail) navigate(-1);
    else {
      const next = new URLSearchParams(params);
      next.delete("compendiumEntry");
      next.delete("compendiumRuleset");
      setParams(next, { replace: true });
    }
  };

  const builtIn: Array<{ id: BuiltInSection; label: string; icon: React.ReactNode }> = [
    { id: "monsters", label: translateUi("Monsters"), icon: <IconMonster size={20} /> },
    { id: "spells", label: translateUi("Spells"), icon: <IconSpells size={20} /> },
    { id: "items", label: translateUi("Items"), icon: <IconChest size={20} /> },
    { id: "feats", label: translateUi("Feats"), icon: <IconInspiration size={20} /> },
    { id: "rules", label: translateUi("Rules Reference"), icon: <IconNotes size={20} /> },
  ];
  const extra = props.extraSections?.find((candidate) => candidate.id === section);
  const hasDetail = !extra && section !== "rules";
  const showDetail = compact && hasDetail && Boolean(entry);

  return (
    <CompendiumHostProvider value={host}>
      <div style={{ height: "100%", padding: 12, boxSizing: "border-box", overflowX: "auto" }}>
        <div
          style={{
            height: "100%",
            display: "grid",
            // The entry's text is what people come here to read, so the detail column takes the spare
            // width; the list caps out once its name/meta rows fit comfortably.
            gridTemplateColumns: compact ? "minmax(0, 1fr)" : hasDetail ? "180px minmax(320px, 400px) minmax(420px, 1fr)" : "180px minmax(360px, 1fr)",
            gridTemplateRows: compact ? "auto minmax(0, 1fr)" : "1fr",
            gap: 14,
            alignItems: "stretch",
            minHeight: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0 }}>
            {compact ? <>
              <CompendiumSectionPicker entries={[...builtIn, ...(props.extraSections ?? [])]} value={section} onChange={changeSection} />
              {props.navFooter ? <details><summary>{translateUi("Reference")}</summary>{props.navFooter}</details> : null}
            </> : <props.Panel title={translateUi("Reference")} style={{ display: "flex", flexDirection: "column" }}>
              <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[...builtIn, ...(props.extraSections ?? [])].map((entry) => (
                  <NavButton key={entry.id} label={entry.label} icon={entry.icon} active={section === entry.id} onClick={() => changeSection(entry.id)} />
                ))}
              </nav>
            </props.Panel>}
            {!compact && props.navFooter}
          </div>

          <div style={{ ...columnStyle, display: showDetail ? "none" : "flex" }}>
            {section === "monsters" && <MonsterBrowser selectedMonsterId={monster?.id ?? null} selectedMonsterRuleset={monster?.ruleset} onSelectMonster={select} />}
            {section === "spells" && <SpellBrowser selectedSpellId={spell?.id} selectedSpellRuleset={spell?.ruleset} onSelectSpell={select} />}
            {section === "items" && <ItemBrowser selectedItemId={item?.id} selectedItemRuleset={item?.ruleset} onSelectItem={select} />}
            {section === "feats" && <FeatBrowser selectedFeatId={feat?.id} selectedFeatRuleset={feat?.ruleset} onSelectFeat={select} />}
            {section === "rules" && <RulesReference />}
            {extra?.render()}
          </div>

          {hasDetail && (
            <div style={{ ...columnStyle, display: compact && !showDetail ? "none" : "flex", ...(compact ? { overflow: "auto", overflowWrap: "anywhere" } : {}) }}>
              {showDetail && <button type="button" onClick={backToList} style={{ ...plainPillStyle, minHeight: 44, flexShrink: 0, alignSelf: "start", marginBottom: 8 }}>{translateUi("Back to list")}</button>}
              {section === "monsters" && (monster
                ? <MonsterDetail monsterId={monster.id} ruleset={monster.ruleset} />
                : <DetailPrompt title={translateUi("Stat Block")} text={translateUi("Select a monster from the list to view its full stat block here.")} />)}
              {section === "spells" && (spell
                ? <SpellDetail spellId={spell.id} ruleset={spell.ruleset} />
                : <DetailPrompt title={translateUi("Spell Detail")} text={translateUi("Select a spell from the list to view its full description here.")} />)}
              {section === "items" && (item
                ? <ItemDetail itemId={item.id} ruleset={item.ruleset} />
                : <DetailPrompt title={translateUi("Item Detail")} text={translateUi("Select an item from the list to view its details here.")} />)}
              {section === "feats" && (feat
                ? <FeatDetail featId={feat.id} ruleset={feat.ruleset} />
                : <DetailPrompt title={translateUi("Feat Detail")} text={translateUi("Select a feat from the list to view its details here.")} />)}
            </div>
          )}
        </div>
      </div>
    </CompendiumHostProvider>
  );
}
