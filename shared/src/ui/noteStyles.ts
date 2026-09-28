import type React from "react";

/** Shared visual treatment for expandable note-like rows in both applications. */
export function noteSurfaceStyle(expanded: boolean, accentColor: string): React.CSSProperties {
  return {
    padding: expanded ? "7px 8px 9px" : "5px 6px",
    borderRadius: 8,
    background: expanded
      ? `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 10%, transparent), color-mix(in srgb, ${accentColor} 2%, transparent) 32%, transparent 66%), rgba(0,0,0,0.08)`
      : "transparent",
    border: "1px solid transparent",
    boxShadow: "none",
  };
}

export function noteBodyStyle(textColor: string, mutedColor: string): React.CSSProperties {
  return {
    marginTop: 8,
    color: `color-mix(in srgb, ${textColor} 78%, ${mutedColor})`,
    fontSize: "var(--fs-small)",
    lineHeight: 1.62,
    maxWidth: "76ch",
  };
}
