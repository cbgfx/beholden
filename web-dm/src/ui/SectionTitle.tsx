import React from "react";
import { theme } from "@/theme/theme";

export function SectionTitle({
  children,
  color = theme.colors.accentPrimary,
  actions,
  collapsed,
  onToggle,
}: {
  children: React.ReactNode;
  color?: string;
  actions?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--fs-tiny)",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        marginBottom: collapsed ? 0 : 10,
        cursor: onToggle ? "pointer" : undefined,
        userSelect: onToggle ? "none" : undefined,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}30` }} />
      {actions && (
        <div
          style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      )}
      {collapsed !== undefined && (
        <span style={{
          color, fontSize: "var(--fs-tiny)", lineHeight: 1,
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
          transition: "transform 120ms ease",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 10, flexShrink: 0,
        }}>▼</span>
      )}
    </div>
  );
}
