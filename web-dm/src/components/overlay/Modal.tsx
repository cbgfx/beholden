import React, { useEffect } from "react";
import { theme, withAlpha } from "@/theme/theme";

/**
 * Lightweight modal overlay.
 * - Click backdrop or press Escape to close.
 * - Intended for tool-style panels (monster picker, etc.)
 */
export function Modal(props: {
  isOpen: boolean;
  title: React.ReactNode;
  onClose: () => void;
  width?: number;
  height?: number;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!props.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.isOpen, props.onClose]);

  if (!props.isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: theme.colors.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24
      }}
      onMouseDown={(e) => {
        // backdrop close
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          width: props.width ?? 1100,
          height: props.height ?? 720,
          maxWidth: "calc(100vw - 48px)",
          maxHeight: "calc(100vh - 48px)",
          background: theme.colors.modalBg, // The background color of the modal
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 18,
          boxShadow: `0 24px 70px ${withAlpha(theme.colors.shadowColor, 0.45)}`,
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 14px",
            borderBottom: `1px solid ${theme.colors.panelBorder}`
          }}
        >
          <div style={{ fontWeight: 900, color: theme.colors.text }}>{props.title}</div>
          <button
            onClick={props.onClose}
            style={{
              background: "transparent",
              border: "none",
              color: theme.colors.text,
              opacity: 0.85,
              cursor: "pointer",
              fontWeight: 800
            }}
            title="Close"
          >
            Close
          </button>
        </div>

        <div style={{ overflow: "hidden" }}>{props.children}</div>
      </div>
    </div>
  );
}
