import React from "react";
import { Button as SharedButton } from "@beholden/shared/ui";
import { dmSharedButtonTheme } from "@/ui/sharedUiTheme";

type Props = React.ComponentProps<typeof SharedButton>;

export function Button(props: Omit<Props, "theme">) {
  return <SharedButton {...props} theme={dmSharedButtonTheme} />;
}
