import React from "react";

export function EmptyState(props: {
  children: React.ReactNode;
  textColor?: string;
  borderColor?: string;
  background?: string;
  minHeight?: number;
  padding?: string | number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  const {
    children,
    textColor = "rgba(160,180,220,0.7)",
    borderColor,
    background,
    minHeight,
    padding = "8px 10px",
    radius = 10,
    style,
  } = props;

  const framed = Boolean(borderColor || background || minHeight);

  return (
    <div
      style={{
        color: textColor,
        fontSize: "var(--fs-small)",
        ...(framed
          ? {
              border: `1px solid ${borderColor ?? "rgba(255,255,255,0.08)"}`,
              borderRadius: radius,
              background: background ?? "rgba(255,255,255,0.02)",
              padding,
              minHeight,
              display: minHeight ? "flex" : undefined,
              alignItems: minHeight ? "center" : undefined,
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
