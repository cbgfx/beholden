import React from "react";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { SpellDetailPanel } from "@/views/CompendiumView/panels/SpellDetailPanel";
import { MonsterDetailPanel } from "@/views/CompendiumView/panels/MonsterDetailPanel";
import { ItemDetailPanel } from "@/views/CompendiumView/panels/ItemDetailPanel";
import type { CompendiumSection } from "@/views/CompendiumView/CompendiumView";

export function CompendiumRightColumn(props: {
  activeSection: CompendiumSection;
  selectedSpellId: string | null;
  selectedMonsterId: string | null;
  selectedItemId: string | null;
}) {
  // --- Monsters ---
  if (props.activeSection === "monsters") {
    if (props.selectedMonsterId) {
      return (
        <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <MonsterDetailPanel monsterId={props.selectedMonsterId} />
        </div>
      );
    }
    return (
      <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Panel
          title="Stat Block"
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
          bodyStyle={{ flex: 1 }}
        >
          <div style={{ color: theme.colors.muted, lineHeight: 1.5 }}>
            Select a monster from the list to view its full stat block here.
          </div>
        </Panel>
      </div>
    );
  }

  // --- Spells ---
  if (props.activeSection === "spells") {
    if (props.selectedSpellId) {
      return (
        <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SpellDetailPanel spellId={props.selectedSpellId} />
        </div>
      );
    }
    return (
      <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Panel
          title="Spell Detail"
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
          bodyStyle={{ flex: 1 }}
        >
          <div style={{ color: theme.colors.muted, lineHeight: 1.5 }}>
            Select a spell from the list to view its full description here.
          </div>
        </Panel>
      </div>
    );
  }

  // --- Items ---
  if (props.activeSection === "items") {
    if (props.selectedItemId) {
      return (
        <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <ItemDetailPanel itemId={props.selectedItemId} />
        </div>
      );
    }
    return (
      <div style={{ minWidth: 0, minHeight: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Panel
          title="Item Detail"
          style={{ flex: 1, display: "flex", flexDirection: "column" }}
          bodyStyle={{ flex: 1 }}
        >
          <div style={{ color: theme.colors.muted, lineHeight: 1.5 }}>
            Select an item from the list to view its details here.
          </div>
        </Panel>
      </div>
    );
  }

  // Rules and Import sections don't use the right column
  return null;
}
