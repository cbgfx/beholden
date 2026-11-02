import type { ReactNode } from "react";
import { theme } from "@/theme/theme";

/** Compact record row. The caller owns navigation and supplies translated metadata. */
export function BinderCompactCard(props: { title: string; icon?: ReactNode; badge?: ReactNode; children?: ReactNode; onOpen: () => void }) {
  return <button type="button" onClick={props.onOpen} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", width: "100%", minWidth: 0, minHeight: 44, gap: "5px 10px", padding: "10px 12px", border: 0, borderBottom: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, font: "inherit", textAlign: "left", cursor: "pointer" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
      {props.icon ? <span style={{ display: "grid", flexShrink: 0 }}>{props.icon}</span> : null}
      <span style={{ fontWeight: 750, overflowWrap: "anywhere", minWidth: 0 }}>{props.title}</span>
    </span>
    {props.badge ? <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{props.badge}</span> : <span />}
    {props.children ? <span style={{ gridColumn: "1 / -1", minWidth: 0, color: theme.colors.muted, fontSize: "var(--fs-small)", overflowWrap: "anywhere", lineHeight: 1.5 }}>{props.children}</span> : null}
  </button>;
}
