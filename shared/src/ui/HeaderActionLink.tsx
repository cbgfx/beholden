import React from "react";
import { Link } from "react-router-dom";

export function HeaderActionLink({
  to,
  children,
  color,
  hoverBackground = "rgba(255,255,255,0.07)",
  padding = "4px 10px",
  borderRadius = 8,
  fontSize = "var(--fs-medium)",
  title,
}: {
  to: string;
  children: React.ReactNode;
  color: string;
  hoverBackground?: string;
  padding?: string;
  borderRadius?: number;
  fontSize?: string;
  title?: string;
}) {
  return (
    <Link
      to={to}
      title={title}
      style={{
        fontSize,
        color,
        textDecoration: "none",
        padding,
        borderRadius,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = hoverBackground; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </Link>
  );
}
