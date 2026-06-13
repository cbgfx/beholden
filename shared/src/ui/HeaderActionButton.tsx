import React from "react";

export function HeaderActionButton({
  onClick,
  children,
  color,
  borderColor,
  padding = "4px 12px",
  borderRadius = 8,
  fontSize = "var(--fs-medium)",
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  color: string;
  borderColor: string;
  padding?: string;
  borderRadius?: number;
  fontSize?: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "transparent",
        border: `1px solid ${borderColor}`,
        borderRadius,
        color,
        cursor: "pointer",
        padding,
        fontSize,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
