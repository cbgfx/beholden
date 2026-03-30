import React from "react";

export function IconButton(props: {
  children: React.ReactNode;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "ghost" | "solid" | "accent";
  size?: "sm" | "md";
  borderColor: string;
  accentColor: string;
  textColor: string;
  textDarkColor: string;
  hoverBackground?: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const size = props.size ?? "md";
  const variant = props.variant ?? "ghost";
  const px = size === "sm" ? 6 : 8;
  const py = size === "sm" ? 5 : 7;
  const hoverBackground = props.hoverBackground ?? props.borderColor;

  const bg =
    variant === "solid"
      ? hovered
        ? `${props.accentColor}d9`
        : `${props.accentColor}b3`
      : variant === "accent"
        ? hovered
          ? `${props.accentColor}52`
          : `${props.accentColor}2e`
        : hovered
          ? hoverBackground
          : `${props.borderColor}1f`;

  const border = variant === "accent" ? `${props.accentColor}61` : props.borderColor;
  const color =
    variant === "solid"
      ? props.textDarkColor
      : variant === "accent"
        ? props.accentColor
        : props.textColor;

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
        borderRadius: 10,
        border: `1px solid ${border}`,
        cursor: props.disabled ? "not-allowed" : "pointer",
        background: bg,
        color,
        opacity: props.disabled ? 0.45 : 1,
        userSelect: "none",
        transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
      }}
    >
      {props.children}
    </button>
  );
}
