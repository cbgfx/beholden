import React from "react";

export function InfoPageLayout(props: {
  title: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div style={{ padding: 16, display: "flex", justifyContent: "center", color: props.color, overflowY: "auto", height: "100%" }}>
      <div style={{ width: "min(980px, 100%)" }}>
        <div style={{ fontSize: "var(--fs-hero)", fontWeight: 900, marginBottom: 12 }}>{props.title}</div>
        {props.children}
      </div>
    </div>
  );
}
