import React from "react";

import { IconCompendiumAlt } from "@/icons";
import { api, apiBlob } from "@/services/api";
import { Panel } from "@/ui/Panel";
import {
  CompendiumAdminFeedback,
  LegacyCompendiumActions,
  LegacyCompendiumDescription,
  NativeCompendiumActions,
  NativeCompendiumDescription,
  NativeImportPreview,
  type NativeCompendiumCategory,
  type NativeImportResult,
  type NativePreviewResult,
} from "./CompendiumAdminSections";

type NativeBatch = {
  format: "beholden.compendium";
  version: 2;
  category: NativeCompendiumCategory;
  exportedAt: string;
  entries: Array<Record<string, unknown>>;
};

type NativeBundle = {
  format: "beholden.compendium";
  version: 2;
  exportedAt: string;
  batches: Array<{
    category: NativeCompendiumCategory;
    entries: Array<Record<string, unknown>>;
  }>;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
}

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

function convertedJsonFilename(sourceFilename: string): string {
  const base = sourceFilename.replace(/\.xml$/iu, "");
  return `${base || "beholden-compendium"}.json`;
}

export function CompendiumAdminPanel() {
  const [legacyFile, setLegacyFile] = React.useState<File | null>(null);
  const [nativeFile, setNativeFile] = React.useState<File | null>(null);
  const [previewedNativeFile, setPreviewedNativeFile] = React.useState<File | null>(null);
  const [nativePreview, setNativePreview] = React.useState<NativePreviewResult | null>(null);
  const [nativeCategory, setNativeCategory] = React.useState<NativeCompendiumCategory>("monsters");
  const [busy, setBusy] = React.useState(false);
  const [nativeMsg, setNativeMsg] = React.useState("");
  const [legacyMsg, setLegacyMsg] = React.useState("");
  async function exportNativeCategory() {
    setBusy(true);
    setNativeMsg("");
    try {
      const batch = await api<NativeBatch>(
        `/api/compendium/native/${encodeURIComponent(nativeCategory)}/export`,
      );
      downloadJson(`beholden-compendium-${nativeCategory}.json`, batch);
      setNativeMsg(`Exported ${batch.entries.length} ${nativeCategory}.`);
    } catch (error: unknown) {
      setNativeMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function exportAllNativeCategories() {
    setBusy(true);
    setNativeMsg("");
    try {
      const archive = await apiBlob("/api/compendium/native/export-all.zip");
      downloadBlob("beholden-compendium-all.zip", archive);
      setNativeMsg("Exported all 9 compendium categories.");
    } catch (error: unknown) {
      setNativeMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function importNative() {
    if (!nativeFile || previewedNativeFile !== nativeFile) return;
    setBusy(true);
    setNativeMsg("");
    try {
      const form = new FormData();
      form.append("file", nativeFile);
      const result = await api<NativeImportResult>("/api/compendium/native/import", {
        method: "POST",
        body: form,
      });
      setNativeMsg(
        `Imported ${result.imported} entries across ${result.batches.length} ${result.batches.length === 1 ? "batch" : "batches"}.`,
      );
      setPreviewedNativeFile(null);
      setNativePreview(null);
      if (result.batches.length === 1 && result.batches[0]) {
        setNativeCategory(result.batches[0].category);
      }
      await api<unknown>("/api/meta");
    } catch (error: unknown) {
      setNativeMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function previewNativeImport() {
    if (!nativeFile) return;
    setBusy(true);
    setNativeMsg("");
    setPreviewedNativeFile(null);
    setNativePreview(null);
    try {
      const form = new FormData();
      form.append("file", nativeFile);
      const preview = await api<NativePreviewResult>("/api/compendium/native/preview", {
        method: "POST",
        body: form,
      });
      setNativePreview(preview);
      setPreviewedNativeFile(nativeFile);
    } catch (error: unknown) {
      setNativeMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function convertLegacyXml() {
    if (!legacyFile) return;
    setBusy(true);
    setLegacyMsg("");
    try {
      const form = new FormData();
      form.append("file", legacyFile);
      const result = await api<{ ok: boolean; document: NativeBundle; warnings: string[] }>(
        "/api/compendium/convert/xml",
        { method: "POST", body: form },
      );
      downloadJson(convertedJsonFilename(legacyFile.name), result.document);
      const entries = result.document.batches.reduce((total, batch) => total + batch.entries.length, 0);
      const summary = `Converted ${entries} entries across ${result.document.batches.length} categories. The live compendium was not changed.`;
      setLegacyMsg(
        result.warnings.length > 0
          ? `${summary}\n\nWarnings (${result.warnings.length}):\n${result.warnings.join("\n")}`
          : summary,
      );
    } catch (error: unknown) {
      setLegacyMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCompendium() {
    setBusy(true);
    setNativeMsg("");
    try {
      await api<unknown>("/api/compendium", { method: "DELETE" });
      setNativeMsg("Compendium deleted.");
      await api<unknown>("/api/meta");
    } catch (error: unknown) {
      setNativeMsg(toErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0, minHeight: 0, overflow: "auto" }}>
      <Panel
        storageKey="compendium-admin-native"
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
            <IconCompendiumAlt size={36} title="Compendium" />
            <span>Beholden Compendium</span>
          </span>
        }
      >
        <NativeCompendiumDescription />
        <NativeCompendiumActions
          busy={busy}
          category={nativeCategory}
          fileName={nativeFile?.name ?? null}
          previewReady={previewedNativeFile === nativeFile}
          onCategoryChange={setNativeCategory}
          onFileChange={(file) => {
            setNativeFile(file);
            setPreviewedNativeFile(null);
            setNativePreview(null);
            setNativeMsg("");
          }}
          onExport={() => void exportNativeCategory()}
          onExportAll={() => void exportAllNativeCategories()}
          onPreview={() => void previewNativeImport()}
          onImport={() => void importNative()}
          onDelete={() => void deleteCompendium()}
        />
        {nativePreview ? <NativeImportPreview preview={nativePreview} /> : null}
        <CompendiumAdminFeedback msg={nativeMsg} />
      </Panel>

      <Panel storageKey="compendium-admin-legacy" title="Legacy XML converter">
        <LegacyCompendiumDescription />
        <LegacyCompendiumActions
          busy={busy}
          fileSelected={!!legacyFile}
          onFileChange={setLegacyFile}
          onConvert={() => void convertLegacyXml()}
        />
        <CompendiumAdminFeedback msg={legacyMsg} />
      </Panel>
    </div>
  );
}
