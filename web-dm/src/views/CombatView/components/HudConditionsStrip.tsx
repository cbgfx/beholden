import * as React from "react";
import { conditionLabel } from "@beholden/shared/domain";

import { theme } from "@/theme/theme";
import { conditionIconByKey } from "@/icons/conditions";
import type { ConditionInstance } from "@/domain/conditions";

import "@/views/CombatView/combatView.css";

type Props = {
  conditions: ConditionInstance[];
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
      className="cvCondStrip"
      style={
        {
          "--cv-panelBorder": theme.colors.panelBorder,
          "--cv-panelBg": theme.colors.panelBg,
          "--cv-bg": theme.colors.bg,
          "--cv-muted": theme.colors.muted,
          "--cv-condIconColor": props.iconColor ?? theme.colors.text
        } as React.CSSProperties
      }
    >
      {shown.map((cond, idx) => {
        const key = String(cond?.key ?? "");
        const CondIcon = conditionIconByKey[key as keyof typeof conditionIconByKey];
        if (!CondIcon) return null;

        return (
          <span
            key={`${key}-${cond?.casterId ?? ""}-${idx}`}
            className="cvCondChip"
            title={conditionLabel(key)}
          >
            <CondIcon size={14} style={{ opacity: 0.92 }} />
          </span>
        );
      })}

      {extra > 0 ? (
        <span
          className="cvCondMore"
          title={`${extra} more condition${extra === 1 ? "" : "s"}`}
        >
          +{extra}
        </span>
      ) : null}
    </button>
  );
}
