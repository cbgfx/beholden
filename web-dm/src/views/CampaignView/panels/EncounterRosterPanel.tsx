import React from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { MonsterPickerModal } from "@/views/CampaignView/monsterPicker/MonsterPickerModal";
import type { EncounterActor } from "@/domain/types/domain";
import { EncounterRosterHeaderActions } from "@/views/CampaignView/panels/EncounterRosterPanel/EncounterRosterHeaderActions";
import { EncounterRosterList } from "@/views/CampaignView/panels/EncounterRosterPanel/EncounterRosterList";
import type { CombatantVM } from "@/views/CampaignView/panels/EncounterRosterPanel/utils";
import { mapCombatantsToVM } from "@/views/CampaignView/panels/EncounterRosterPanel/utils";
import { WorldActionModal } from "@/views/CampaignView/panels/EncounterRosterPanel/WorldActionModal";

export function EncounterRosterPanel(props: {
  selectedEncounter: { id: string; name: string } | null;

  // NOTE: store/API combatants come in here (not the VM)
  combatants: EncounterActor[];
  playersById?: Record<string, { imageUrl?: string | null }>;

  // Optional per-combatant XP (for monster/inpc rows).
  // Keyed by combatant id.
  xpByCombatantId?: Record<string, number>;

  onAddMonster: (
    monsterId: string,
    qty: number,
    opts?: AddMonsterOptions
  ) => void;
  onAddWorldAction: (name: string, description?: string) => Promise<void> | void;

  onAddAllPlayers: () => void;
  onOpenCombat: () => void;
  onEditCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [worldActionOpen, setWorldActionOpen] = React.useState(false);

  // Map raw combatants -> VM used by this panel (keeps CampaignView simple)
  const combatantsVM: CombatantVM[] = React.useMemo(
    () => mapCombatantsToVM(props.combatants ?? [], props.xpByCombatantId, props.playersById),
    [props.combatants, props.xpByCombatantId, props.playersById]
  );

  const encounter = props.selectedEncounter;

  return (
    <Panel
      storageKey="campaign-roster"
      title="Combat Roster"
      actions={
        encounter ? (
          <EncounterRosterHeaderActions
            onAddAllPlayers={props.onAddAllPlayers}
            onOpenCombat={props.onOpenCombat}
          />
        ) : null
      }
    >
      {!encounter ? (
        <div style={{ color: theme.colors.muted }}>Select an encounter to build the roster.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <EncounterRosterList
            combatants={combatantsVM}
            onEditCombatant={props.onEditCombatant}
            onRemoveCombatant={props.onRemoveCombatant}
          />

          {/* Add monsters */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 8, borderTop: `1px solid ${theme.colors.panelBorder}` }}>
            <Button onClick={() => setWorldActionOpen(true)}>
              + World Action
            </Button>
            <Button onClick={() => setPickerOpen(true)}>
              + Monster
            </Button>
          </div>

          <MonsterPickerModal
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onAddMonster={(id, qty, opts) => props.onAddMonster(id, qty, opts)}
          />
          <WorldActionModal
            isOpen={worldActionOpen}
            onClose={() => setWorldActionOpen(false)}
            onAdd={props.onAddWorldAction}
          />
        </div>
      )}
    </Panel>
  );
}
