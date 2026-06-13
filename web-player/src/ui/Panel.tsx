import React from "react";
import { Panel as SharedPanel } from "@beholden/shared/ui";
import { playerSharedPanelTheme } from "@/ui/sharedUiTheme";

export function Panel(props: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <SharedPanel
      title={props.title}
      actions={props.actions}
      style={props.style}
      bodyStyle={props.bodyStyle}
      {...playerSharedPanelTheme}
    >
      {props.children}
    </SharedPanel>
  );
}
