import { UpdatesView as SharedUpdatesView } from "@beholden/shared/views";
import { Panel } from "@/ui/Panel";

export function UpdatesView() {
  return <SharedUpdatesView PanelComponent={Panel} />;
}
