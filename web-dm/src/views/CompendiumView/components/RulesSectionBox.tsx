import React from "react";
import { theme } from "@/theme/theme";

export function RulesSectionBox(props: { title: string; children: React.ReactNode }) {
  return (
    <details
      open={false}
      style={{
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "10px 12px",
          fontWeight: 800,
          color: theme.colors.text,
          background: theme.colors.panelBg,
          userSelect: "none",
        }}
      >
        {props.title}
      </summary>
      <div style={{ padding: "10px 12px", color: theme.colors.text, lineHeight: 1.35 }}>{props.children}</div>
    </details>
  );
}
