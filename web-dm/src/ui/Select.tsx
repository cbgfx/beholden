import React from "react";
import { Select as SharedSelect } from "@beholden/shared/ui";
import { dmSharedSelectTheme } from "@/ui/sharedUiTheme";

export function Select(props: Omit<React.ComponentProps<typeof SharedSelect>, "theme">) {
  return <SharedSelect {...props} theme={dmSharedSelectTheme} />;
}
