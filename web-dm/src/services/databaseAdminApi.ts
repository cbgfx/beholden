import { api, apiBlob } from "@/services/api";

export type DatabaseImportResult = {
  ok: true;
  backupPath: string;
  tablesReplaced: number;
  rowsImported: number;
};

export async function exportDatabase(): Promise<Blob> {
  return apiBlob("/api/admin/database/export");
}

export async function importDatabase(file: File): Promise<DatabaseImportResult> {
  const form = new FormData();
  form.append("file", file);
  return api("/api/admin/database/import", { method: "POST", body: form });
}
