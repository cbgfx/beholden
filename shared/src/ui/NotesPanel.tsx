import React from "react";
import { SectionTitle } from "./SectionTitle";
import { Panel } from "./Panel";

export function NotesPanel(props: {
  title: React.ReactNode;
  color: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
}) {
  return (
    <Panel
      storageKey={props.storageKey}
      defaultOpen={props.defaultOpen ?? true}
      borderColor="rgba(255,255,255,0.09)"
      background="rgba(255,255,255,0.035)"
      radius={12}
      padding="14px 16px"
      style={props.style}
      bodyStyle={props.bodyStyle}
      title={
        <SectionTitle color={props.color} actions={props.actions} style={{ flex: 1, minWidth: 0, marginBottom: 0 }}>
          {props.title}
        </SectionTitle>
      }
      titleColor={props.color}
    >
      {props.children}
    </Panel>
  );
}
