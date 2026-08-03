import { api, jsonInit } from "@/services/api";

export type MortalType = "npc" | "player_character";

export type BinderMortal = {
  id: string;
  binderId: string;
  visibility: "dm" | "campaign" | "public";
  name: string;
  mortalType: MortalType;
  race: { id: string; name: string } | null;
  gender: "male" | "female" | null;
  lifeStatus: "alive" | "dead" | null;
  birthDate: string | null;
  deathDate: string | null;
  location: { id: string; name: string } | null;
  continent: { id: string; name: string } | null;
  organization: { id: string; name: string; icon: string | null } | null;
  organizations: Array<{
    id: string;
    name: string;
    icon: string | null;
    position: { id: string; name: string; icon: string | null } | null;
    isPrimary: boolean;
  }>;
  position: { id: string; name: string; icon: string | null } | null;
  /** Free-text Class, only set for player_character mortals; overridden by the linked player's live class when linked. */
  className: string | null;
  personal: { hair: string | null; height: string | null; weight: string | null; skin: string | null } | null;
  notes: string | null;
  dmNotes: string | null;
  imageUrl: string | null;
  imageUpdatedAt: number | null;
  monsterId: string | null;
  npcMechanics: {
    hpMax: number | null; hpCurrent: number | null; hpDetails: string | null;
    ac: number | null; acDetails: string | null;
    attackOverrides: Record<string, { toHit?: number; damage?: string; damageType?: string }> | null;
  } | null;
  characterId: string | null;
  player: { id: string; playerName: string | null; characterName: string | null } | null;
  createdAt: number;
  updatedAt: number;
};

export type BinderMortalInput = {
  name: string;
  mortalType: MortalType;
  raceId: string | null;
  gender: "male" | "female";
  birthDate: string | null;
  deathDate: string | null;
  locationId: string | null;
  organizationId: string | null;
  positionId: string | null;
  className: string | null;
  notes: string | null;
  dmNotes: string | null;
  playerId: string | null;
  monsterId: string | null;
  hpMax?: number;
  hpCurrent?: number;
  hpDetails?: string | null;
  ac?: number;
  acDetails?: string | null;
  attackOverrides?: Record<string, { toHit?: number; damage?: string; damageType?: string }> | null;
  visibility?: "dm" | "public";
};

export type MortalOptions = {
  records: Array<{ id: string; type: "race" | "position" | "organization" | "continent" | "country" | "location" | "poi"; name: string; icon: string | null }>;
  players: Array<{
    id: string;
    playerName: string;
    characterName: string;
    className: string;
    species: string;
    age: string | null;
    gender: string | null;
    imageUrl: string | null;
    characterId: string | null;
    campaignName: string;
    campaignCurrentDate: number | null;
    linkedMortalId: string | null;
  }>;
  monsters: Array<{
    id: string; name: string; hpMax: number; hpDetails: string | null;
    ac: number; acDetails: string | null;
  }>;
};

const base = (binderId: string) => `/api/binders/${binderId}/mortals`;

export function fetchBinderMortals(binderId: string, query = ""): Promise<BinderMortal[]> {
  const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return api(`${base(binderId)}${search}`);
}

export function fetchMortalOptions(binderId: string): Promise<MortalOptions> {
  return api(`/api/binders/${binderId}/mortal-options`);
}

export function createBinderMortal(binderId: string, input: BinderMortalInput): Promise<BinderMortal> {
  return api(base(binderId), jsonInit("POST", input));
}

export function updateBinderMortal(binderId: string, mortalId: string, input: Partial<BinderMortalInput>): Promise<BinderMortal> {
  return api(`${base(binderId)}/${mortalId}`, jsonInit("PATCH", input));
}

export function deleteBinderMortal(binderId: string, mortalId: string): Promise<{ ok: true }> {
  return api(`${base(binderId)}/${mortalId}`, { method: "DELETE" });
}

export function uploadBinderMortalImage(binderId: string, mortalId: string, file: File): Promise<{ ok: true; imageUrl: string }> {
  const form = new FormData();
  form.append("image", file);
  return api(`${base(binderId)}/${mortalId}/image`, { method: "POST", body: form });
}
