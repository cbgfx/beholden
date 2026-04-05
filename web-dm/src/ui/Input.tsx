import React from "react";
import { Input as SharedInput } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";

export function Input(props: React.ComponentProps<typeof SharedInput>) {
  return (
    <SharedInput
      {...props}
      theme={{
        radius: theme.radius.control,
        panelBorder: theme.colors.panelBorder,
        inputBg: theme.colors.inputBg,
        text: theme.colors.text,
      }}
    />
  );
}
