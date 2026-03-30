import React from "react";

export function StatusDot(props: {
  active: boolean;
  activeColor: string;
  inactiveColor: string;
  size?: number;
  title?: string;
}) {
  const size = props.size ?? 10;
  const color = props.active ? props.activeColor : props.inactiveColor;
  return (
    <div
      title={props.title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: color,
        boxShadow: `0 0 6px ${color}`,
        transition: "background 400ms ease, box-shadow 400ms ease",
      }}
    />
  );
}
