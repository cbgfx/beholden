import React from "react";
import { theme } from "../../app/theme/theme";

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
        padding: 6,
        background: theme.colors.panelBg,
        ...props.style
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div
          style={{
            margin: 0,
            color: theme.colors.text,
            fontWeight: 900,
            fontSize: "var(--fs-medium)",
            display: "flex",
            alignItems: "center",
            gap: 5,
            textDecoration: "none"
          }}
        >
          {props.title}
        </div>

        {props.actions ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{props.actions}</div> : null}
      </div>

      <div style={{ marginTop: 5, ...props.bodyStyle }}>{props.children}</div>
    </div>
  );
}
