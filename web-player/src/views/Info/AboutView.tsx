import { AboutView as SharedAboutView } from "@beholden/shared/views";
import { C } from "@/lib/theme";
import { Panel } from "@/ui/Panel";

export function AboutView() {
  return <SharedAboutView PanelComponent={Panel} textColor={C.text} />;
}
