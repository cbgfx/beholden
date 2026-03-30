import React from "react";
import { theme } from "@/theme/theme";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "health" | "bloody";
};

export function Button({ variant = "primary", style, onMouseEnter, onMouseLeave, onMouseDown, onMouseUp, ...rest }: Props) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const base: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: theme.radius.control,
    border: `1px solid ${theme.colors.panelBorder}`,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    color: theme.colors.text,
    background: "transparent",
    opacity: rest.disabled ? 0.6 : 1,
    fontWeight: 700,
    fontSize: "var(--fs-medium)",
    transition: "filter 120ms ease, transform 80ms ease",
    filter: hovered && !rest.disabled ? "brightness(1.10)" : "none",
    transform: pressed && !rest.disabled ? "translateY(1px)" : "none",
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: theme.colors.accentPrimary, color: theme.colors.textDark, border: "none" },
    ghost: { background: "transparent", border: `1px solid ${theme.colors.panelBorder}` },
    danger: { background: theme.colors.red, color: theme.colors.textDark, border: "none" },
    health: { background: theme.colors.green, color: theme.colors.textDark, border: "none" },
    bloody: { background: theme.colors.bloody, color: theme.colors.textDark, border: "none" },
  };

  return (
    <button
      {...rest}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); setPressed(false); onMouseLeave?.(e); }}
      onMouseDown={(e) => { setPressed(true); onMouseDown?.(e); }}
      onMouseUp={(e) => { setPressed(false); onMouseUp?.(e); }}
      style={{ ...base, ...variants[variant], ...style }}
    />
  );
}
