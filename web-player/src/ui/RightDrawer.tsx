import React from "react";
import { C } from "@/lib/theme";

const closeBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 6,
  color: C.muted,
  cursor: "pointer",
  padding: "4px 10px",
  fontSize: "var(--fs-small)",
  fontWeight: 700,
};

export function RightDrawer({
  onClose,
  width = "min(480px, 92vw)",
  zIndex = 900,
  title,
  children,
  footer,
}: {
  onClose: () => void;
  width?: string;
  zIndex?: number;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex, background: "rgba(0,0,0,0.45)" }}
      />
      <div
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: zIndex + 1,
          width,
          background: C.bg,
          borderLeft: "1px solid rgba(255,255,255,0.12)",
          display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 30px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>{title}</div>
          <button type="button" onClick={onClose} style={closeBtn}>Close</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
