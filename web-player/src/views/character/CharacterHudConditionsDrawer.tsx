import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import { IconConditionByKey, IconConditions } from "@/icons";
import type { ConditionInstance } from "@/views/character/CharacterSheetTypes";

interface ConditionDef {
  key: string;
  name: string;
}

const SPECIAL_CONDITION_KEYS = new Set(["concentration", "hexed", "marked"]);

export function CharacterHudConditionsDrawer(props: {
  condPickerOpen: boolean;
  availableConditions: ConditionDef[];
  accentColor: string;
  conditions: ConditionInstance[];
  condSaving: boolean;
  toggleCondition: (key: string) => void;
  onClose: () => void;
}) {
  const { condPickerOpen, availableConditions, accentColor, conditions, condSaving, toggleCondition, onClose } = props;

  if (!condPickerOpen) return null;

  const sortedConditions = [...availableConditions].sort((a, b) => a.name.localeCompare(b.name));
  const conditionGroups = [
    sortedConditions.filter((condition) => !SPECIAL_CONDITION_KEYS.has(condition.key)),
    sortedConditions.filter((condition) => SPECIAL_CONDITION_KEYS.has(condition.key)),
  ].filter((group) => group.length > 0);

  return (
    <RightDrawer
      onClose={onClose}
      width="min(340px, 90vw)"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconConditions size={16} style={{ color: accentColor }} />
          <span style={{ fontWeight: 900, fontSize: "var(--fs-subtitle)", letterSpacing: "0.08em", textTransform: "uppercase", color: accentColor }}>Conditions</span>
          {condSaving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>saving...</span>}
        </div>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {conditionGroups.map((group, groupIndex) => (
          <div key={groupIndex} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {group.map((cd) => {
              const active = conditions.some((c) => c.key === cd.key);
              return (
                <button
                  key={cd.key}
                  onClick={() => toggleCondition(cd.key)}
                  disabled={condSaving}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 5,
                    padding: "10px 6px",
                    borderRadius: 8,
                    background: active ? `${accentColor}22` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? accentColor + "77" : "rgba(255,255,255,0.10)"}`,
                    color: active ? accentColor : C.muted,
                    cursor: condSaving ? "wait" : "pointer",
                    transition: "all 120ms",
                    outline: "none",
                  }}
                >
                  <IconConditionByKey condKey={cd.key} size={22} style={{ opacity: active ? 1 : 0.5 }} />
                  <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{cd.name}</span>
                  {active && <span style={{ fontSize: "var(--fs-tiny)", color: accentColor, fontWeight: 900, letterSpacing: "0.04em" }}>ACTIVE</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </RightDrawer>
  );
}
