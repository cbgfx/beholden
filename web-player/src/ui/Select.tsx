import React from "react";
import { Select as SharedSelect } from "@beholden/shared/ui";
import { playerSharedSelectTheme } from "@/ui/sharedUiTheme";

export function Select(props: Omit<React.ComponentProps<typeof SharedSelect>, "theme">) {
  return <SharedSelect {...props} theme={playerSharedSelectTheme} />;
}
