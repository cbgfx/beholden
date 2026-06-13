import React from "react";
import { theme } from "@/theme/theme";
import { AbilityTable } from "@/components/CharacterSheet/AbilityTable";
import { CharacterSheetDetailsPanel } from "@/components/CharacterSheet/CharacterSheetDetailsPanel";
import { CharacterSheetVitals } from "@/components/CharacterSheet/CharacterSheetVitals";
import type { CharacterSheetStats } from "@/components/CharacterSheet/types";

export function CharacterSheetPanel(props: {
  stats: CharacterSheetStats;
  topLeft?: React.ReactNode;
  compact?: boolean;
}) {
  const compact = props.compact ?? false;

  return (
    <div style={{ display: "grid", gap: compact ? 8 : 10 }}>
      <CharacterSheetVitals stats={props.stats} compact={compact} />

      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${theme.colors.panelBorder}`,
          background: theme.colors.panelBg,
          padding: compact ? "6px 10px" : "8px 12px",
        }}
      >
        <AbilityTable stats={props.stats} compact={compact} />
      </div>

      <CharacterSheetDetailsPanel infoLines={props.stats.infoLines} compact={compact} />
    </div>
  );
}
