import React from "react";

export function SubsectionLabel(props: {
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}) {
  const { children, color = "rgba(160,180,220,0.45)", style } = props;
  return (
    <div
      style={{
        fontSize: "var(--fs-tiny)",
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color,
        marginBottom: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
