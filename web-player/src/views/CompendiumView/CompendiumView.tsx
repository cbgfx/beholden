import { CompendiumView as SharedCompendiumView } from "@beholden/shared/views/compendium/CompendiumView";
import { Panel } from "@/ui/Panel";

/** The player's compendium: the shared, read-only compendium inside the player app's panels. */
export function CompendiumView() {
  return <SharedCompendiumView Panel={Panel} />;
}
