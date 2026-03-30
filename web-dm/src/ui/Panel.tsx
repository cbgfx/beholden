import React from "react";
import { theme } from "@/theme/theme";
import { Panel as SharedPanel } from "@beholden/shared/ui";

export function Panel(props: {
  title: React.ReactNode;
  titleColor?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  storageKey?: string;
}) {
  return (
    <SharedPanel
      title={props.title}
      actions={props.actions}
      style={props.style}
      bodyStyle={props.bodyStyle}
      storageKey={props.storageKey}
      titleColor={props.titleColor ?? theme.colors.accentPrimary}
      borderColor="rgba(255,255,255,0.09)"
      background="rgba(255,255,255,0.035)"
      radius={theme.radius.panel}
      padding="12px 14px"
      titleFontSize="var(--fs-tiny)"
      titleFontWeight={700}
    >
      {props.children}
    </SharedPanel>
  );
}
