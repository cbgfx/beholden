import React from "react";

import { Button } from "@/ui/Button";
import { theme } from "@/theme/theme";

export type ImportResult = {
  imported: number;
  total: number;
  items?: number;
  classes?: number;
  races?: number;
  backgrounds?: number;
  feats?: number;
  decks?: number;
  bastions?: number;
};

export function buildImportSummary(lastImport: ImportResult | null) {
  return lastImport
    ? [
        { label: "Monsters", count: lastImport.imported },
        { label: "Items", count: lastImport.items ?? 0 },
        { label: "Classes", count: lastImport.classes ?? 0 },
        { label: "Species", count: lastImport.races ?? 0 },
        { label: "Backgrounds", count: lastImport.backgrounds ?? 0 },
        { label: "Feats", count: lastImport.feats ?? 0 },
        { label: "Decks", count: lastImport.decks ?? 0 },
        { label: "Bastion Facilities", count: lastImport.bastions ?? 0 },
      ].filter((entry) => entry.count > 0)
    : [];
}

export function CompendiumAdminDescription() {
  return (
    <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>
      Upload a compendium XML. The server stores it in a local database. Re-importing an entry with the same name
      (case-insensitive, ignoring trailing <code>[...]</code>) will replace the existing entry.
    </div>
  );
}

export function CompendiumAdminActions(props: {
  busy: boolean;
  fileSelected: boolean;
  onFileChange: (file: File | null) => void;
  onUpload: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="file"
        accept=".xml,text/xml,application/xml"
        onChange={(e) => props.onFileChange(e.target.files?.[0] ?? null)}
        style={{ color: theme.colors.text }}
      />
      <Button onClick={props.onUpload} disabled={!props.fileSelected || props.busy}>
        {props.busy ? "Importing..." : "Import XML"}
      </Button>
      <Button variant="ghost" onClick={props.onDelete} disabled={props.busy}>
        Delete Compendium
      </Button>
    </div>
  );
}

export function CompendiumAdminFeedback(props: {
  msg: string;
  importSummary: Array<{ label: string; count: number }>;
}) {
  return (
    <>
      {props.msg ? (
        <div style={{ marginTop: 12, color: props.msg.toLowerCase().includes("fail") ? theme.colors.red : theme.colors.text }}>
          {props.msg}
        </div>
      ) : null}

      {props.importSummary.length > 0 ? (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px 14px", color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
          {props.importSummary.map((entry) => (
            <span key={entry.label}>
              {entry.label}: {entry.count}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
