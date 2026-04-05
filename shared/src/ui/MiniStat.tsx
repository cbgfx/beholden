import React from "react";

export function MiniStat(props: {
  label: string;
  value: string;
  accent?: string;
  icon?: React.ReactNode;
  theme: {
    mutedColor: string;
    textColor: string;
    borderColor?: string;
    background?: string;
  };
}) {
  const { label, value, accent, icon, theme } = props;
  return (
    <div
      style={{
        textAlign: "center",
        padding: "8px 6px",
        borderRadius: 8,
        background: theme.background ?? "rgba(255,255,255,0.04)",
        border: `1px solid ${accent ? `${accent}33` : theme.borderColor ?? "rgba(255,255,255,0.09)"}`,
      }}
    >
      <div
        style={{
          fontSize: "var(--fs-tiny)",
          fontWeight: 700,
          color: theme.mutedColor,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontSize: "var(--fs-body)", fontWeight: 800, color: accent ?? theme.textColor }}>{value}</div>
    </div>
  );
}
