import React from "react";
import { Panel } from "@/ui/Panel";
import { InfoPageLayout } from "./InfoPageLayout";

export function UpdatesView() {
  return (
    <InfoPageLayout title="Future Updates">
      <Panel title="Roadmap (high level)" style={{ marginBottom: 12 }}>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li><b>Conditions:</b> optional durations + clear timers.</li>
          <li><b>Combat Flow:</b> Reaction tracker, Lair Action, Legendary Action tracking, Spell slot tracking (for monsterS)</li>
          <li><b>Compendium:</b> richer filters, better import validation (Schema Validation).</li>
          <li><b>Quality of life:</b> save-state indicator, autosave hardening, schema migrations.</li>
        </ul>
      </Panel>
    </InfoPageLayout>
  );
}
