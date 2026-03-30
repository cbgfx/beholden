import React from "react";
import { theme, withAlpha } from "@/theme/theme";

export function IconButton(props: {
  children: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "ghost" | "solid" | "accent";
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = React.useState(false);
  const size = props.size ?? "md";
  const variant = props.variant ?? "ghost";
  const px = size === "sm" ? 6 : 8;
  const py = size === "sm" ? 5 : 7;

  const bg = variant === "solid"
    ? withAlpha(theme.colors.accentPrimary, hovered ? 0.85 : 0.70)
    : variant === "accent"
    ? withAlpha(theme.colors.accentPrimary, hovered ? 0.32 : 0.18)
    : hovered
    ? withAlpha(theme.colors.panelBorder, 0.30)
    : withAlpha(theme.colors.panelBorder, 0.12);

  const borderColor = variant === "accent"
    ? withAlpha(theme.colors.accentPrimary, hovered ? 0.55 : 0.38)
    : theme.colors.panelBorder;

  const textColor = variant === "solid"
    ? theme.colors.textDark
    : variant === "accent"
    ? theme.colors.accentPrimary
    : theme.colors.text;

  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: `${py}px ${px}px`,
        borderRadius: theme.radius.control,
        border: `1px solid ${borderColor}`,
        cursor: props.disabled ? "not-allowed" : "pointer",
        background: bg,
        color: textColor,
        opacity: props.disabled ? 0.45 : 1,
        userSelect: "none",
        transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
    >
      {props.children}
    </button>
  );
}
