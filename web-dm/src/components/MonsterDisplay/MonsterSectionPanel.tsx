import React from "react";
import { theme } from "@/theme/theme";
import { SectionTitle } from "@/ui/SectionTitle";

export function MonsterSectionPanel({
  title,
  children,
  actions,
  defaultOpen = true,
  emptyText,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.panelBg,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "10px 12px 8px" }}>
        <SectionTitle collapsed={!open} onToggle={() => setOpen((v) => !v)} actions={actions}>
          {title}
        </SectionTitle>
      </div>
      {open ? (
        <div style={{ padding: "0 12px 12px", display: "grid", gap: 8 }}>
          {children ?? (emptyText ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>{emptyText}</div> : null)}
        </div>
      ) : null}
    </div>
  );
}
