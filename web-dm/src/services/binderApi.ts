import { api, jsonInit } from "@/services/api";

export type BinderSummary = {
  id: string;
  ownerUserId: string;
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

export function exportBinder(binderId: string): Promise<unknown> {
  return api(`/api/binders/${binderId}/export`);
}

export function importBinder(file: File): Promise<{ binderId: string; name: string; recordCount: number }> {
  const body = new FormData();
  body.append("file", file);
  return api("/api/binders/import", { method: "POST", body });
}

export function updateCampaignBinderContent(
  campaignId: string,
  changes: { campaignStory?: string | null; campaignNotes?: string | null },
): Promise<{ ok: true; campaignStory: string | null; campaignNotes: string | null; updatedAt: number }> {
  return api(`/api/campaigns/${campaignId}/binder-content`, jsonInit("PATCH", changes));
}
