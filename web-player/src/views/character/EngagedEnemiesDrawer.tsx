import React from "react";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import { conditionLabel } from "@beholden/shared/domain/conditions";
import { ABILITY_LABELS } from "@/views/character/CharacterSheetConstants";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import type { CombatAlly, EngagedEnemy } from "@/views/character/useCharacterLiveUpdates";

function conditionText(condition: { key: string; hexAbility?: string }): string {
  const label = conditionLabel(condition.key);
  if (condition.key === "hexed" && condition.hexAbility) {
    const abilityLabel = ABILITY_LABELS[condition.hexAbility as AbilKey] ?? condition.hexAbility.toUpperCase();
    return `${label} (${abilityLabel})`;
  }
  return label;
}

const healthColor: Record<EngagedEnemy["health"], string> = {
  Damaged: "#f59e0b",
  Bloodied: "#ef4444",
  Down: "#94a3b8",
};

const allyHealthColor: Record<CombatAlly["health"], string> = {
  Healthy: "#22c55e",
  Damaged: "#f59e0b",
  Bloody: "#ef4444",
  Down: "#94a3b8",
};

// One combatant card shared by the Allies and Enemies lists below: name + health badge,
// dimmed/struck-through when `isDown`, with room for an optional header addon (allies' HP%)
// and below-name content (allies' HP bar, enemies' condition badges).
function CombatantCard({
  name,
  healthLabel,
  healthColor: statusColor,
  headerExtra,
  isDown,
  children,
}: {
  name: string;
  healthLabel: string;
  healthColor: string;
  headerExtra?: React.ReactNode;
  isDown?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.panelBorder}`, background: "rgba(255,255,255,0.035)", opacity: isDown ? 0.55 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text, fontWeight: 750, textDecoration: isDown ? "line-through" : "none" }}>{name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ color: statusColor, fontWeight: 800 }}>{healthLabel}</span>
          {headerExtra}
        </span>
      </div>
      {children}
    </div>
  );
}

export function EngagedEnemiesDrawer(props: {
  open: boolean;
  enemies: EngagedEnemy[];
  allies: CombatAlly[];
  onClose: () => void;
}) {
  if (!props.open) return null;
  return (
    <RightDrawer title="Combat View" onClose={props.onClose}>
      <div style={{ color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>Allies</div>
      {props.allies.length === 0 ? (
        <div style={{ color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>No other allies are in this encounter.</div>
      ) : (
        <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
          {props.allies.map((ally) => (
            <CombatantCard
              key={ally.id}
              name={ally.name}
              healthLabel={ally.health}
              healthColor={allyHealthColor[ally.health]}
              headerExtra={ally.hpPercent != null ? <span style={{ color: C.muted, fontWeight: 700 }}>{ally.hpPercent}%</span> : null}
              isDown={ally.health === "Down"}
            >
              {ally.hpPercent != null && (
                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${ally.hpPercent}%`, borderRadius: 3, background: allyHealthColor[ally.health], transition: "width 0.4s ease" }} />
                </div>
              )}
            </CombatantCard>
          ))}
        </div>
      )}
      <div style={{ color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 800, textTransform: "uppercase", marginBottom: 8 }}>Enemies</div>
      {props.enemies.length === 0 ? (
        <div style={{ color: C.muted, lineHeight: 1.6 }}>
          No enemies are engaged yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {props.enemies.map((enemy) => (
            <CombatantCard
              key={enemy.id}
              name={enemy.name}
              healthLabel={enemy.health}
              healthColor={healthColor[enemy.health]}
              isDown={enemy.health === "Down"}
            >
              {enemy.conditions && enemy.conditions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {enemy.conditions.map((condition) => (
                    <span key={condition.key} style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.colorPinkRed, border: `1px solid ${C.colorPinkRed}`, borderRadius: 6, padding: "1px 6px" }}>
                      {conditionText(condition)}
                    </span>
                  ))}
                </div>
              )}
            </CombatantCard>
          ))}
        </div>
      )}
    </RightDrawer>
  );
}
