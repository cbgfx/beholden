import React from "react";
import { theme } from "@/theme/theme";

export function MiniTable(props: { cols: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${props.cols.length}, 1fr)`,
          background: theme.colors.panelBg,
          borderBottom: `1px solid ${theme.colors.panelBorder}`,
        }}
      >
        {props.cols.map((c) => (
          <div key={c} style={{ padding: "8px 10px", fontWeight: 800, fontSize: 12, color: theme.colors.muted }}>
            {c}
          </div>
        ))}
      </div>
      {props.rows.map((r, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${props.cols.length}, 1fr)`,
            borderBottom: idx === props.rows.length - 1 ? "none" : `1px solid ${theme.colors.panelBorder}`,
          }}
        >
          {r.map((cell, i) => (
            <div key={i} style={{ padding: "8px 10px", fontSize: 13, color: theme.colors.text }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
