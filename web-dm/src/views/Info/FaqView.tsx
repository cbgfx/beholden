import { FaqView as SharedFaqView } from "@beholden/shared/views";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";

export function FaqView() {
  return <SharedFaqView PanelComponent={Panel} textColor={theme.colors.text} />;
}
