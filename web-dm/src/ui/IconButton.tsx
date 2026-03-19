import React from "react";
import { theme, withAlpha } from "@/theme/theme";

export function IconButton(props: {
  children: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
  size?: "sm" | "md";
}) {
  const size = props.size ?? "md";
  const variant = props.variant ?? "solid";
  const px = size === "sm" ? 8 : 10;
  const py = size === "sm" ? 6 : 8;
  const radius = 10;

  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: `${py}px ${px}px`,
        borderRadius: radius,
        border: `1px solid ${theme.colors.panelBorder}`,
        cursor: props.disabled ? "not-allowed" : "pointer",
        background:
          variant === "ghost"
            ? withAlpha(theme.colors.panelBorder, 0.10)
            : withAlpha(theme.colors.accentPrimary, 0.95),
        color: variant === "ghost" ? theme.colors.text : theme.colors.textDark,
        opacity: props.disabled ? 0.5 : 1,
        userSelect: "none"
      }}
    >
      {props.children}
    </button>
  );
}
