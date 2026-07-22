import React from "react";

export function RulesSectionBox(props: {
  title: string;
  children: React.ReactNode;
  borderColor?: string;
  headerBg?: string;
  textColor?: string;
}) {
  const {
    title,
    children,
    borderColor = "rgba(255,255,255,0.13)",
    headerBg = "rgba(255,255,255,0.055)",
    textColor = "#e8edf5",
  } = props;

  return (
    <details open={false} style={{ border: `1px solid ${borderColor}`, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "10px 12px",
          fontWeight: 800,
          color: textColor,
          background: headerBg,
          userSelect: "none",
        }}
      >
        {title}
      </summary>
      <div style={{ padding: "10px 12px", color: textColor, lineHeight: 1.35 }}>{children}</div>
    </details>
  );
}
