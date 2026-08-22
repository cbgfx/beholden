import React from "react";
import { C, withAlpha } from "@/lib/theme";
import { IconButton as SharedIconButton } from "@beholden/shared/ui";

export function IconButton(props: {
  children: React.ReactNode;
  title?: string;
  "aria-label"?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  variant?: "ghost" | "solid" | "accent";
  size?: "sm" | "md";
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <SharedIconButton
      title={props.title}
      aria-label={props["aria-label"]}
      onClick={props.onClick}
      disabled={props.disabled}
      variant={props.variant}
      size={props.size}
      borderColor={C.panelBorder}
      accentColor={C.accentHl}
      textColor={C.text}
      textDarkColor={C.textDark}
      hoverBackground={withAlpha(C.panelBorder, 0.30)}
      ghostBackground={withAlpha(C.panelBorder, 0.12)}
      style={props.style}
      className={props.className}
    >
      {props.children}
    </SharedIconButton>
  );
}
