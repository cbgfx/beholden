
import React from "react";
import { theme } from "@/theme/theme";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "health" | "bloody" };

export function Button({ variant = "primary", style, ...rest }: Props) {
  const base: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: theme.radius.control,
    border: `1px solid ${theme.colors.panelBorder}`,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    color: theme.colors.text,
    background: "transparent",
    opacity: rest.disabled ? 0.6 : 1,
    fontWeight: 700
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: theme.colors.accentPrimary, color: theme.colors.textDark, border: `1px solid ${theme.colors.panelBorder}` },
    ghost: { background: "transparent" },
    danger: { background: theme.colors.red, color: theme.colors.textDark, border: `1px solid ${theme.colors.panelBorder}` },
    health: { background: theme.colors.green, color: theme.colors.textDark, border: `1px solid ${theme.colors.panelBorder}` },
    bloody: { background: theme.colors.bloody, color: theme.colors.textDark, border: `1px solid ${theme.colors.panelBorder}` },
  };

  return <button {...rest} style={{ ...base, ...variants[variant], ...style }} />;
}
