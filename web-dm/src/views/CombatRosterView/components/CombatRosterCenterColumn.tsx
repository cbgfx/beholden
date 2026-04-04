import type { EncounterActor } from "@/domain/types/domain";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";

import type { AddMonsterOptions } from "@/domain/types/domain";

import { EncounterRosterPanel } from "@/views/CampaignView/panels/EncounterRosterPanel";

type Props = {
  selectedEncounter: { id: string; name: string } | null;
  combatants: EncounterActor[];
  xpByCombatantId: Record<string, number>;
  playersById?: Record<string, { imageUrl?: string | null }>;
  compQ: string;
  onChangeCompQ: (q: string) => void;
  compRows?: CompendiumMonsterRow[];
  onAddMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => Promise<void>;
  onAddAllPlayers: () => Promise<void>;
  onOpenCombat: () => void;
  onEditCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => Promise<void>;
};

export function CombatRosterCenterColumn(props: Props) {
  return (
    <div className="campaignCol" style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <EncounterRosterPanel
        selectedEncounter={props.selectedEncounter}
        combatants={props.combatants}
        xpByCombatantId={props.xpByCombatantId}
        playersById={props.playersById}
        compQ={props.compQ}
        onChangeCompQ={props.onChangeCompQ}
        // Let the MonsterPickerModal fetch its own index when needed.
        compRows={props.compRows ?? []}
        onAddMonster={props.onAddMonster}
        onAddAllPlayers={props.onAddAllPlayers}
        onOpenCombat={props.onOpenCombat}
        onEditCombatant={props.onEditCombatant}
        onRemoveCombatant={props.onRemoveCombatant}
      />
    </div>
  );
}
