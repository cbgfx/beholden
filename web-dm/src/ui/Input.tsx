import React from "react";
import { Input as SharedInput } from "@beholden/shared/ui";
import { dmSharedInputTheme } from "@/ui/sharedUiTheme";

export function Input(props: Omit<React.ComponentProps<typeof SharedInput>, "theme">) {
  return <SharedInput {...props} theme={dmSharedInputTheme} />;
}
