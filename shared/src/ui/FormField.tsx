import React from "react";

export function FormField({
  label,
  children,
  labelStyle,
  style,
}: {
  label: string;
  children: React.ReactNode;
  labelStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, ...style }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export function CheckRow({
  label,
  checked,
  onChange,
  style,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", ...style }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
