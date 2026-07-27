import { api, jsonInit } from "@/services/api";

export type BinderRecordOption = {
  id: string;
  binderId: string;
  type: string;
  name: string;
  route: string;
};
export type BinderAssociation = { id: string; name?: string; type?: string; role: string | null; description: string | null };
export type BinderItem = {
  id: string; binder_id: string; name: string; description: string | null; dm_notes: string | null;
  compendium_item_id: string | null; compendium_item_name: string | null;
  holder_mortal_id: string | null; holder_name: string | null;
  location_record_id: string | null; location_name: string | null;
};
export type BinderEvent = {
  id: string; title: string; description: string | null; dateText: string | null; dateSort: number | null;
  endDateText: string | null; endDateSort: number | null;
  records: BinderAssociation[]; campaigns: BinderAssociation[];
};
export type BinderRelationship = {
  id: string; sourceRecordId: string; sourceName: string; sourceType: string;
  targetRecordId: string; targetName: string; targetType: string;
  category: string; sourceLabel: string | null; targetLabel: string | null; isSymmetric: number;
  startDateText: string | null; endDateText: string | null; notes: string | null;
};

const base = (binderId: string) => `/api/binders/${binderId}`;
export const fetchBinderRecordOptions = (binderId: string, query = "", types: string[] = []) =>
  api<BinderRecordOption[]>(`${base(binderId)}/records?q=${encodeURIComponent(query)}&types=${encodeURIComponent(types.join(","))}`);
export const fetchBinderItems = (binderId: string) => api<BinderItem[]>(`${base(binderId)}/items`);
export const createBinderItem = (binderId: string, input: Record<string, unknown>) =>
  api<BinderItem>(`${base(binderId)}/items`, jsonInit("POST", input));
export const updateBinderItem = (binderId: string, id: string, input: Record<string, unknown>) =>
  api<BinderItem>(`${base(binderId)}/items/${id}`, jsonInit("PATCH", input));
export const deleteBinderItem = (binderId: string, id: string) =>
  api<{ ok: true }>(`${base(binderId)}/items/${id}`, { method: "DELETE" });
export const fetchBinderEvents = (binderId: string) => api<BinderEvent[]>(`${base(binderId)}/events`);
export const createBinderEvent = (binderId: string, input: Record<string, unknown>) =>
  api<BinderEvent>(`${base(binderId)}/events`, jsonInit("POST", input));
export const updateBinderEvent = (binderId: string, id: string, input: Record<string, unknown>) =>
  api<BinderEvent>(`${base(binderId)}/events/${id}`, jsonInit("PATCH", input));
export const deleteBinderEvent = (binderId: string, id: string) =>
  api<{ ok: true }>(`${base(binderId)}/events/${id}`, { method: "DELETE" });
export const fetchBinderRelationships = (binderId: string, recordId?: string) =>
  api<BinderRelationship[]>(`${base(binderId)}/relationships${recordId ? `?recordId=${encodeURIComponent(recordId)}` : ""}`);
export const createBinderRelationship = (binderId: string, input: Record<string, unknown>) =>
  api<{ id: string }>(`${base(binderId)}/relationships`, jsonInit("POST", input));
export const deleteBinderRelationship = (binderId: string, id: string) =>
  api<{ ok: true }>(`${base(binderId)}/relationships/${id}`, { method: "DELETE" });
export const syncBinderMentions = (binderId: string, sourceRecordId: string, sourceField: string, text: string | null) =>
  api<{ ok: true }>(`${base(binderId)}/mentions`, jsonInit("PUT", { sourceRecordId, sourceField, text }));
export type BinderBacklink = { id: string; name: string; type: string; route: string; fields: string[] };
export const fetchBinderBacklinks = (binderId: string, recordId: string) =>
  api<BinderBacklink[]>(`${base(binderId)}/records/${recordId}/backlinks`);

const MENTION_ID_PATTERN = /\[[^\]]+\]\(\/binder\/[^/]+\/[^/]+\/([^/?#)]+)\)/g;
export function extractMentionIds(...texts: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    MENTION_ID_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MENTION_ID_PATTERN.exec(text)) !== null) ids.add(decodeURIComponent(match[1]!));
  }
  return [...ids];
}
export const checkBinderRecordsExist = (binderId: string, ids: string[]) =>
  ids.length
    ? api<{ existingIds: string[] }>(`${base(binderId)}/records/exists`, jsonInit("POST", { ids })).then((res) => new Set(res.existingIds))
    : Promise.resolve(new Set<string>());
