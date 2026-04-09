import React from "react";
import { theme } from "@/theme/theme";
import { SectionTitle as SharedSectionTitle } from "@beholden/shared/ui";

export function SectionTitle({
  children,
  color = theme.colors.accentPrimary,
  actions,
  collapsed,
  onToggle,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  actions?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <SharedSectionTitle
      color={color}
      actions={actions}
      collapsed={collapsed}
      onToggle={onToggle}
      fontSize="var(--fs-tiny)"
      fontWeight={700}
      style={style}
    >
      {children}
    </SharedSectionTitle>
  );
}
