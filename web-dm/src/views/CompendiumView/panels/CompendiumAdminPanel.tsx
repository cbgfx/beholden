import React from "react";

import { IconCompendiumAlt } from "@/icons";
import { api } from "@/services/api";
import { Panel } from "@/ui/Panel";
import {
  buildImportSummary,
  CompendiumAdminActions,
  CompendiumAdminDescription,
  CompendiumAdminFeedback,
  type ImportResult,
} from "./CompendiumAdminSections";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function CompendiumAdminPanel() {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [lastImport, setLastImport] = React.useState<ImportResult | null>(null);

  async function uploadCompendium() {
    if (!file) return;
    setBusy(true);
    setMsg("");
    setLastImport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await api<ImportResult>("/api/compendium/import/xml", { method: "POST", body: fd });
      setLastImport(result);
      setMsg("Imported.");
      await api<unknown>("/api/meta");
    } catch (error: unknown) {
      setMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCompendium() {
    setBusy(true);
    setMsg("");
    try {
      await api<unknown>("/api/compendium", { method: "DELETE" });
      setMsg("Compendium deleted.");
      await api<unknown>("/api/meta");
    } catch (error: unknown) {
      setMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const importSummary = buildImportSummary(lastImport);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0, overflow: "auto" }}>
      <Panel
        storageKey="compendium-admin-import"
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconCompendiumAlt size={36} title="Compendium" />
            <span>Compendium import (XML)</span>
          </span>
        }
      >
        <CompendiumAdminDescription />
        <CompendiumAdminActions
          busy={busy}
          fileSelected={!!file}
          onFileChange={setFile}
          onUpload={uploadCompendium}
          onDelete={deleteCompendium}
        />
        <CompendiumAdminFeedback msg={msg} importSummary={importSummary} />
      </Panel>
    </div>
  );
}
