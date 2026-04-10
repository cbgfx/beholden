import React from "react";
import { IconAC, IconHP, IconSpeed } from "@/icons";
import { theme } from "@/theme/theme";
import { StatBar } from "@/components/CharacterSheet/StatBar";
import type { CharacterSheetStats } from "@/components/CharacterSheet/types";

export function CharacterSheetVitals({
  stats,
  compact,
}: {
  stats: CharacterSheetStats;
  compact: boolean;
}) {
  const speedText = (() => {
    const displayValue = (stats.speedDisplay ?? "").trim();
    if (displayValue) return displayValue;
    return stats.speed == null ? "--" : `${stats.speed} ft.`;
  })();

  const hpValue =
    Number.isFinite(stats.hpCur) && Number.isFinite(stats.hpMax) && stats.hpMax > 0
      ? `${stats.hpCur} / ${stats.hpMax}`
      : "--";

  const tempHp = Number(stats.tempHp ?? 0) || 0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 120 : 140}px, 1fr))`,
        borderRadius: 12,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.panelBg,
        overflow: "hidden",
      }}
    >
      <StatBar compact={compact} icon={<IconAC size={14} />} label="Armor Class" value={Number.isFinite(stats.ac) ? stats.ac : "--"} />
      <StatBar
        compact={compact}
        icon={<IconHP size={14} />}
        label="Hit Points"
        value={
          <>
            {hpValue}
            {tempHp > 0 && (
              <span style={{ color: theme.colors.accentHighlight, fontSize: "var(--fs-small)", marginLeft: 4 }}>
                +{tempHp}t
              </span>
            )}
          </>
        }
      />
      <StatBar compact={compact} icon={<IconSpeed size={14} />} label="Speed" value={speedText} />
    </div>
  );
}
