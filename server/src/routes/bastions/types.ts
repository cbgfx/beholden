export type BastionCompendiumFacility = {
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
};

export type BastionFacilityState = {
  id: string;
  facilityKey: string;
  source: "player" | "dm_extra";
  ownerPlayerId: string | null;
  order: string | null;
  notes: string;
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
