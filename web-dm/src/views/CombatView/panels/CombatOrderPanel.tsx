import type { EncounterActor } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { IconInitiative } from "@/icons";

import { useCombatOrderModel } from "@/views/CombatView/panels/CombatOrderPanel/hooks/useCombatOrderModel";
import { CombatOrderRow } from "@/views/CombatView/panels/CombatOrderPanel/components/CombatOrderRow";

export function CombatOrderPanel(props: {
  combatants: EncounterActor[];
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
      imageUrl?: string | null;
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
  const panelTitleColor = "var(--campaign-accent, #a78bfa)";
  const targetAccent = theme.colors.accentPrimary;
  const { upcoming, wrapped } = useCombatOrderModel({ combatants: props.combatants, activeId: props.activeId });

  return (
    <Panel
      storageKey="combat-order"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconInitiative size={18} title="Initiative" />
          <span style={{ fontSize: "var(--fs-title)", color: panelTitleColor, fontWeight: 900 }}>INITIATIVE</span>
        </div>
      }
    >
      <style>
        {`@keyframes beholdenTargetPulse {
            0% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
            50% { filter: drop-shadow(0 0 8px ${targetAccent}40); }
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
            bulkMode={props.bulkMode}
            isBulkSelected={props.bulkSelectedIds?.has(c.id)}
            onToggleBulkSelect={props.onToggleBulkSelect}
          />
        ))}

        {wrapped.length ? (
          <div style={{ padding: "6px 2px 2px", color: panelTitleColor, fontSize: "var(--fs-title)", fontWeight: 900 }}>
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
            bulkMode={props.bulkMode}
            isBulkSelected={props.bulkSelectedIds?.has(c.id)}
            onToggleBulkSelect={props.onToggleBulkSelect}
          />
        ))}
      </div>
    </Panel>
  );
}
