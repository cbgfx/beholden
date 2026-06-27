import { AboutView as SharedAboutView } from "@beholden/shared/views";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";

export function AboutView() {
  return <SharedAboutView PanelComponent={Panel} textColor={theme.colors.text} />;
}
