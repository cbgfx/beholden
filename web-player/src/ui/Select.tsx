import React from "react";
import { Select as SharedSelect } from "@beholden/shared/ui";
import { C, withAlpha } from "@/lib/theme";

export function Select(props: Omit<React.ComponentProps<typeof SharedSelect>, "theme">) {
  return (
    <SharedSelect
      {...props}
      theme={{
        radius: 10,
        panelBorder: C.panelBorder,
        inputBg: "rgba(0,0,0,0.30)",
        bg: C.bg,
        text: C.text,
        textDark: C.textDark,
        accentHighlight: C.accentHl,
        withAlpha,
      }}
    />
  );
}
