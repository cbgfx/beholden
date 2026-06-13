
import React, { useEffect } from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";

export function Drawer(props: {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    if (props.isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.isOpen, props.onClose]);

  if (!props.isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
      {/* Backdrop (explicitly behind the drawer so it can't intercept clicks) */}
      <div
        onClick={props.onClose}
        style={{ position: "absolute", inset: 0, background: theme.colors.scrim, zIndex: 0 }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          width: "min(520px, 92vw)",
          background: theme.colors.drawerBg,
          borderLeft: `1px solid ${theme.colors.panelBorder}`,
          display: "flex",
          flexDirection: "column",
          zIndex: 1
        }}
      >
        <div style={{ padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.text }}>{props.title}</div>
          <Button variant="ghost" onClick={props.onClose}>Close</Button>
        </div>

        <div style={{ padding: 14, overflow: "auto", flex: 1 }}>{props.children}</div>

        <div style={{ padding: 14, borderTop: `1px solid ${theme.colors.panelBorder}`, position: "sticky", bottom: 0, background: theme.colors.drawerBg }}>
          {props.footer ?? <Button onClick={props.onClose}>Done</Button>}
        </div>
      </div>
    </div>
  );
}
