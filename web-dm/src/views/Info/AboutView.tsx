import React from "react";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { InfoPageLayout } from "./InfoPageLayout";

export function AboutView() {
  return (
    <InfoPageLayout title="About Beholden">
      <Panel title="What is Beholden?" style={{ marginBottom: 12 }}>
        <div style={{ lineHeight: 1.5, color: theme.colors.text }}>
          Beholden is a DM-first, offline-friendly campaign tracker for tabletop RPGs.
          It focuses on fast table flow to help with combat. I like to roll dice in person. I don't need a digital character sheet, initiative tracker, or monster stat block if it means opening another app or tab.
          Beholden is designed to stay out of the way and let you focus on the game.
        </div>
      </Panel>

      <Panel title="Design philosophy" style={{ marginBottom: 12 }}>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Campaign-centric:</b> everything lives inside a campaign.</li>
          <li><b>Speed at the table:</b> fewer clicks, clearer state changes.</li>
          <li><b>Offline-friendly:</b> data is stored locally on disk.</li>
          <li><b>No magic wiring:</b> explicit data flow and predictable behavior.</li>
        </ul>
      </Panel>

      <Panel title="Who made this?">
        <div style={{ lineHeight: 1.6 }}>
          Beholden is made by an indie DM who wanted a tool that stays out of the way.
          If you’d like to support development, hit the pizza button in the footer. 🍕
        </div>
      </Panel>
    </InfoPageLayout>
  );
}
