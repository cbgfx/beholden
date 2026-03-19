import React from "react";
import { theme } from "@/theme/theme";

/**
 * Simple hover tooltip. Wraps children in an inline-flex span and shows a
 * styled tooltip above on hover. `pointerEvents: none` on the bubble means
 * clicks pass through to the underlying element (important for buttons).
 */
export function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
  const [visible, setVisible] = React.useState(false);

  if (!text) return <>{children}</>;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 400,
            background: theme.colors.modalBg,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: "var(--fs-medium)",
            fontWeight: 600,
            color: theme.colors.text,
            whiteSpace: "normal",
            maxWidth: 240,
            minWidth: 120,
            pointerEvents: "none",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
            textAlign: "left",
            lineHeight: 1.4,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
