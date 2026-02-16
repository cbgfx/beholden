import React from "react";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { IconINPC, IconMonster, IconPlayer, IconTrash } from "@/icons";

import type { CombatantVM } from "@/views/CampaignView/panels/EncounterRosterPanel/utils";
import { formatCombatantMeta } from "@/views/CampaignView/panels/EncounterRosterPanel/utils";

export function EncounterRosterList(props: {
  combatants: CombatantVM[];
  onEditCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {props.combatants.map((c) => {
        const isPlayer = c.baseType === "player";
        const isINpc = c.baseType === "inpc";

        const iconColor = isPlayer
          ? theme.colors.blue
          : c.friendly
            ? theme.colors.green
            : theme.colors.red;

        const icon = isPlayer ? <IconPlayer /> : isINpc ? <IconINPC /> : <IconMonster />;
        const meta = formatCombatantMeta(c);

        return (
          <div
            key={c.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 6,
              fontSize: "var(--fs-medium)",
              alignItems: "center",
              padding: 8,
              borderRadius: 10,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: "rgba(0,0,0,0.14)"
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 900 }}>
                <span style={{ color: iconColor, display: "inline-flex", alignItems: "center" }}>{icon}</span>
                <span>{c.label}</span>
              </div>
              {meta ? (
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{meta}</div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <IconButton title="Edit" variant="ghost" onClick={() => props.onEditCombatant(c.id)}>
                <span style={{ fontWeight: 900 }}>✎</span>
              </IconButton>
              <IconButton title="Remove" variant="ghost" onClick={() => props.onRemoveCombatant(c.id)}>
                <IconTrash />
              </IconButton>
            </div>
          </div>
        );
      })}
      {!props.combatants.length ? <div style={{ color: theme.colors.muted }}>No combatants yet.</div> : null}
    </div>
  );
}
