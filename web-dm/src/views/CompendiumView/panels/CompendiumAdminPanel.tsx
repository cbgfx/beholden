import React from "react";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconCompendiumAlt } from "@/icons";
import { theme } from "@/theme/theme";
import { api } from "@/services/api";

/**
 * Right sidebar tools for the Compendium view.
 * Extracted from CompendiumView (Stage 1) with no behavior/UI changes.
 */
interface ImportResult {
  imported: number;
  total: number;
  items?: number;
  classes?: number;
  races?: number;
  backgrounds?: number;
  feats?: number;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function CompendiumAdminPanel() {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");
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

  const importSummary = lastImport
    ? [
        { label: "Monsters", count: lastImport.imported },
        { label: "Items", count: lastImport.items ?? 0 },
        { label: "Classes", count: lastImport.classes ?? 0 },
        { label: "Species", count: lastImport.races ?? 0 },
        { label: "Backgrounds", count: lastImport.backgrounds ?? 0 },
        { label: "Feats", count: lastImport.feats ?? 0 },
      ].filter((entry) => entry.count > 0)
    : [];

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
        <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>
          Upload a compendium XML. The server stores it in a local database. Re-importing an entry with the same name (case-insensitive, ignoring trailing
          <code>[...]</code>) will replace the existing entry.
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ color: theme.colors.text }}
          />
          <Button onClick={uploadCompendium} disabled={!file || busy}>
            {busy ? "Importing..." : "Import XML"}
          </Button>
          <Button variant="ghost" onClick={deleteCompendium} disabled={busy}>
            Delete Compendium
          </Button>
        </div>

        {msg ? (
          <div style={{ marginTop: 12, color: msg.toLowerCase().includes("fail") ? theme.colors.red : theme.colors.text }}>{msg}</div>
        ) : null}

        {importSummary.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px 14px", color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            {importSummary.map((entry) => <span key={entry.label}>{entry.label}: {entry.count}</span>)}
          </div>
        )}
      </Panel>
    </div>
  );
}
