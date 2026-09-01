import React from "react";
import { C } from "@/lib/theme";
import { MonsterStatblock } from "@/views/CompendiumView/panels/MonsterStatblock";
import { AbilityScoresPanel } from "@/views/character/CharacterAbilityScoresPanel";
import { SkillsPanel } from "@/views/character/CharacterSkillsPanel";
import { CharacterProficienciesPanel } from "@/views/character/CharacterProficienciesPanel";
import { CharacterCombatPanels } from "@/views/character/CharacterCombatPanels";
import { CharacterCreaturesPanel } from "@/views/character/CharacterCreaturesPanel";
import { CharacterDefensesPanel } from "@/views/character/CharacterDefensesPanel";
import { CharacterHudPanel } from "@/views/character/CharacterHudPanel";
import { RecoveryPanel } from "@/views/character/CharacterRecoveryPanel";
import { PlayerNotesPanel } from "@/views/character/CharacterPlayerNotesPanel";
import { SharedNotesPanel } from "@/views/character/CharacterSharedNotesPanel";
import { ClassFeaturesPanel } from "@/views/character/CharacterClassFeaturesPanel";
import { CharacterCountersPanel } from "@/views/character/CharacterCountersPanel";
import { InventoryPanel } from "@/views/character/CharacterInventoryPanel";
import { ItemSpellsPanel } from "@/views/character/CharacterItemSpellsPanel";
import { RichSpellsPanel } from "@/views/character/CharacterSpellsPanel";
import { PANEL_IDS, type PanelId } from "@/views/character/panelRegistry";

/** A flat map of every currently-buildable movable panel, keyed by its
 * `panelRegistry.ts` id. `CharacterViewLayout.tsx` reads panels out of this
 * map by id to compose each column, instead of a column hardwiring its own
 * children -- the seam later drag-and-drop and custom-view slices build on. */
export type CharacterPanelRegistry = Partial<Record<PanelId, React.ReactNode>>;

/** The fused HUD + Combat-Stats box atop the Primary column. Pinned: it has no
 * independent header of its own, so it isn't part of the movable-panel
 * registry (see panelRegistry.ts). */
export function PinnedVitalsBox(props: {
  combatProps: React.ComponentProps<typeof CharacterCombatPanels>;
  hudProps: React.ComponentProps<typeof CharacterHudPanel>;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 12,
      background: "rgba(255,255,255,0.035)",
    }}>
      <CharacterCombatPanels {...props.combatProps} showActions={false} embeddedStats />
      <CharacterHudPanel {...props.hudProps} embedded />
    </div>
  );
}

/** Replaces the Action column's item-spells/spells panels while the character
 * is polymorphed. Pinned: a temporary state, not a layout choice, so it isn't
 * part of the movable-panel registry. */
export function PolymorphedFormPanel(props: {
  polymorphMonsterState: { monster: React.ComponentProps<typeof MonsterStatblock>["monster"] | null; busy: boolean; error: string | null };
}) {
  const { polymorphMonsterState } = props;
  if (polymorphMonsterState.monster) {
    return <MonsterStatblock monster={polymorphMonsterState.monster} hideSummaryBar />;
  }
  if (polymorphMonsterState.busy) {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.muted }}>
        Loading transformed form...
      </div>
    );
  }
  if (polymorphMonsterState.error) {
    return (
      <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.red }}>
        {polymorphMonsterState.error}
      </div>
    );
  }
  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.muted }}>
      Transformed form details are unavailable right now.
    </div>
  );
}

export function buildPrimaryColumnPanels(props: {
  abilitiesProps: React.ComponentProps<typeof AbilityScoresPanel> & React.ComponentProps<typeof SkillsPanel>;
  defensesProps: React.ComponentProps<typeof CharacterDefensesPanel>;
  proficienciesProps: React.ComponentProps<typeof CharacterProficienciesPanel>;
}): CharacterPanelRegistry {
  return {
    [PANEL_IDS.abilitiesSaves]: <AbilityScoresPanel {...props.abilitiesProps} />,
    [PANEL_IDS.skills]: <SkillsPanel {...props.abilitiesProps} />,
    [PANEL_IDS.defenses]: <CharacterDefensesPanel {...props.defensesProps} />,
    [PANEL_IDS.proficiencies]: <CharacterProficienciesPanel {...props.proficienciesProps} />,
  };
}

export function buildActionColumnPanels(props: {
  combatProps: React.ComponentProps<typeof CharacterCombatPanels>;
  itemSpellsProps: React.ComponentProps<typeof ItemSpellsPanel>;
  richSpellsProps: React.ComponentProps<typeof RichSpellsPanel>;
}): CharacterPanelRegistry {
  return {
    [PANEL_IDS.actions]: <CharacterCombatPanels {...props.combatProps} showStats={false} />,
    [PANEL_IDS.itemSpells]: <ItemSpellsPanel {...props.itemSpellsProps} />,
    [PANEL_IDS.spells]: <RichSpellsPanel {...props.richSpellsProps} />,
  };
}

export function buildInventoryColumnPanels(props: {
  inventoryProps: React.ComponentProps<typeof InventoryPanel>;
}): CharacterPanelRegistry {
  return { [PANEL_IDS.inventory]: <InventoryPanel {...props.inventoryProps} /> };
}

export function buildSupportColumnPanels(props: {
  recoveryProps: React.ComponentProps<typeof RecoveryPanel>;
  playerNotesProps: React.ComponentProps<typeof PlayerNotesPanel>;
  /** null when the character has no campaign -- Shared Notes doesn't exist at all then. */
  sharedNotesProps: React.ComponentProps<typeof SharedNotesPanel> | null;
  classFeaturesProps: React.ComponentProps<typeof ClassFeaturesPanel>;
  creaturesProps: React.ComponentProps<typeof CharacterCreaturesPanel>;
  countersProps: React.ComponentProps<typeof CharacterCountersPanel>;
}): CharacterPanelRegistry {
  return {
    [PANEL_IDS.recovery]: <RecoveryPanel {...props.recoveryProps} />,
    [PANEL_IDS.playerNotes]: <PlayerNotesPanel {...props.playerNotesProps} />,
    ...(props.sharedNotesProps ? { [PANEL_IDS.sharedNotes]: <SharedNotesPanel {...props.sharedNotesProps} /> } : {}),
    [PANEL_IDS.playerFeatures]: <ClassFeaturesPanel {...props.classFeaturesProps} />,
    [PANEL_IDS.creatures]: <CharacterCreaturesPanel {...props.creaturesProps} />,
    [PANEL_IDS.counters]: <CharacterCountersPanel {...props.countersProps} />,
  };
}
