import React from "react";
import { C } from "@/lib/theme";

export function MiniTable(props: { cols: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${props.cols.length}, 1fr)`,
          background: C.panelBg,
          borderBottom: `1px solid ${C.panelBorder}`,
        }}
      >
        {props.cols.map((c) => (
          <div key={c} style={{ padding: "8px 10px", fontWeight: 800, fontSize: "var(--fs-small)", color: C.muted }}>{c}</div>
        ))}
      </div>
      {props.rows.map((r, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${props.cols.length}, 1fr)`,
            borderBottom: idx === props.rows.length - 1 ? "none" : `1px solid ${C.panelBorder}`,
          }}
        >
          {r.map((cell, i) => (
            <div key={i} style={{ padding: "8px 10px", fontSize: "var(--fs-subtitle)", color: C.text }}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
