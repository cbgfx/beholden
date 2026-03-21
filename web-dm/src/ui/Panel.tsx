import React from "react";
import { theme } from "@/theme/theme";

export function Panel(props: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: theme.radius.panel,
        padding: "8px 10px",
        background: theme.colors.panelBg,
        ...props.style,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div
          style={{
            flex: "1 1 220px",
            minWidth: 0,
            margin: 0,
            color: theme.colors.text,
            fontWeight: 900,
            fontSize: "var(--fs-title)",   // was --fs-medium (14px) — now 18px
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
            textDecoration: "none",
          }}
        >
          {props.title}
        </div>

        {props.actions ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, flexWrap: "wrap", maxWidth: "100%" }}>
            {props.actions}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 8, ...props.bodyStyle }}>{props.children}</div>
    </div>
  );
}
