import { FaqView as SharedFaqView } from "@beholden/shared/views";
import { C } from "@/lib/theme";
import { Panel } from "@/ui/Panel";

export function FaqView() {
  return <SharedFaqView PanelComponent={Panel} textColor={C.text} />;
}
