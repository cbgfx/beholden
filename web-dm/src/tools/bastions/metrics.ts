import type { CampaignCharacter } from "@/domain/types/domain";
import { specialSlotsForLevel } from "@/tools/bastions/utils";
import type { Bastion, CompendiumFacility } from "@/tools/bastions/types";

export function selectedLevelFromAssignments(bastion: Bastion, players: CampaignCharacter[]): number {
  return Math.max(
    1,
    ...players
      .filter((player) => bastion.assignedPlayerIds.includes(player.id))
      .map((player) => player.level),
    1,
  );
}

export function selectedSpecialUsage(
  bastion: Bastion,
  facilitiesByKey: Map<string, CompendiumFacility>,
): number {
  return bastion.facilities.filter((facility) => {
    const def = facility.definition ?? facilitiesByKey.get(facility.facilityKey);
    return def?.type === "special" && facility.source !== "dm_extra";
  }).length;
}

export function selectedSpecialUsageForPlayer(
  bastion: Bastion,
  playerId: string,
  facilitiesByKey: Map<string, CompendiumFacility>,
): number {
  return bastion.facilities.filter((facility) => {
    if (facility.source !== "player" || facility.ownerPlayerId !== playerId) return false;
    const def = facility.definition ?? facilitiesByKey.get(facility.facilityKey);
    return def?.type === "special";
  }).length;
}

export function selectedSpecialSlotsForPlayer(players: CampaignCharacter[], playerId: string): number {
  const player = players.find((entry) => entry.id === playerId);
  return specialSlotsForLevel(player?.level ?? 1);
}

export function selectedHirelingsTotal(
  bastion: Bastion,
  facilitiesByKey: Map<string, CompendiumFacility>,
): number {
  return bastion.facilities.reduce((sum, facility) => {
    const def = facility.definition ?? facilitiesByKey.get(facility.facilityKey);
    return sum + (def?.hirelings ?? 0);
  }, 0);
}

export function availableFacilityOptions(args: {
  bastion: Bastion;
  source: "player" | "dm_extra";
  ownerPlayerId?: string;
  compendiumFacilities: CompendiumFacility[];
  players: CampaignCharacter[];
  facilitiesByKey: Map<string, CompendiumFacility>;
}): CompendiumFacility[] {
  const { bastion, source, ownerPlayerId, compendiumFacilities, players, facilitiesByKey } = args;
  const level = selectedLevelFromAssignments(bastion, players);
  const existingCounts = new Map<string, number>();
  for (const facility of bastion.facilities) {
    existingCounts.set(facility.facilityKey, (existingCounts.get(facility.facilityKey) ?? 0) + 1);
  }

  return compendiumFacilities.filter((facility) => {
    const ownerLevel = ownerPlayerId ? (players.find((entry) => entry.id === ownerPlayerId)?.level ?? 1) : level;
    if (facility.type === "special" && source !== "dm_extra" && facility.minimumLevel > ownerLevel) return false;
    if (source === "player" && ownerPlayerId && facility.type === "special") {
      const used = selectedSpecialUsageForPlayer(bastion, ownerPlayerId, facilitiesByKey);
      const slots = selectedSpecialSlotsForPlayer(players, ownerPlayerId);
      if (used >= slots) return false;
    }
    if (!facility.allowMultiple && (existingCounts.get(facility.key) ?? 0) > 0) return false;
    return true;
  });
}
