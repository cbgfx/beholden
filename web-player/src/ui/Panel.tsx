import React from "react";
import { C } from "@/lib/theme";
import { Panel as SharedPanel } from "@beholden/shared/ui";

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
      titleColor={C.text}
      borderColor={C.panelBorder}
      background={C.panelBg}
      radius={14}
      padding="8px 10px"
      titleFontSize="var(--fs-body)"
      titleFontWeight={900}
    >
      {props.children}
    </SharedPanel>
  );
}
