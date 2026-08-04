// web-dm/src/views/AdminView/DatabaseAdminPanel.tsx
// Admin panel for exporting and importing a full beholden.db snapshot.

import { useRef, useState, type CSSProperties } from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/confirm/ConfirmContext";
import { exportDatabase, importDatabase, type DatabaseImportResult } from "@/services/databaseAdminApi";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const sectionStyle: CSSProperties = {
  border: `1px solid ${theme.colors.panelBorder}`,
  borderRadius: theme.radius.panel,
  background: theme.colors.panelBg,
  padding: 20,
  display: "grid",
  gap: 12,
};

export function DatabaseAdminPanel() {
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<DatabaseImportResult | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError("");
    try {
      const blob = await exportDatabase();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(`beholden-${stamp}.zip`, blob);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!selectedFile || !acknowledged || importing) return;
    if (!(await confirm({
      title: "Replace the entire database?",
      message: `This permanently replaces every user, campaign, character, and Binder in this Beholden install with the contents of "${selectedFile.name}". A backup of the current database is saved on the server first, but this cannot be undone from within the app. Continue?`,
      confirmLabel: "Replace Database",
      intent: "danger",
    }))) return;

    setImporting(true);
    setImportError("");
    setImportResult(null);
    try {
      const result = await importDatabase(selectedFile);
      setImportResult(result);
      setSelectedFile(null);
      setAcknowledged(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      // The server broadcasts database:imported over the websocket, which triggers
      // a hard reload on every connected client (including this one) momentarily.
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "var(--fs-title)", fontWeight: 700 }}>Database</h2>
        <p style={{ margin: 0, fontSize: "var(--fs-subtitle)", color: theme.colors.muted }}>
          Export a full snapshot of beholden.db, or restore one that was exported earlier.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={sectionStyle}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "var(--fs-medium)", fontWeight: 700 }}>Export</h3>
            <p style={{ margin: 0, fontSize: "var(--fs-subtitle)", color: theme.colors.muted }}>
              Downloads a consistent snapshot of the entire database — every user, campaign, Binder, and compendium row —
              bundled as a zip together with every campaign, Binder, character, and player image on disk.
            </p>
          </div>
          {exportError ? <div style={{ color: theme.colors.colorPinkRed, fontSize: "var(--fs-subtitle)" }}>{exportError}</div> : null}
          <div>
            <Button onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "Exporting…" : "Export Database"}
            </Button>
          </div>
        </div>

        <div style={{ ...sectionStyle, borderColor: withAlpha(theme.colors.red, 0.35) }}>
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: "var(--fs-medium)", fontWeight: 700 }}>Import</h3>
            <p style={{ margin: 0, fontSize: "var(--fs-subtitle)", color: theme.colors.muted }}>
              Replaces every row in this database with the contents of an uploaded <code>.zip</code> export (images included)
              or a plain <code>.db</code> file (an older export, database only). A backup of the current database is saved on
              the server automatically before the swap. Every connected user will be reloaded once this completes.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.zip"
            disabled={importing}
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setImportError("");
              setImportResult(null);
            }}
          />

          {selectedFile ? (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "var(--fs-subtitle)", color: theme.colors.text, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={importing}
                style={{ marginTop: 3 }}
              />
              <span>I understand this permanently replaces all data in this Beholden install with the contents of &ldquo;{selectedFile.name}&rdquo;.</span>
            </label>
          ) : null}

          {importError ? <div style={{ color: theme.colors.colorPinkRed, fontSize: "var(--fs-subtitle)" }}>{importError}</div> : null}
          {importResult ? (
            <div style={{ color: theme.colors.text, fontSize: "var(--fs-subtitle)" }}>
              Imported {importResult.rowsImported} rows across {importResult.tablesReplaced} tables. Reloading…
            </div>
          ) : null}

          <div>
            <Button variant="danger" onClick={() => void handleImport()} disabled={!selectedFile || !acknowledged || importing}>
              {importing ? "Importing…" : "Replace Database"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
