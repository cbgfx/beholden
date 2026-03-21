import React from "react";
import { theme } from "@/theme/theme";

export function SectionTitle({
  children,
  color = theme.colors.accentPrimary,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--fs-tiny)",
        fontWeight: 900,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        marginBottom: 8,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}40` }} />
    </div>
  );
}
