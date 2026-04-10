import React from "react";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import type { Bastion } from "@/tools/bastions/types";

export function BastionsSidebar(props: {
  campaignId: string;
  bastions: Bastion[];
  selectedBastionId: string | null;
  saving: boolean;
  onCreateBastion: () => void;
  onSelectBastion: (id: string) => void;
}) {
  const { campaignId, bastions, selectedBastionId, saving, onCreateBastion, onSelectBastion } = props;

  return (
    <div style={{ borderRight: `1px solid ${theme.colors.panelBorder}`, padding: 12, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
      {!campaignId ? (
        <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>Select a campaign to manage Bastions.</div>
      ) : (
        <>
          <div style={{ marginTop: 6, fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Bastions ({bastions.length})</span>
            <Button onClick={onCreateBastion} disabled={saving}>+</Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bastions.map((bastion) => (
              <button
                key={bastion.id}
                onClick={() => onSelectBastion(bastion.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${selectedBastionId === bastion.id ? withAlpha(theme.colors.accentPrimary, 0.55) : theme.colors.panelBorder}`,
                  background: selectedBastionId === bastion.id ? withAlpha(theme.colors.accentPrimary, 0.12) : "rgba(255,255,255,0.03)",
                  color: theme.colors.text,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: "var(--fs-small)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bastion.name}</span>
                  <span style={{ fontSize: "var(--fs-tiny)", color: bastion.active ? theme.colors.green : theme.colors.muted, fontWeight: 700 }}>
                    {bastion.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div style={{ marginTop: 4, fontSize: "var(--fs-tiny)", color: theme.colors.muted }}>
                  Slots {bastion.specialSlotsUsed}/{bastion.specialSlots}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
