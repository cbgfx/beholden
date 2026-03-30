import React from "react";

export function HealthBar(props: {
  current: number;
  max: number;
  temp?: number;
  height?: number;
  radius?: number;
  trackColor: string;
  fillColor: string;
  tempColor?: string;
  label?: React.ReactNode;
  style?: React.CSSProperties;
  transition?: string;
}) {
  const {
    current,
    max,
    temp = 0,
    height = 10,
    radius = 999,
    trackColor,
    fillColor,
    tempColor,
    label,
    style,
    transition = "width 150ms ease",
  } = props;

  const safeMax = Math.max(1, Number(max) || 1);
  const safeCurrent = Math.max(0, Number(current) || 0);
  const safeTemp = Math.max(0, Number(temp) || 0);
  const pct = Math.max(0, Math.min(1, safeCurrent / safeMax));
  const tempPct = Math.max(0, Math.min(1 - pct, safeTemp / safeMax));

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: radius,
        background: trackColor,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${pct * 100}%`,
          background: fillColor,
          borderRadius: radius,
          transition,
        }}
      />
      {safeTemp > 0 && tempColor ? (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${pct * 100}%`,
            width: `${tempPct * 100}%`,
            background: tempColor,
            opacity: 0.8,
            borderRadius: radius,
          }}
        />
      ) : null}
      {label ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
}
