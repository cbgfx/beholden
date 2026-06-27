import { UpdatesView as SharedUpdatesView } from "@beholden/shared/views";
import { C } from "@/lib/theme";
import { Panel } from "@/ui/Panel";

export function UpdatesView() {
  return <SharedUpdatesView PanelComponent={Panel} textColor={C.text} />;
}
