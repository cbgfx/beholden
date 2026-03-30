import React from "react";
import { theme } from "@/theme/theme";

export function StatBar(props: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  flex?: number;
}) {
  return (
    <div
      style={{
        flex: props.flex ?? 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "8px 10px",
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-tiny)",
          fontWeight: 900,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: theme.colors.muted,
          whiteSpace: "nowrap",
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 900,
          fontSize: "var(--fs-stat)",
          color: theme.colors.text,
        }}
      >
        <span style={{ opacity: 0.65, display: "flex", alignItems: "center" }}>{props.icon}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{props.value}</span>
      </div>
    </div>
  );
}
