import type { WorkspacePanel } from "@/layout/workspace/DmWorkspace";

import { TreasurePanel } from "@/components/treasure/TreasurePanel";

type Props = {
  encounterId: string | null;
};

export function buildRosterRightPanels(props: Props) {
  return [
    {
      id: "treasure",
      title: "Treasure",
      column: 2,
      content: props.encounterId ? (
        <TreasurePanel encounterId={props.encounterId} />
      ) : null,
    },
  ] satisfies WorkspacePanel[];
}
