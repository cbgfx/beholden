import type { WorkspacePanel } from "@/layout/workspace/DmWorkspace";
import type { EncounterActor } from "@/domain/types/domain";

import type { AddMonsterOptions } from "@/domain/types/domain";

import { EncounterRosterPanel } from "@/views/CampaignView/panels/EncounterRosterPanel";

type Props = {
  selectedEncounter: { id: string; name: string } | null;
  combatants: EncounterActor[];
  xpByCombatantId: Record<string, number>;
  playersById?: Record<string, { imageUrl?: string | null }>;
  onAddMonster: (
    monsterId: string,
    qty: number,
    opts?: AddMonsterOptions,
  ) => Promise<void>;
  onAddWorldAction: (name: string, description?: string) => Promise<void>;
  onAddAllPlayers: () => Promise<void>;
  onOpenCombat: () => void;
  onEditCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => Promise<void>;
};

export function buildRosterCenterPanels(props: Props) {
  return [
    {
      id: "encounter-roster",
      title: "Encounter Roster",
      column: 1,
      content: (
        <EncounterRosterPanel
          selectedEncounter={props.selectedEncounter}
          combatants={props.combatants}
          xpByCombatantId={props.xpByCombatantId}
          playersById={props.playersById}
          onAddMonster={props.onAddMonster}
          onAddWorldAction={props.onAddWorldAction}
          onAddAllPlayers={props.onAddAllPlayers}
          onOpenCombat={props.onOpenCombat}
          onEditCombatant={props.onEditCombatant}
          onRemoveCombatant={props.onRemoveCombatant}
        />
      ),
    },
  ] satisfies WorkspacePanel[];
}
