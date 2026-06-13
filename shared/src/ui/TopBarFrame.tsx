import * as React from "react";

type TopBarFrameProps = {
  children: React.ReactNode;
  height?: number | string;
  padding?: string;
  gap?: number;
  borderColor?: string;
  startColor?: string;
  midColor?: string;
  endColor?: string;
  outerStyle?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
};

export function TopBarFrame({
  children,
  height = 72,
  padding = "0 20px",
  gap = 24,
  borderColor = "rgba(251,191,36,0.26)",
  startColor = "rgba(251,191,36,0.22)",
  midColor = "rgba(56,182,255,0.10)",
  endColor = "rgba(255,255,255,0.03)",
  outerStyle,
  innerStyle,
}: TopBarFrameProps) {
  return (
    <header
      style={{
        background: `radial-gradient(120% 200% at 0% 0%, ${startColor} 0%, ${midColor} 42%, ${endColor} 100%)`,
        borderBottom: `1px solid ${borderColor}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
        flexShrink: 0,
        ...outerStyle,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap,
          padding,
          height,
          ...innerStyle,
        }}
      >
        {children}
      </div>
    </header>
  );
}
