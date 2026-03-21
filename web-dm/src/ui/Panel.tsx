import React from "react";
import { theme } from "@/theme/theme";

export function Panel(props: {
  title: React.ReactNode;
  titleColor?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  const color = props.titleColor ?? theme.colors.accentPrimary;
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div
          style={{
            fontSize: "var(--fs-tiny)",
            fontWeight: 900,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {props.title}
        </div>
        <div style={{ flex: 1, height: 1, background: `${color}40` }} />
        {props.actions ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            {props.actions}
          </div>
        ) : null}
      </div>

      <div style={{ ...props.bodyStyle }}>{props.children}</div>
    </div>
  );
}
