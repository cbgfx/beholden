import React from "react";

export function CollectionRow({
  leading,
  main,
  trailing,
  onClick,
  borderColor = "rgba(255,255,255,0.05)",
  padding = "6px 8px",
  stacked = false,
}: {
  leading?: React.ReactNode;
  main: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  borderColor?: string;
  padding?: React.CSSProperties["padding"];
  stacked?: boolean;
}) {
  return (
    <div className="collectionInteractiveRow" style={{ borderBottom: `1px solid ${borderColor}` }}>
      <div
        onClick={onClick}
        style={{
          display: "flex",
          flexWrap: stacked ? "wrap" : undefined,
          alignItems: "center",
          gap: 8,
          padding,
          cursor: onClick ? "pointer" : "default",
        }}
      >
        {leading}
        <div style={{ flex: stacked ? "1 1 100%" : 1, minWidth: 0 }}>{main}</div>
        {trailing}
      </div>
    </div>
  );
}
