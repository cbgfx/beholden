import React from "react";
import { theme } from "@/theme/theme";
import { Panel as SharedPanel } from "@beholden/shared/ui";
import { dmSharedPanelTheme } from "@/ui/sharedUiTheme";

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
      {...dmSharedPanelTheme}
    >
      {props.children}
    </SharedPanel>
  );
}
