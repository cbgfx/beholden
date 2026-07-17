import { AboutView as SharedAboutView } from "@beholden/shared/views";
import { Panel } from "@/ui/Panel";

export function AboutView() {
  return <SharedAboutView PanelComponent={Panel} />;
}
