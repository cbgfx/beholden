import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import type { CampaignCharacter } from "@/domain/types/domain";
import { SectionTitle } from "@/ui/SectionTitle";
import { theme } from "@/theme/theme";
import type { Bastion, CompendiumFacility } from "@/tools/bastions/types";
import { chipButtonStyle } from "@/tools/bastions/styles";
import { selectedHirelingsTotal, selectedSpecialUsage } from "@/tools/bastions/metrics";
import { CommittedCountInput, CommittedTextArea } from "@/tools/bastions/CommittedFields";

const countInputStyle: React.CSSProperties = {
  width: 72,
  borderRadius: 8,
  border: `1px solid ${theme.colors.panelBorder}`,
  background: "rgba(255,255,255,0.03)",
  color: theme.colors.text,
  padding: "6px 8px",
  fontSize: "var(--fs-small)",
  boxSizing: "border-box",
};

export function BastionOverviewPanel(props: {
  selectedBastion: Bastion;
  players: CampaignCharacter[];
  facilitiesByKey: Map<string, CompendiumFacility>;
  overviewExpanded: boolean;
  onToggleOverview: () => void;
  onToggleAssignedPlayer: (playerId: string) => void;
  onToggleWalled: () => void;
  onCommitDefenders: (field: "defendersArmed" | "defendersUnarmed", count: number) => Promise<boolean>;
  onCommitNotes: (notes: string) => Promise<boolean>;
}) {
  const translateUi = useUiTranslation("dmUi");
  const {
    selectedBastion,
    players,
    facilitiesByKey,
    overviewExpanded,
    onToggleOverview,
    onToggleAssignedPlayer,
    onToggleWalled,
    onCommitDefenders,
    onCommitNotes,
  } = props;

  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionTitle
        color={theme.colors.colorMagic}
        collapsed={!overviewExpanded}
        onToggle={onToggleOverview}
      >
        {translateUi("Overview")}
      </SectionTitle>
      {overviewExpanded ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 12, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              {translateUi("Assigned Players")}
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
                    title={translateUi("{{value1}} Lv {{value2}}", { value1: player.characterName || "Unnamed", value2: player.level })}
                  >
                    <span>{player.characterName || "Unnamed"}</span>
                    <span style={{ color: theme.colors.muted, fontWeight: 600 }}>{translateUi("Lv")} {player.level}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              {translateUi("Slot Usage")}
            </div>
            <div style={{ fontSize: "var(--fs-body)", color: theme.colors.text, fontWeight: 700 }}>
              {translateUi("Special Slots:")} {selectedSpecialUsage(selectedBastion, facilitiesByKey)} / {selectedBastion.specialSlots}
            </div>
            <div style={{ marginTop: 6, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
              {translateUi("Hirelings:")} {selectedHirelingsTotal(selectedBastion, facilitiesByKey)}
            </div>
            <div style={{ marginTop: 4, fontSize: "var(--fs-small)", color: theme.colors.muted, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {translateUi("Bastion Defenders:")} {Math.max(0, selectedBastion.defendersArmed + selectedBastion.defendersUnarmed)}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                {translateUi("Armed")}
                <CommittedCountInput
                  key={`${selectedBastion.id}:armed`}
                  value={selectedBastion.defendersArmed}
                  onCommit={(count) => onCommitDefenders("defendersArmed", count)}
                  style={countInputStyle}
                />
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: theme.colors.muted, fontSize: "var(--fs-tiny)" }}>
                {translateUi("Unarmed")}
                <CommittedCountInput
                  key={`${selectedBastion.id}:unarmed`}
                  value={selectedBastion.defendersUnarmed}
                  onCommit={(count) => onCommitDefenders("defendersUnarmed", count)}
                  style={countInputStyle}
                />
              </label>
            </div>
            <div style={{ marginTop: 6 }}>
              <button
                type="button"
                onClick={onToggleWalled}
                style={chipButtonStyle(Boolean(selectedBastion.walled))}
              >
                {translateUi("Walled")}
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              {translateUi("Bastion Notes")}
            </div>
            <CommittedTextArea
              key={`${selectedBastion.id}:notes`}
              value={selectedBastion.notes}
              onCommit={onCommitNotes}
              placeholder={translateUi("Bastion notes")}
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
