import React from "react";
import { C } from "@/lib/theme";
import { MonsterStatblock } from "@/views/CompendiumView/panels/MonsterStatblock";
import { CharacterAbilitiesPanels, CharacterProficienciesPanel } from "@/views/character/CharacterAbilitiesPanels";
import { CharacterCombatPanels } from "@/views/character/CharacterCombatPanels";
import { CharacterCreaturesPanel } from "@/views/character/CharacterCreaturesPanel";
import { CharacterDefensesPanel } from "@/views/character/CharacterDefensesPanel";
import { CharacterHudPanel } from "@/views/character/CharacterHudPanel";
import { CharacterSupportPanels } from "@/views/character/CharacterSupportPanels";
import { InventoryPanel } from "@/views/character/CharacterInventoryPanel";
import { ItemSpellsPanel } from "@/views/character/CharacterItemSpellsPanel";
import { RichSpellsPanel } from "@/views/character/CharacterSpellsPanel";
export function CharacterPrimaryColumn(props: {
  hudProps: React.ComponentProps<typeof CharacterHudPanel>;
  combatProps: React.ComponentProps<typeof CharacterCombatPanels>;
  abilitiesProps: React.ComponentProps<typeof CharacterAbilitiesPanels>;
  defensesProps: React.ComponentProps<typeof CharacterDefensesPanel>;
  proficienciesProps: React.ComponentProps<typeof CharacterProficienciesPanel>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
      <CharacterAbilitiesPanels {...props.abilitiesProps} />
      <CharacterDefensesPanel {...props.defensesProps} />
      <CharacterProficienciesPanel {...props.proficienciesProps} />
    </div>
  );
}

export function CharacterActionColumn(props: {
  combatProps: React.ComponentProps<typeof CharacterCombatPanels>;
  polymorphed: boolean;
  polymorphMonsterState: { monster: React.ComponentProps<typeof MonsterStatblock>["monster"] | null; busy: boolean; error: string | null };
  itemSpellsProps: React.ComponentProps<typeof ItemSpellsPanel>;
  richSpellsProps: React.ComponentProps<typeof RichSpellsPanel>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <CharacterCombatPanels {...props.combatProps} showStats={false} />
      {props.polymorphed ? (
        props.polymorphMonsterState.monster ? (
          <MonsterStatblock monster={props.polymorphMonsterState.monster} hideSummaryBar />
        ) : props.polymorphMonsterState.busy ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.muted }}>
            Loading transformed form...
          </div>
        ) : props.polymorphMonsterState.error ? (
          <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.red }}>
            {props.polymorphMonsterState.error}
          </div>
        ) : (
          <div style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, color: C.muted }}>
            Transformed form details are unavailable right now.
          </div>
        )
      ) : (
        <>
          <ItemSpellsPanel {...props.itemSpellsProps} />
          <RichSpellsPanel {...props.richSpellsProps} />
        </>
      )}
    </div>
  );
}

export function CharacterInventoryColumn(props: {
  inventoryProps: React.ComponentProps<typeof InventoryPanel>;
}) {
  return <InventoryPanel {...props.inventoryProps} />;
}

export function CharacterSupportColumn(
  props: React.ComponentProps<typeof CharacterSupportPanels> & {
    creaturesProps?: React.ComponentProps<typeof CharacterCreaturesPanel>;
  },
) {
  const { creaturesProps, ...supportProps } = props;
  return (
    <CharacterSupportPanels
      {...supportProps}
      afterUpkeep={creaturesProps ? <CharacterCreaturesPanel {...creaturesProps} /> : undefined}
    />
  );
}
