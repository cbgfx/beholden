import React from "react";

export function StatCard({
  label,
  value,
  theme,
  style,
}: {
  label: string;
  value: string;
  theme: {
    borderColor: string;
    background: string;
    mutedColor: string;
    textColor: string;
  };
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${theme.borderColor}`,
        borderRadius: 10,
        background: theme.background,
        padding: "8px 10px",
        minWidth: 0,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-tiny)",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: theme.mutedColor,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: theme.textColor, overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}
