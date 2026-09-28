import type {
  BastionFacilityUpgrade,
  BastionSpaceDefinition,
  SpecialFacilitySlotStep,
} from "@beholden/shared/domain/bastionFacilities";

export type CompendiumFacility = {
  id: string;
  name: string;
  key: string;
  type: "basic" | "special";
  minimumLevel: number;
  prerequisite: string | null;
  orders: string[];
  space: string | null;
  hirelings: number | null;
  allowMultiple: boolean;
  description: string | null;
  /** Sizes a basic facility may have. */
  spaces?: string[] | null;
  /** A special facility's enlargement. */
  upgrade?: BastionFacilityUpgrade | null;
};

export type BastionFacility = {
  id: string;
  facilityKey: string;
  source: "player" | "dm_extra";
  ownerPlayerId: string | null;
  order: string | null;
  notes: string;
  /** Current size key: cramped, roomy or vast. */
  size: string | null;
  /** Hirelings at the current size, upgrade included. */
  hirelings?: number;
  definition: CompendiumFacility | null;
};

export type Bastion = {
  id: string;
  campaignId: string;
  name: string;
  active: boolean;
  walled: boolean;
  defendersArmed: number;
  defendersUnarmed: number;
  assignedPlayerIds: string[];
  assignedCharacterIds: string[];
  assignedPlayers?: Array<{ id: string; userId: string | null; level: number; characterId: string | null; characterName: string }>;
  notes: string;
  maintainOrder: boolean;
  facilities: BastionFacility[];
  level: number;
  specialSlots: number;
  specialSlotsUsed: number;
  hirelingsTotal?: number;
  /** Server version of the row, used to ignore a refresh older than what's already shown. */
  updatedAt?: number;
};

export type BastionsResponse = {
  ok: boolean;
  role: "dm" | "player";
  currentUserPlayerIds: string[];
  bastions: Bastion[];
};

export type BastionResponse = {
  ok: boolean;
  role: "dm" | "player";
  currentUserPlayerIds: string[];
  bastion: Bastion;
};

export type BastionCompendiumResponse = {
  ok: boolean;
  facilities: CompendiumFacility[];
  orders: Array<{ id: string; name: string; key: string; sort: number }>;
  /** Sizes with the compendium's basic facility costs. */
  spaces: BastionSpaceDefinition[];
  /** Special facility slots by level, from the compendium's rules entry. */
  specialFacilitySlots: SpecialFacilitySlotStep[];
};
