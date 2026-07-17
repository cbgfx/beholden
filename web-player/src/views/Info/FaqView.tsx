import { FaqView as SharedFaqView } from "@beholden/shared/views";
import { Panel } from "@/ui/Panel";

export function FaqView() {
  return <SharedFaqView PanelComponent={Panel} />;
}
