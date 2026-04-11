import React from "react";
import { InfoPageLayout } from "@beholden/shared/ui";
import { Panel } from "@/ui/Panel";

export function UpdatesView() {
  return (
    <InfoPageLayout title="Future Updates">
      <Panel title="Roadmap (high level)" style={{ marginBottom: 12 }}>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li><b>Combat Flow:</b> Lair Action, Spell slot tracking (for monsters)</li>
          <li><b>Player:</b> Multiclass, always bug fixes</li>
        </ul>
      </Panel>
    </InfoPageLayout>
  );
}
