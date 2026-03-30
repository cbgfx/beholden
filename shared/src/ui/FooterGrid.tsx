import React from "react";

/** 4-column footer grid: left | center-left | center-right | right */
export function FooterGrid(props: {
  left: React.ReactNode;
  centerLeft: React.ReactNode;
  centerRight?: React.ReactNode;
  right?: React.ReactNode;
  borderColor: string;
  background: string;
  color: string;
}) {
  return (
    <footer
      style={{
        borderTop: `1px solid ${props.borderColor}`,
        padding: "10px 16px",
        color: props.color,
        fontSize: "var(--fs-medium)",
        background: props.background,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto auto minmax(0, 1fr)",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}
    >
      <div style={{ minWidth: 0, justifySelf: "start" }}>{props.left}</div>
      <div style={{ justifySelf: "center", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>{props.centerLeft}</div>
      <div style={{ justifySelf: "center", display: "flex", justifyContent: "center" }}>{props.centerRight}</div>
      <div style={{ justifySelf: "end", textAlign: "right", fontSize: "var(--fs-small)" }}>{props.right}</div>
    </footer>
  );
}
