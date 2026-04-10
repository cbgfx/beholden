import React from "react";
import { AbilityScoresCompact } from "@beholden/shared/ui";
import { theme, withAlpha } from "@/theme/theme";
import type { CharacterSheetStats } from "@/components/CharacterSheet/types";
import { abilityMod, fmtMod } from "@/components/CharacterSheet/charSheetUtils";

export function AbilityTable({ stats, compact }: { stats: CharacterSheetStats; compact?: boolean }) {
  return (
    <AbilityScoresCompact
      scores={stats.abilities}
      saves={stats.saves}
      compact={compact}
      accentColor={theme.colors.colorMagic}
      mutedColor={theme.colors.muted}
      textColor={theme.colors.text}
      pillBackground={withAlpha(theme.colors.shadowColor, 0.5)}
      pillBorderColor={theme.colors.panelBorder}
      getModifier={abilityMod}
      formatModifier={fmtMod}
    />
  );
}
