
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
    primary: { background: theme.colors.accent, color: "#0b0f14", border: "1px solid rgba(0,0,0,0.2)" },
    ghost: { background: "transparent" },
    danger: { background: theme.colors.red, color: "rgb(255, 255, 255)", border: "1px solid rgba(0,0,0,0.2)" },
    health: { background: theme.colors.green, color: "#ffffff", border: "1px solid rgba(0,0,0,0.2)" },
    bloody: { background: theme.colors.bloody, color: "#050505", border: "1px solid rgba(0,0,0,0.2)" },
  };

  return <button {...rest} style={{ ...base, ...variants[variant], ...style }} />;
}
