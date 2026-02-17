import * as React from "react";

import { theme } from "@/theme/theme";
import { conditionIconByKey } from "@/icons/conditions";
import { CONDITION_DEFS } from "@/drawers/drawers/combatant/conditions";

function conditionLabel(key: string) {
  return CONDITION_DEFS.find((d) => d.key === key)?.name ?? key;
}

type Props = {
  conditions: any[];
  onClick: () => void;
  maxShown?: number;
  iconColor?: string;
};

/**
 * HUD strip shown under the HP bar.
 * - Shows up to `maxShown` condition icons.
 * - Any extra conditions display as a +n chip.
 */
export function HudConditionsStrip(props: Props) {
  const rawConditions = Array.isArray(props.conditions) ? props.conditions : [];
  if (!rawConditions.length) return null;

  const maxShown = typeof props.maxShown === "number" ? props.maxShown : 6;
  const shown = rawConditions.slice(0, maxShown);
  const extra = Math.max(0, rawConditions.length - shown.length);

  return (
    <button
      type="button"
      onClick={props.onClick}
      title="Edit conditions"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "4px 6px",
        marginTop: -2,
        borderRadius: 10,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.bg,
        cursor: "pointer"
      }}
    >
      {shown.map((cond: any, idx: number) => {
        const key = String(cond?.key ?? "");
        const CondIcon = conditionIconByKey[key];
        if (!CondIcon) return null;

        return (
          <span
            key={`${key}-${cond?.casterId ?? ""}-${idx}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              borderRadius: 999,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: theme.colors.panelBg,
              boxShadow: `0 6px 16px rgba(0,0,0,0.20)`
            }}
            title={conditionLabel(key)}
          >
            <CondIcon
              size={14}
              style={{ opacity: 0.92, color: props.iconColor ?? theme.colors.text }}
            />
          </span>
        );
      })}

      {extra > 0 ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 22,
            padding: "0 8px",
            borderRadius: 999,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: theme.colors.panelBg,
            color: theme.colors.muted,
            fontWeight: 900,
            fontSize: "var(--fs-tiny)",
            boxShadow: `0 6px 16px rgba(0,0,0,0.20)`
          }}
          title={`${extra} more condition${extra === 1 ? "" : "s"}`}
        >
          +{extra}
        </span>
      ) : null}
    </button>
  );
}
