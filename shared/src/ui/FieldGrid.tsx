import React from "react";

export function FieldGrid({
  columns = "1fr 1fr",
  gap = 12,
  children,
  style,
}: {
  columns?: React.CSSProperties["gridTemplateColumns"];
  gap?: number | string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: columns, gap, ...style }}>
      {children}
    </div>
  );
}
