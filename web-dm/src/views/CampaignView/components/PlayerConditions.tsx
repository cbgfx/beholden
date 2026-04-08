import React from "react";
import { theme } from "@/theme/theme";
import { conditionIconByKey } from "@/icons/conditions";
import { conditionLabel } from "@/domain/conditions";

export function PlayerConditions({ conditions }: { conditions: { key: string; casterId?: string | null }[] }) {
  if (!conditions.length) return null;
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 2 }}>
      {conditions.map((c, i) => {
        const CondIcon = conditionIconByKey[c.key as keyof typeof conditionIconByKey];
        return (
          <span
            key={`${c.key}-${i}`}
            title={conditionLabel(c.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: 999,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: theme.colors.panelBg,
              fontSize: "var(--fs-tiny)", fontWeight: 900, color: theme.colors.muted,
            }}
          >
            {CondIcon ? <CondIcon size={11} /> : null}
            {conditionLabel(c.key)}
          </span>
        );
      })}
    </div>
  );
}