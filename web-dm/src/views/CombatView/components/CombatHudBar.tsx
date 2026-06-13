import * as React from "react";

import type { CampaignCharacter, EncounterActor } from "@/domain/types/domain";
import { CombatDeltaControls } from "@/views/CombatView/components/CombatDeltaControls";
import { HudFighterCard } from "@/views/CombatView/components/HudFighterCard";

type Role = "active" | "target";

type Props = {
  isNarrow: boolean;
  active: EncounterActor | null;
  target: EncounterActor | null;
  playersById: Record<string, CampaignCharacter>;
  renderCombatantIcon: (combatant: EncounterActor | null) => React.ReactNode;
  activeId: string | null;
  targetId: string | null;
  onOpenConditions: (combatantId: string, role: Role, casterId: string | null) => void;

  delta: string;
  deltaDisabled: boolean;
  onChangeDelta: (value: string) => void;
  onApplyDamage: () => void;
  onApplyHeal: () => void;
  onOpenConditionsFromDelta: () => void;
  bulkMode: boolean;
  bulkCount: number;
  onToggleBulkMode: () => void;
};

/**
 * Wide-layout combat HUD strip shown above the three-column combat view.
 * Keeps CombatView focused on orchestration while the top "active vs target"
 * presentation lives in one place.
 */
export function CombatHudBar(props: Props) {
  if (props.isNarrow) return null;

  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
        gap: 18,
        alignItems: "center",
      }}
    >
      <HudFighterCard
        combatant={props.active}
        role="active"
        playersById={props.playersById}
        renderCombatantIcon={props.renderCombatantIcon}
        activeId={props.activeId}
        targetId={props.targetId}
        onOpenConditions={props.onOpenConditions}
      />

      <div>
        <CombatDeltaControls
          value={props.delta}
          targetId={props.targetId}
          disabled={props.deltaDisabled}
          onChange={props.onChangeDelta}
          onApplyDamage={props.onApplyDamage}
          onApplyHeal={props.onApplyHeal}
          onOpenConditions={props.onOpenConditionsFromDelta}
          bulkMode={props.bulkMode}
          bulkCount={props.bulkCount}
          onToggleBulkMode={props.onToggleBulkMode}
        />
      </div>

      <HudFighterCard
        combatant={props.target}
        role="target"
        playersById={props.playersById}
        renderCombatantIcon={props.renderCombatantIcon}
        activeId={props.activeId}
        targetId={props.targetId}
        onOpenConditions={props.onOpenConditions}
      />
    </div>
  );
}
