import React from "react";
import { SpellsPanel } from "@/views/CompendiumView/panels/SpellsPanel";
import { RulesReferencePanel } from "@/views/CompendiumView/panels/RulesReferencePanel";
import { CompendiumAdminPanel } from "@/views/CompendiumView/panels/CompendiumAdminPanel";
import { MonsterBrowserPanel } from "@/views/CompendiumView/panels/MonsterBrowserPanel";
import { ItemsBrowserPanel } from "@/views/CompendiumView/panels/ItemsBrowserPanel";
import type { CompendiumSection } from "@/views/CompendiumView/CompendiumView";

export function CompendiumCenterColumn(props: {
  activeSection: CompendiumSection;
  selectedSpellId: string | null;
  onSelectSpell: (id: string) => void;
  selectedMonsterId: string | null;
  onSelectMonster: (id: string) => void;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
}) {
  return (
    <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {props.activeSection === "monsters" && (
        <MonsterBrowserPanel
          selectedMonsterId={props.selectedMonsterId}
          onSelectMonster={props.onSelectMonster}
          editable
        />
      )}
      {props.activeSection === "spells" && (
        <SpellsPanel
          embedded
          editable
          selectedSpellId={props.selectedSpellId}
          onSelectSpell={props.onSelectSpell}
        />
      )}
      {props.activeSection === "items" && (
        <ItemsBrowserPanel
          editable
          selectedItemId={props.selectedItemId}
          onSelectItem={props.onSelectItem}
        />
      )}
      {props.activeSection === "rules" && <RulesReferencePanel />}
      {props.activeSection === "compendium" && <CompendiumAdminPanel />}
    </div>
  );
}
