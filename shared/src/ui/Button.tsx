import React from "react";

type SharedButtonTheme = {
  radius: string | number;
  text: string;
  textDark: string;
  panelBorder: string;
  accentPrimary: string;
  red: string;
  green: string;
  bloody?: string;
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "health" | "bloody";
  theme: SharedButtonTheme;
};

export function Button({
  variant = "primary",
  style,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  theme,
  ...rest
}: Props) {
  const [hovered, setHovered] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const base: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: theme.radius,
    border: `1px solid ${theme.panelBorder}`,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    color: theme.text,
    background: "transparent",
    opacity: rest.disabled ? 0.6 : 1,
    fontWeight: 700,
    fontSize: "var(--fs-medium)",
    transition: "filter 120ms ease, transform 80ms ease",
    filter: hovered && !rest.disabled ? "brightness(1.10)" : "none",
    transform: pressed && !rest.disabled ? "translateY(1px)" : "none",
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: { background: theme.accentPrimary, color: theme.textDark, border: "none" },
    ghost: { background: "transparent", border: `1px solid ${theme.panelBorder}` },
    danger: { background: theme.red, color: theme.textDark, border: "none" },
    health: { background: theme.green, color: theme.textDark, border: "none" },
    bloody: { background: theme.bloody ?? theme.red, color: theme.textDark, border: "none" },
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
