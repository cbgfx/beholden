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
};

export type BastionFacility = {
  id: string;
  facilityKey: string;
  source: "player" | "dm_extra";
  ownerPlayerId: string | null;
  order: string | null;
  notes: string;
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
};

export type BastionsResponse = {
  ok: boolean;
  role: "dm" | "player";
  currentUserPlayerIds: string[];
  bastions: Bastion[];
};

export type BastionCompendiumResponse = {
  ok: boolean;
  facilities: CompendiumFacility[];
  orders: Array<{ id: string; name: string; key: string; sort: number }>;
};
