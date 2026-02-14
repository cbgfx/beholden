import React from "react";
import { RulesReferencePanel } from "@/views/CompendiumView/panels/RulesReferencePanel";

export function CompendiumCenterColumn() {
  return (
    <div style={{ minWidth: 0, minHeight: 0 }}>
      <RulesReferencePanel />
    </div>
  );
}
