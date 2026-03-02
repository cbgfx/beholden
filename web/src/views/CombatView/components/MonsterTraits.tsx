import React from "react";
import { theme } from "@/theme/theme";
import type { MonsterDetail } from "@/views/CombatView/types";
import { ActionRow } from "@/views/CombatView/components/ActionRow";

export function MonsterTraits(props: { monster: MonsterDetail }) {
  if (!(props.monster.trait ?? []).length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900, marginBottom: 8 }}>Traits</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflow: "auto" }}>
        {[...(props.monster.trait ?? [])].sort((a, b) => {
            const aIsSource = String(a?.name ?? "").trim().toLowerCase() === "source";
            const bIsSource = String(b?.name ?? "").trim().toLowerCase() === "source";
            if (aIsSource === bIsSource) return 0;
            return aIsSource ? 1 : -1;
          }).map((t, i) => {
            const name = String(t?.name ?? `Trait ${i + 1}`);
            const text = Array.isArray(t?.text) ? t.text.map(String).join(" ") : String(t?.text ?? "");
            return <ActionRow key={`${name}-${i}`} title={name} subtitle={text} />;
          })}
      </div>
    </div>
  );
}
