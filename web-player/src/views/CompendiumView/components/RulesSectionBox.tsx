import React from "react";
import { C } from "@/lib/theme";

export function RulesSectionBox(props: { title: string; children: React.ReactNode }) {
  return (
    <details style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "10px 12px",
          fontWeight: 800,
          color: C.text,
          background: C.panelBg,
          userSelect: "none",
        }}
      >
        {props.title}
      </summary>
      <div style={{ padding: "10px 12px", color: C.text, lineHeight: 1.35 }}>{props.children}</div>
    </details>
  );
}
