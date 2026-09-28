import { api, apiBlob, jsonInit } from "@/services/api";

export type BinderSummary = {
  id: string;
  ownerUserId: string;
  accessRole: "owner" | "collaborator" | "viewer";
  name: string;
  color: string;
  description: string | null;
  currentDate: {
    text: string | null;
    sort: number | null;
  };
  campaignCount: number;
  recordCount: number;
  createdAt: number;
  updatedAt: number;
};

export function fetchBinders(): Promise<BinderSummary[]> {
  return api<BinderSummary[]>("/api/binders");
}

export function createBinder(name: string, color: string, currentDate: number): Promise<BinderSummary> {
  return api<BinderSummary>("/api/binders", jsonInit("POST", {
    name,
    color,
    currentDateText: String(currentDate),
    currentDateSort: currentDate,
  }));
}

export function updateBinderIdentity(binderId: string, name: string, color: string, currentDate: number): Promise<BinderSummary> {
  return api<BinderSummary>(`/api/binders/${binderId}`, jsonInit("PATCH", {
    name,
    color,
    currentDateText: String(currentDate),
    currentDateSort: currentDate,
  }));
}

export function deleteBinder(binderId: string): Promise<{ ok: true; detachedCampaigns: number }> {
  return api(`/api/binders/${binderId}`, { method: "DELETE" });
}

export function exportBinder(binderId: string, includePictures = false): Promise<Blob> {
  return apiBlob(`/api/binders/${binderId}/export${includePictures ? "?images=1" : ""}`);
}

export function importBinder(file: File): Promise<{ binderId: string; name: string; recordCount: number }> {
  const body = new FormData();
  body.append("file", file);
  return api("/api/binders/import", { method: "POST", body });
}

export type BinderImportPreview = {
  name: string; recordCount: number;
  counts: Array<{ type: string; count: number }>;
  associations: { relationships: number; mentions: number; memberships: number; eventRecords: number };
  warnings: string[];
};
export function previewBinderImport(file: File): Promise<BinderImportPreview> {
  const body = new FormData(); body.append("file", file);
  return api("/api/binders/import/preview", { method: "POST", body });
}

export type BinderMember = {
  id: string; username: string; name: string;
  role: "owner" | "collaborator" | "viewer";
};

export const fetchBinderMembers = (binderId: string) =>
  api<BinderMember[]>(`/api/binders/${binderId}/members`);
export const saveBinderMember = (binderId: string, username: string, role: "collaborator" | "viewer") =>
  api<BinderMember>(`/api/binders/${binderId}/members`, jsonInit("PUT", { username, role }));
export const removeBinderMember = (binderId: string, userId: string) =>
  api<{ ok: true }>(`/api/binders/${binderId}/members/${userId}`, { method: "DELETE" });

export type BinderDashboard = {
  counts: Array<{ type: string; count: number }>;
  recent: Array<{ id: string; name: string; type: string; updatedAt: number; route: string }>;
  nearbyEvents: Array<{ id: string; name: string; dateText: string | null; dateSort: number; route: string }>;
  incomplete: Array<{ id: string; name: string; type: string; route: string }>;
  unlinkedNpcCount: number;
  undatedEventCount: number;
};
export const fetchBinderDashboard = (binderId: string) =>
  api<BinderDashboard>(`/api/binders/${binderId}/dashboard`);

export type BinderHealth = {
  healthy: boolean; issueCount: number;
  groups: Array<{ code: string; severity: "warning" | "info"; title: string; issues: Array<{ id: string; name: string; type: string; detail: string; route: string }> }>;
};
export const fetchBinderHealth = (binderId: string) => api<BinderHealth>(`/api/binders/${binderId}/health`);

export function updateCampaignBinderContent(
  campaignId: string,
  changes: { campaignStory?: string | null; campaignNotes?: string | null },
): Promise<{ ok: true; campaignStory: string | null; campaignNotes: string | null; updatedAt: number }> {
  return api(`/api/campaigns/${campaignId}/binder-content`, jsonInit("PATCH", changes));
}
