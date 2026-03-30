import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { MonsterSpellSection } from "@/drawers/drawers/combatant/MonsterSpellSection";
import { MonsterTextSection } from "@/drawers/drawers/combatant/MonsterTextSection";

export function MonsterPreview(props: { monster: any }) {
  const m = props.monster;

  return (
    <div
      style={{
        marginTop: 6,
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: withAlpha(theme.colors.shadowColor, 0.14),
        display: "grid",
        gap: 10,
        fontSize: "var(--fs-medium)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ color: theme.colors.text, fontWeight: 900 }}>{m.name}</div>
        <div style={{ color: theme.colors.muted, fontWeight: 800 }}>CR {m.cr ?? "?"}</div>
      </div>

      <MonsterSpellSection monster={m} />
      <MonsterTextSection title="Traits" blocks={Array.isArray(m.trait) ? m.trait : []} />
      <MonsterTextSection title="Actions" blocks={Array.isArray(m.action) ? m.action : []} />
      <MonsterTextSection title="Reactions" blocks={Array.isArray(m.reaction) ? m.reaction : []} />
      <MonsterTextSection title="Legendary" blocks={Array.isArray(m.legendary) ? m.legendary : []} />
    </div>
  );
}
