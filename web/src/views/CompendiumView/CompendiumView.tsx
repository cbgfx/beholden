import React from "react";
import { CompendiumLeftColumn } from "@/views/CompendiumView/components/CompendiumLeftColumn";
import { CompendiumCenterColumn } from "@/views/CompendiumView/components/CompendiumCenterColumn";
import { CompendiumRightColumn } from "@/views/CompendiumView/components/CompendiumRightColumn";

export function CompendiumView() {
  return (
    <div style={{ height: "100%", padding: 12, boxSizing: "border-box" }}>
      <div
        style={{
          height: "100%",
          display: "grid",
          gridTemplateColumns: "340px 1fr 420px",
          gap: 14,
          alignItems: "stretch",
          minHeight: 0,
        }}
      >
        <CompendiumLeftColumn />
        <CompendiumCenterColumn />
        <CompendiumRightColumn />
      </div>
    </div>
  );
}
