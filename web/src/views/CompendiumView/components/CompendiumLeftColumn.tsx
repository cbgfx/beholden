import React from "react";
import { SpellsPanel } from "@/views/CompendiumView/panels/SpellsPanel";

export function CompendiumLeftColumn() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0 }}>
      <SpellsPanel />
    </div>
  );
}
