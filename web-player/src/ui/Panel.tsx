import React from "react";
import { C } from "@/lib/theme";

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
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 14,
        padding: "8px 10px",
        background: C.panelBg,
        ...props.style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div
          style={{
            margin: 0,
            color: C.text,
            fontWeight: 900,
            fontSize: 16,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {props.title}
        </div>
        {props.actions ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>{props.actions}</div>
        ) : null}
      </div>
      <div style={{ marginTop: 8, ...props.bodyStyle }}>{props.children}</div>
    </div>
  );
}
