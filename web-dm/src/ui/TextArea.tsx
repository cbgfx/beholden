import React from "react";
import { TextArea as SharedTextArea } from "@beholden/shared/ui";
import { dmSharedInputTheme } from "@/ui/sharedUiTheme";

export function TextArea(props: Omit<React.ComponentProps<typeof SharedTextArea>, "theme">) {
  return <SharedTextArea {...props} theme={dmSharedInputTheme} />;
}
