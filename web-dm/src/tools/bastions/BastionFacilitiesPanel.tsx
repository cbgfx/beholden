import React from "react";
import type { CampaignCharacter } from "@/domain/types/domain";
import { SectionTitle } from "@/ui/SectionTitle";
import { theme } from "@/theme/theme";
import { FacilityEditor } from "@/tools/bastions/FacilityEditor";
import { chipButtonStyle } from "@/tools/bastions/styles";
import {
  availableFacilityOptions,
  selectedSpecialSlotsForPlayer,
  selectedSpecialUsageForPlayer,
} from "@/tools/bastions/metrics";
import type { Bastion, BastionFacility, CompendiumFacility } from "@/tools/bastions/types";

export function BastionFacilitiesPanel(props: {
  selectedBastion: Bastion;
  players: CampaignCharacter[];
  compendiumFacilities: CompendiumFacility[];
  facilitiesByKey: Map<string, CompendiumFacility>;
  facilitiesExpanded: boolean;
  activePlayerFacilityId: string | null;
  onToggleFacilities: () => void;
  onSetActivePlayerFacilityId: React.Dispatch<React.SetStateAction<string | null>>;
  onAddFacility: (source: "player" | "dm_extra", facilityKey: string, ownerPlayerId?: string) => void;
  onUpdateFacility: (facilityId: string, patch: Partial<BastionFacility>) => void;
  onRemoveFacility: (facilityId: string) => void;
}) {
  const {
    selectedBastion,
    players,
    compendiumFacilities,
    facilitiesByKey,
    facilitiesExpanded,
    activePlayerFacilityId,
    onToggleFacilities,
    onSetActivePlayerFacilityId,
    onAddFacility,
    onUpdateFacility,
    onRemoveFacility,
  } = props;

  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionTitle
        color={theme.colors.colorMagic}
        collapsed={!facilitiesExpanded}
        onToggle={onToggleFacilities}
      >
        Facilities
      </SectionTitle>
      {facilitiesExpanded ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FacilityEditor
            options={
              activePlayerFacilityId
                ? availableFacilityOptions({
                  bastion: selectedBastion,
                  source: "player",
                  ownerPlayerId: activePlayerFacilityId,
                  compendiumFacilities,
                  players,
                  facilitiesByKey,
                })
                : availableFacilityOptions({
                  bastion: selectedBastion,
                  source: "dm_extra",
                  compendiumFacilities,
                  players,
                  facilitiesByKey,
                })
            }
            label="Facilities"
            source={activePlayerFacilityId ? "player" : "dm_extra"}
            ownerPlayerId={activePlayerFacilityId ?? undefined}
            rows={
              activePlayerFacilityId
                ? selectedBastion.facilities.filter((facility) => facility.source === "player" && facility.ownerPlayerId === activePlayerFacilityId)
                : selectedBastion.facilities.filter((facility) => facility.source === "dm_extra")
            }
            onAdd={onAddFacility}
            onUpdate={onUpdateFacility}
            onRemove={onRemoveFacility}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  onSetActivePlayerFacilityId(null);
                }}
                style={chipButtonStyle(!activePlayerFacilityId)}
              >
                Granted
              </button>
              {selectedBastion.assignedPlayerIds.map((playerId) => {
                const player = players.find((entry) => entry.id === playerId);
                const used = selectedSpecialUsageForPlayer(selectedBastion, playerId, facilitiesByKey);
                const slots = selectedSpecialSlotsForPlayer(players, playerId);
                return (
                  <button
                    key={`player-toggle:${playerId}`}
                    type="button"
                    onClick={() => {
                      onSetActivePlayerFacilityId((prev) => (prev === playerId ? null : playerId));
                    }}
                    style={chipButtonStyle(activePlayerFacilityId === playerId)}
                  >
                    <span>{player?.characterName || "Unnamed"}</span>
                    <span style={{ color: theme.colors.muted, fontWeight: 600 }}>{used}/{slots}</span>
                  </button>
                );
              })}
            </div>
          </FacilityEditor>
        </div>
      ) : null}
    </div>
  );
}
