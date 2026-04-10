import React from "react";
import type { CampaignCharacter } from "@/domain/types/domain";
import { SectionTitle } from "@/ui/SectionTitle";
import { theme } from "@/theme/theme";
import type { Bastion, CompendiumFacility } from "@/tools/bastions/types";
import { chipButtonStyle } from "@/tools/bastions/styles";
import { selectedHirelingsTotal, selectedSpecialUsage } from "@/tools/bastions/metrics";

export function BastionOverviewPanel(props: {
  selectedBastion: Bastion;
  players: CampaignCharacter[];
  facilitiesByKey: Map<string, CompendiumFacility>;
  overviewExpanded: boolean;
  onToggleOverview: () => void;
  onToggleAssignedPlayer: (playerId: string) => void;
  onUpdateSelectedDraft: (mutator: (bastion: Bastion) => Bastion) => void;
}) {
  const {
    selectedBastion,
    players,
    facilitiesByKey,
    overviewExpanded,
    onToggleOverview,
    onToggleAssignedPlayer,
    onUpdateSelectedDraft,
  } = props;

  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionTitle
        color={theme.colors.colorMagic}
        collapsed={!overviewExpanded}
        onToggle={onToggleOverview}
      >
        Overview
      </SectionTitle>
      {overviewExpanded ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 12, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Assigned Players
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {players.map((player) => {
                const selected = selectedBastion.assignedPlayerIds.includes(player.id);
                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => onToggleAssignedPlayer(player.id)}
                    style={chipButtonStyle(selected)}
                    title={`${player.characterName || "Unnamed"} Lv ${player.level}`}
                  >
                    <span>{player.characterName || "Unnamed"}</span>
                    <span style={{ color: theme.colors.muted, fontWeight: 600 }}>Lv {player.level}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Slot Usage
            </div>
            <div style={{ fontSize: "var(--fs-body)", color: theme.colors.text, fontWeight: 700 }}>
              Special Slots: {selectedSpecialUsage(selectedBastion, facilitiesByKey)} / {selectedBastion.specialSlots}
            </div>
            <div style={{ marginTop: 6, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
              Hirelings: {selectedHirelingsTotal(selectedBastion, facilitiesByKey)}
            </div>
            <div style={{ marginTop: 4, fontSize: "var(--fs-small)", color: theme.colors.muted, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              Bastion Defenders: {Math.max(0, selectedBastion.defendersArmed + selectedBastion.defendersUnarmed)}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                Armed
                <input
                  type="number"
                  min={0}
                  value={selectedBastion.defendersArmed}
                  onChange={(e) => {
                    const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                    onUpdateSelectedDraft((bastion) => ({ ...bastion, defendersArmed: next }));
                  }}
                  style={{
                    width: 72,
                    borderRadius: 8,
                    border: `1px solid ${theme.colors.panelBorder}`,
                    background: "rgba(255,255,255,0.03)",
                    color: theme.colors.text,
                    padding: "6px 8px",
                    fontSize: "var(--fs-small)",
                    boxSizing: "border-box",
                  }}
                />
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                Unarmed
                <input
                  type="number"
                  min={0}
                  value={selectedBastion.defendersUnarmed}
                  onChange={(e) => {
                    const next = Math.max(0, Math.floor(Number(e.target.value || 0)));
                    onUpdateSelectedDraft((bastion) => ({ ...bastion, defendersUnarmed: next }));
                  }}
                  style={{
                    width: 72,
                    borderRadius: 8,
                    border: `1px solid ${theme.colors.panelBorder}`,
                    background: "rgba(255,255,255,0.03)",
                    color: theme.colors.text,
                    padding: "6px 8px",
                    fontSize: "var(--fs-small)",
                    boxSizing: "border-box",
                  }}
                />
              </label>
            </div>
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                onClick={() => onUpdateSelectedDraft((bastion) => ({ ...bastion, walled: !bastion.walled }))}
                style={chipButtonStyle(Boolean(selectedBastion.walled))}
              >
                Walled
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Bastion Notes
            </div>
            <textarea
              value={selectedBastion.notes}
              onChange={(e) => onUpdateSelectedDraft((bastion) => ({ ...bastion, notes: e.target.value }))}
              placeholder="Bastion notes"
              style={{
                width: "100%",
                minHeight: 112,
                borderRadius: 8,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: "rgba(255,255,255,0.03)",
                color: theme.colors.text,
                padding: 8,
                boxSizing: "border-box",
                fontSize: "var(--fs-small)",
                fontFamily: "inherit",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
