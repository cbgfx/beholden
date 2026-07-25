import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import { conditionLabel } from "@beholden/shared/domain/conditions";
import type { EngagedEnemy } from "@/views/character/useCharacterLiveUpdates";

const healthColor: Record<EngagedEnemy["health"], string> = {
  Damaged: "#f59e0b",
  Bloodied: "#ef4444",
  Down: "#94a3b8",
};

export function EngagedEnemiesDrawer(props: {
  open: boolean;
  enemies: EngagedEnemy[];
  onClose: () => void;
}) {
  if (!props.open) return null;
  return (
    <RightDrawer title="Engaged Enemies" onClose={props.onClose}>
      {props.enemies.length === 0 ? (
        <div style={{ color: C.muted, lineHeight: 1.6 }}>
          No enemies have taken damage in this encounter yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {props.enemies.map((enemy) => {
            const isDown = enemy.health === "Down";
            return (
              <div key={enemy.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.panelBorder}`, background: "rgba(255,255,255,0.035)", opacity: isDown ? 0.55 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text, fontWeight: 750, textDecoration: isDown ? "line-through" : "none" }}>{enemy.name}</span>
                  <span style={{ flexShrink: 0, color: healthColor[enemy.health], fontWeight: 800 }}>{enemy.health}</span>
                </div>
                {enemy.conditions && enemy.conditions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {enemy.conditions.map((key) => (
                      <span key={key} style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.colorPinkRed, border: `1px solid ${C.colorPinkRed}`, borderRadius: 6, padding: "1px 6px" }}>
                        {conditionLabel(key)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </RightDrawer>
  );
}
