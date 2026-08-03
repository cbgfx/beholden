import { api, jsonInit } from "@/services/api";

export type BinderReferenceType =
  | "races" | "positions" | "domains" | "organizations" | "deities"
  | "continents" | "countries" | "locations" | "points-of-interest";
export type BinderReferenceLink = { id: string; name: string };

export const DEITY_RANKS = ["Demi God", "Lesser God", "Greater God", "Overpower"] as const;
export type DeityRank = typeof DEITY_RANKS[number];
export const DEITY_RANK_COLORS: Record<DeityRank, string> = {
  "Demi God": "#8a8f98",
  "Lesser God": "#e5484d",
  "Greater God": "#3b82f6",
  "Overpower": "#30a46c",
};

export type BinderReferenceRecord = {
  id: string;
  binderId: string;
  visibility: "dm" | "public";
  name: string;
  description: string | null;
  parent: { id: string; name: string; type: "continent" | "country" | "location" | "poi" } | null;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
  imageUrl: string | null;
  imageUpdatedAt: number | null;
  /** Only present on `deities` records. */
  domains?: BinderReferenceLink[];
  /** Only present on `domains` records. */
  deities?: BinderReferenceLink[];
  /** Only meaningful on `organizations` records — the Mortal who leads it, if any. */
  leader: BinderReferenceLink | null;
  /** Only meaningful on `organizations`, `positions`, `points-of-interest` — an Iconify id, e.g. `game-icons:castle`. */
  icon: string | null;
  /** Only meaningful on `deities` records. */
  rank: DeityRank | null;
};

export type BinderReferenceInput = {
  name: string;
  description: string | null;
  visibility?: "dm" | "public";
  parentId?: string | null;
  /** Only meaningful for `organizations` — a Mortal id from this Binder, or null to clear. */
  leaderId?: string | null;
  /** Only meaningful for `organizations`, `positions`, `points-of-interest` — an Iconify id, or null to clear. */
  icon?: string | null;
  /** Only meaningful for `deities`, or null to clear. */
  rank?: DeityRank | null;
};

function base(binderId: string, type: BinderReferenceType) {
  return `/api/binders/${binderId}/reference/${type}`;
}

export function fetchBinderReferences(
  binderId: string,
  type: BinderReferenceType,
  query = "",
): Promise<BinderReferenceRecord[]> {
  const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return api(`${base(binderId, type)}${search}`);
}

export function createBinderReference(
  binderId: string,
  type: BinderReferenceType,
  input: BinderReferenceInput,
): Promise<BinderReferenceRecord> {
  return api(base(binderId, type), jsonInit("POST", input));
}

export function updateBinderReference(
  binderId: string,
  type: BinderReferenceType,
  recordId: string,
  input: Partial<BinderReferenceInput>,
): Promise<BinderReferenceRecord> {
  return api(`${base(binderId, type)}/${recordId}`, jsonInit("PATCH", input));
}

export function fetchBinderLeaderCharacterOptions(binderId: string): Promise<Array<{ id: string; name: string }>> {
  return api(`/api/binders/${binderId}/leader-character-options`);
}

export function setBinderOrganizationLeaderCharacter(
  binderId: string,
  organizationId: string,
  characterId: string,
): Promise<{ ok: true; mortalId: string }> {
  return api(`/api/binders/${binderId}/organizations/${organizationId}/leader-character`, jsonInit("POST", { characterId }));
}

export type BinderOrganizationMember = { id: string; name: string; position: string | null; role: string | null };

export function fetchBinderOrganizationMembers(
  binderId: string,
  organizationId: string,
): Promise<BinderOrganizationMember[]> {
  return api(`/api/binders/${binderId}/organizations/${organizationId}/members`);
}

export function deleteBinderReference(
  binderId: string,
  type: BinderReferenceType,
  recordId: string,
): Promise<{ ok: true; clearedReferences: number }> {
  return api(`${base(binderId, type)}/${recordId}`, { method: "DELETE" });
}

export function addDeityDomain(
  binderId: string,
  deityId: string,
  domainId: string,
): Promise<{ ok: true; domains: BinderReferenceLink[] }> {
  return api(`${base(binderId, "deities")}/${deityId}/domains/${domainId}`, { method: "POST" });
}

export function removeDeityDomain(
  binderId: string,
  deityId: string,
  domainId: string,
): Promise<{ ok: true; domains: BinderReferenceLink[] }> {
  return api(`${base(binderId, "deities")}/${deityId}/domains/${domainId}`, { method: "DELETE" });
}

export async function uploadBinderReferenceImage(
  binderId: string,
  type: BinderReferenceType,
  recordId: string,
  image: File,
): Promise<{ ok: true; imageUrl: string }> {
  const form = new FormData();
  form.append("image", image);
  return api(`${base(binderId, type)}/${recordId}/image`, { method: "POST", body: form });
}
