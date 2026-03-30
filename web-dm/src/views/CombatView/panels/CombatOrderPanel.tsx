import React from "react";
import type { Combatant } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { IconInitiative } from "@/icons";

import { useCombatOrderModel } from "@/views/CombatView/panels/CombatOrderPanel/hooks/useCombatOrderModel";
import { CombatOrderRow } from "@/views/CombatView/panels/CombatOrderPanel/components/CombatOrderRow";

export function CombatOrderPanel(props: {
  combatants: Combatant[];
  playersById: Record<
    string,
    {
      playerName: string;
      characterName: string;
      class: string;
      species: string;
      level: number;
      ac: number;
      hpMax: number;
      hpCurrent: number;
      deathSaves?: { success: number; fail: number };
    }
  >;
  monsterCrById: Record<string, number | null | undefined>;
  activeId: string | null;
  targetId: string | null;
  onSelectTarget: (id: string) => void;
  onSetInitiative: (id: string, initiative: number) => void;
  onToggleReaction: (id: string) => void;
  bulkMode?: boolean;
  bulkSelectedIds?: Set<string>;
  onToggleBulkSelect?: (id: string) => void;
}) {
  const { upcoming, wrapped } = useCombatOrderModel({ combatants: props.combatants, activeId: props.activeId });

  const getRowShadow = (isActive: boolean, isTarget: boolean) => {
    // Target glow should remain visible even when the target is also the active combatant (self-target).
    if (isActive && isTarget) {
      return `
        0 0 0 2px ${theme.colors.accentHighlight} inset,
        0 0 0 4px ${theme.colors.blue} inset,
        0 0 18px ${theme.colors.blue} inset,
        0 6px 18px rgba(0,0,0,0.18)
      `;
    }
    if (isActive) {
      return `0 0 0 2px ${theme.colors.accentHighlight} inset, 0 6px 18px rgba(0,0,0,0.18)`;
    }
    if (isTarget) {
      // Inset-only to avoid scrollbars in the initiative list.
      return `0 0 0 2px ${theme.colors.blue} inset, 0 0 18px ${theme.colors.blue} inset`;
    }
    return "none";
  };

  return (
    <Panel
      storageKey="combat-order"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconInitiative size={18} title="Initiative" />
          <span style={{ fontSize: "var(--fs-title)", color: theme.colors.accentPrimary, fontWeight: 900 }}>INITIATIVE</span>
        </div>
      }
    >
      <style>
        {`@keyframes beholdenTargetPulse {
            0% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
            50% { filter: drop-shadow(0 0 14px ${theme.colors.blue}80); }
            100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
          }`}
      </style>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {upcoming.map((c) => (
          <CombatOrderRow
            key={c.id}
            section="upcoming"
            combatant={c}
            playersById={props.playersById}
            activeId={props.activeId}
            targetId={props.targetId}
            onSelectTarget={props.onSelectTarget}
            onSetInitiative={props.onSetInitiative}
            onToggleReaction={props.onToggleReaction}
            getRowShadow={getRowShadow}
            bulkMode={props.bulkMode}
            isBulkSelected={props.bulkSelectedIds?.has(c.id)}
            onToggleBulkSelect={props.onToggleBulkSelect}
          />
        ))}

        {wrapped.length ? (
          <div style={{ padding: "6px 2px 2px", color: theme.colors.accentPrimary, fontSize: "var(--fs-title)", fontWeight: 900 }}>
            NEXT ROUND
          </div>
        ) : null}

        {wrapped.map((c) => (
          <CombatOrderRow
            key={c.id}
            section="wrapped"
            combatant={c}
            playersById={props.playersById}
            activeId={props.activeId}
            targetId={props.targetId}
            onSelectTarget={props.onSelectTarget}
            onSetInitiative={props.onSetInitiative}
            onToggleReaction={props.onToggleReaction}
            getRowShadow={getRowShadow}
            bulkMode={props.bulkMode}
            isBulkSelected={props.bulkSelectedIds?.has(c.id)}
            onToggleBulkSelect={props.onToggleBulkSelect}
          />
        ))}
      </div>
    </Panel>
  );
}
