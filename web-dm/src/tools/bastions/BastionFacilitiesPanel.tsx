import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import type { BastionSpaceDefinition, SpecialFacilitySlotStep } from "@beholden/shared/domain/bastionFacilities";
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
import type { Bastion, CompendiumFacility } from "@/tools/bastions/types";

export function BastionFacilitiesPanel(props: {
  selectedBastion: Bastion;
  players: CampaignCharacter[];
  compendiumFacilities: CompendiumFacility[];
  facilitiesByKey: Map<string, CompendiumFacility>;
  /** Sizes with their compendium costs, for the upgrade pill. */
  spaces: BastionSpaceDefinition[];
  /** Special facility slots by level, from the compendium. */
  specialFacilitySlots: SpecialFacilitySlotStep[];
  facilitiesExpanded: boolean;
  /** The player whose facilities are shown and added, or null for Granted facilities. */
  activeOwnerPlayerId: string | null;
  busy: boolean;
  onToggleFacilities: () => void;
  onSetActiveOwnerPlayerId: React.Dispatch<React.SetStateAction<string | null>>;
  onAddFacility: (source: "player" | "dm_extra", facilityKey: string, ownerPlayerId?: string) => Promise<boolean>;
  onChangeOrder: (facilityId: string, order: string | null) => void;
  onCommitNotes: (facilityId: string, notes: string) => Promise<boolean>;
  onSetSize: (facilityId: string, size: string) => void;
  onRemoveFacility: (facilityId: string) => void;
}) {
  const translateUi = useUiTranslation("dmUi");
  const {
    selectedBastion,
    players,
    compendiumFacilities,
    facilitiesByKey,
    spaces,
    specialFacilitySlots,
    facilitiesExpanded,
    activeOwnerPlayerId,
    busy,
    onToggleFacilities,
    onSetActiveOwnerPlayerId,
    onAddFacility,
    onChangeOrder,
    onCommitNotes,
    onSetSize,
    onRemoveFacility,
  } = props;

  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionTitle
        color={theme.colors.colorMagic}
        collapsed={!facilitiesExpanded}
        onToggle={onToggleFacilities}
      >
        {translateUi("Facilities")}
      </SectionTitle>
      {facilitiesExpanded ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FacilityEditor
            options={
              activeOwnerPlayerId
                ? availableFacilityOptions({
                  bastion: selectedBastion,
                  source: "player",
                  ownerPlayerId: activeOwnerPlayerId,
                  compendiumFacilities,
                  players,
                  facilitiesByKey,
                  specialFacilitySlots,
                })
                : availableFacilityOptions({
                  bastion: selectedBastion,
                  source: "dm_extra",
                  compendiumFacilities,
                  players,
                  facilitiesByKey,
                  specialFacilitySlots,
                })
            }
            label={translateUi("Facilities")}
            source={activeOwnerPlayerId ? "player" : "dm_extra"}
            ownerPlayerId={activeOwnerPlayerId ?? undefined}
            rows={
              activeOwnerPlayerId
                ? selectedBastion.facilities.filter((facility) => facility.source === "player" && facility.ownerPlayerId === activeOwnerPlayerId)
                : selectedBastion.facilities.filter((facility) => facility.source === "dm_extra")
            }
            spaces={spaces}
            busy={busy}
            onAdd={onAddFacility}
            onChangeOrder={onChangeOrder}
            onCommitNotes={onCommitNotes}
            onSetSize={onSetSize}
            onRemove={onRemoveFacility}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  onSetActiveOwnerPlayerId(null);
                }}
                style={chipButtonStyle(!activeOwnerPlayerId)}
              >
                {translateUi("Granted")}
              </button>
              {selectedBastion.assignedPlayerIds.map((playerId) => {
                const player = players.find((entry) => entry.id === playerId);
                const used = selectedSpecialUsageForPlayer(selectedBastion, playerId, facilitiesByKey);
                const slots = selectedSpecialSlotsForPlayer(players, playerId, specialFacilitySlots);
                return (
                  <button
                    key={`player-toggle:${playerId}`}
                    type="button"
                    onClick={() => {
                      onSetActiveOwnerPlayerId((prev) => (prev === playerId ? null : playerId));
                    }}
                    style={chipButtonStyle(activeOwnerPlayerId === playerId)}
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
