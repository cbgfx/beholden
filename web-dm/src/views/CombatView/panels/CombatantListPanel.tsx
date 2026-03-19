import { Panel } from "@/ui/Panel";
import { Combatant } from "@/domain/types/domain";

type Props = {
  combatants: Combatant[];
  activeCombatantId?: string;
  onSelect: (id: string) => void;
};

export function CombatantListPanel({
  combatants,
  activeCombatantId,
  onSelect,
}: Props) {
  return (
    <Panel title="Order">
      {combatants.map((c) => (
        <div
          key={c.id}
          onClick={() => onSelect(c.id)}
          style={{
            padding: "6px 8px",
            cursor: "pointer",
            background:
              c.id === activeCombatantId
                ? "var(--accent-600)"
                : "transparent",
            borderRadius: 6,
          }}
        >
          <div style={{ fontWeight: 600 }}>{c.label}</div>
          <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>
            AC {Number(c.ac ?? 0) + (Number(c.overrides?.acBonus ?? 0) || 0)} · HP {Number(c.hpCurrent ?? 0)}/{Math.max(1, Number(c.hpMax ?? 0) + (Number(c.overrides?.hpMaxOverride ?? 0) || 0))}{(Number(c.overrides?.tempHp ?? 0) || 0) ? ` (+${Number(c.overrides?.tempHp ?? 0) || 0}t)` : ``}
          </div>
        </div>
      ))}
    </Panel>
  );
}
