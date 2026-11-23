import type React from "react";
import { Panel as SharedPanel } from "@beholden/shared/ui";
import { playerSharedPanelTheme } from "@/ui/sharedUiTheme";

type Props = Pick<React.ComponentProps<typeof SharedPanel>, "title" | "actions" | "children" | "style" | "bodyStyle" | "storageKey">;

export function Panel(props: Props) {
  return <SharedPanel {...props} {...playerSharedPanelTheme} />;
}
