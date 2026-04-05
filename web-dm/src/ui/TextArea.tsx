import React from "react";
import { TextArea as SharedTextArea } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";

export function TextArea(props: React.ComponentProps<typeof SharedTextArea>) {
  return (
    <SharedTextArea
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
