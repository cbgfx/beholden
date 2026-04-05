import React from "react";
import { Button as SharedButton } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";

type Props = React.ComponentProps<typeof SharedButton>;

export function Button(props: Omit<Props, "theme">) {
  return (
    <SharedButton
      {...props}
      theme={{
        radius: theme.radius.control,
        text: theme.colors.text,
        textDark: theme.colors.textDark,
        panelBorder: theme.colors.panelBorder,
        accentPrimary: theme.colors.accentPrimary,
        red: theme.colors.red,
        green: theme.colors.green,
        bloody: theme.colors.bloody,
      }}
    />
  );
}
