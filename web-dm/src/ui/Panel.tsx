import React, { useState } from "react";
import { theme } from "@/theme/theme";
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
  const [open, setOpen] = useState(() => {
    if (!props.storageKey) return true;
    try {
      const v = localStorage.getItem(`panel:${props.storageKey}`);
      if (v !== null) return v !== "0";
    } catch { /* ignore */ }
    return true;
  });

  const isCollapsible = Boolean(props.storageKey);

  const toggle = () => {
    if (!isCollapsible) return;
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(`panel:${props.storageKey}`, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: theme.radius.panel,
        padding: "12px 14px",
        background: "rgba(255,255,255,0.035)",
        ...props.style,
      }}
    >
      <SectionTitle
        color={props.titleColor}
        actions={props.actions}
        collapsed={isCollapsible ? !open : undefined}
        onToggle={isCollapsible ? toggle : undefined}
      >
        {props.title}
      </SectionTitle>
      {open && <div style={{ ...props.bodyStyle }}>{props.children}</div>}
    </div>
  );
}
