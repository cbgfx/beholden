import type React from "react";

export function accentButtonStyle(
  accentColor: string,
  opts?: {
    textColor?: string;
    borderColor?: string;
    padding?: string;
    fontSize?: string;
    borderRadius?: number;
  }
): React.CSSProperties {
  return {
    background: `${accentColor}22`,
    border: `1px solid ${opts?.borderColor ?? `${accentColor}55`}`,
    borderRadius: opts?.borderRadius ?? 8,
    color: opts?.textColor ?? accentColor,
    cursor: "pointer",
    padding: opts?.padding ?? "8px 16px",
    fontSize: opts?.fontSize ?? "var(--fs-subtitle)",
    fontWeight: 700,
  };
}

export function ghostButtonStyle(
  opts?: {
    textColor?: string;
    borderColor?: string;
    padding?: string;
    fontSize?: string;
    borderRadius?: number;
    background?: string;
  }
): React.CSSProperties {
  return {
    background: opts?.background ?? "transparent",
    border: `1px solid ${opts?.borderColor ?? "rgba(255,255,255,0.14)"}`,
    borderRadius: opts?.borderRadius ?? 8,
    color: opts?.textColor ?? "rgba(160,180,220,0.75)",
    cursor: "pointer",
    padding: opts?.padding ?? "8px 16px",
    fontSize: opts?.fontSize ?? "var(--fs-subtitle)",
  };
}
