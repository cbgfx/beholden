import React from "react";
import { theme, withAlpha } from "@/theme/theme";

export function MonsterTextSection(props: { title: string; blocks: any[] }) {
  if (!props.blocks?.length) return null;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ color: theme.colors.accentPrimary, fontWeight: 900 }}>{props.title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {props.blocks.map((t: any, idx: number) => (
          <div
            key={idx}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: withAlpha(theme.colors.panelBg, 0.10),
              display: "grid",
              gap: 4
            }}
          >
            <div style={{ color: theme.colors.text, fontWeight: 900 }}>{t?.name ?? t?.title ?? ""}</div>
            <div style={{ color: theme.colors.text, whiteSpace: "pre-wrap" }}>
              {String(t?.text ?? t?.description ?? "").trim()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
