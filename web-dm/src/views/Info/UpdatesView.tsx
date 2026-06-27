import { UpdatesView as SharedUpdatesView } from "@beholden/shared/views";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";

export function UpdatesView() {
  return <SharedUpdatesView PanelComponent={Panel} textColor={theme.colors.text} />;
}
