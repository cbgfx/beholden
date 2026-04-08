import React from "react";

export function RarityDot({
  color,
  size = 7,
}: {
  color: string;
  size?: number;
}) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}
