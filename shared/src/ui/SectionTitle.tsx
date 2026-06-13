import React from "react";

export function SectionTitle({
  children,
  color,
  actions,
  collapsed,
  onToggle,
  marginBottom,
  fontSize = "var(--fs-tiny)",
  fontWeight = 700,
  style,
}: {
  children: React.ReactNode;
  color: string;
  actions?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  marginBottom?: number;
  fontSize?: string | number;
  fontWeight?: number;
  style?: React.CSSProperties;
}) {
  const lineColor = color.includes("var(")
    ? `color-mix(in srgb, ${color} 30%, transparent)`
    : `${color}30`;

  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize,
        fontWeight,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        marginBottom: marginBottom ?? (collapsed ? 0 : 10),
        cursor: onToggle ? "pointer" : undefined,
        userSelect: onToggle ? "none" : undefined,
        ...style,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: lineColor }} />
      {actions ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
      {collapsed !== undefined ? (
        <span
          style={{
            color,
            fontSize: "var(--fs-tiny)",
            lineHeight: 1,
            transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 10,
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      ) : null}
    </div>
  );
}
