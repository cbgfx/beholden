import React from "react";
import { theme } from "@/theme/theme";
import { Panel as SharedPanel } from "@beholden/shared/ui";
import { dmSharedPanelTheme } from "@/ui/sharedUiTheme";
import { SectionTitle } from "@/ui/SectionTitle";

export function Panel(props: {
  title: React.ReactNode;
  titleColor?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  storageKey?: string;
}) {
  const titleColor = props.titleColor ?? theme.colors.colorMagic;
  return (
    <SharedPanel
      title={
        <SectionTitle color={titleColor} actions={props.actions} style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
          {props.title}
        </SectionTitle>
      }
      style={props.style}
      bodyStyle={props.bodyStyle}
      storageKey={props.storageKey}
      titleColor={titleColor}
      {...dmSharedPanelTheme}
    >
      {props.children}
    </SharedPanel>
  );
}
