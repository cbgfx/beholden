import { api, jsonInit } from "@/services/api";

export type BinderReferenceType =
  | "races" | "positions" | "domains" | "organizations" | "deities"
  | "continents" | "countries" | "locations" | "points-of-interest";
export type BinderReferenceLink = { id: string; name: string };
export type BinderReferenceRecord = {
  id: string;
  binderId: string;
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
};

export type BinderReferenceInput = {
  name: string;
  description: string | null;
  parentId?: string | null;
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
