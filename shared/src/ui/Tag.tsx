import React from "react";

export function Tag({
  label,
  color,
  style,
}: {
  label: string;
  color: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontSize: "var(--fs-small)",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        color,
        border: `1px solid ${color}44`,
        background: `${color}18`,
        ...style,
      }}
    >
      {label}
    </span>
  );
}
