import type { BastionFacilityUpgrade } from "@beholden/shared/domain/bastionFacilities";

export type BastionCompendiumFacility = {
  id: string;
  key: string;
  name: string;
  type: "basic" | "special";
  minimumLevel: number;
  prerequisite: string | null;
  orders: string[];
  allowMultiple: boolean;
  space: string | null;
  hirelings: number | null;
  description: string | null;
  /** Sizes a basic facility may have, from the compendium. */
  spaces: string[] | null;
  /** A special facility's enlargement, from the compendium. */
  upgrade: BastionFacilityUpgrade | null;
};

export type BastionFacilityState = {
  id: string;
  facilityKey: string;
  source: "player" | "dm_extra";
  ownerPlayerId: string | null;
  order: string | null;
  notes: string;
  /** Current size key (`cramped`, `roomy`, `vast`). Null only while the definition is missing. */
  size: string | null;
};

export type BastionRow = {
  id: string;
  campaign_id: string;
  name: string;
  active: number;
  walled: number;
  defenders_armed: number;
  defenders_unarmed: number;
  assigned_player_ids_json: string;
  assigned_character_ids_json: string;
  notes: string;
  maintain_order: number;
  facilities_json: string;
  created_at: number;
  updated_at: number;
};

export const FACILITY_ID_PREFIX = "bastion-facility-assignment";
