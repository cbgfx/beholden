import * as React from "react";

import { TreasurePanel } from "@/views/CombatRosterView/components/TreasurePanel";

type Props = {
  encounterId: string | null;
};

export function CombatRosterRightColumn(props: Props) {
  return (
    <div className="campaignCol" style={{ display: "grid", gap: 10, alignContent: "start" }}>
      {props.encounterId ? <TreasurePanel encounterId={props.encounterId} /> : null}
    </div>
  );
}
