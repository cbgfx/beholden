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
  ghostBackground?: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const size = props.size ?? "md";
  const variant = props.variant ?? "ghost";
  const usesCssVarAccent = props.accentColor.includes("var(");
  const px = size === "sm" ? 6 : 8;
  const py = size === "sm" ? 5 : 7;
  const hoverBackground = props.hoverBackground ?? props.borderColor;

  const accentSoft = usesCssVarAccent
    ? "color-mix(in srgb, " + props.accentColor + " 18%, transparent)"
    : `${props.accentColor}2e`;
  const accentSoftHover = usesCssVarAccent
    ? "color-mix(in srgb, " + props.accentColor + " 32%, transparent)"
    : `${props.accentColor}52`;
  const accentBorder = usesCssVarAccent
    ? "color-mix(in srgb, " + props.accentColor + " 40%, transparent)"
    : `${props.accentColor}61`;
  const accentSolid = usesCssVarAccent
    ? "color-mix(in srgb, " + props.accentColor + " 78%, black)"
    : `${props.accentColor}b3`;
  const accentSolidHover = usesCssVarAccent
    ? "color-mix(in srgb, " + props.accentColor + " 88%, black)"
    : `${props.accentColor}d9`;

  const bg =
    variant === "solid"
      ? hovered
        ? accentSolidHover
        : accentSolid
      : variant === "accent"
        ? hovered
          ? accentSoftHover
          : accentSoft
        : hovered
          ? hoverBackground
          : (props.ghostBackground ?? `${props.borderColor}1f`);

  const border = variant === "accent" ? accentBorder : props.borderColor;
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
