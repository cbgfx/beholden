import React from "react";
import { Select as SharedSelect } from "@beholden/shared/ui";
import { theme, withAlpha } from "@/theme/theme";

export function Select(props: React.ComponentProps<typeof SharedSelect>) {
  return (
    <SharedSelect
      {...props}
      theme={{
        radius: theme.radius.control,
        panelBorder: theme.colors.panelBorder,
        inputBg: theme.colors.inputBg,
        bg: theme.colors.bg,
        text: theme.colors.text,
        textDark: theme.colors.textDark,
        accentHighlight: theme.colors.accentHighlight,
        withAlpha,
      }}
    />
  );
}
