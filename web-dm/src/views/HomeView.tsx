import React, { useMemo, useRef, useState } from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconPlus } from "@/icons";
import { api } from "@/services/api";
import { CampaignCard } from "@/views/HomeView/CampaignCard";
import type { CampaignSummary } from "@/views/HomeView/CampaignCard";

type Props = {
  campaigns: CampaignSummary[];
  onCreateCampaign: () => void;
  onOpenCampaign: (campaignId: string) => void;
  onEditCampaign: (campaignId: string) => void;
  onDeleteCampaign: (campaignId: string) => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
};

export function HomeView({
  campaigns,
  onCreateCampaign,
  onOpenCampaign,
  onEditCampaign,
  onDeleteCampaign,
  onRefresh,
}: Props) {
  const sorted = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const ta = a.updatedAt ?? 0;
      const tb = b.updatedAt ?? 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });
  }, [campaigns]);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function importCampaign() {
    if (!importFile) return;
    setImportBusy(true);
    setImportMsg("");
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      await api<unknown>("/api/campaigns/import", { method: "POST", body: fd });
      setImportMsg("Campaign imported.");
      setImportFile(null);
      await onRefresh();
    } catch (e: unknown) {
      setImportMsg(String((e as any)?.message ?? e));
    } finally {
      setImportBusy(false);
    }
  }

  const msgColor = importMsg.toLowerCase().includes("fail") || importMsg.toLowerCase().includes("error")
    ? theme.colors.red
    : theme.colors.muted;

  return (
    <div style={{ width: "100%", minHeight: "100%", display: "grid", justifyItems: "center", alignContent: "start", padding: "36px 28px 60px", gap: 32 }}>
      <div style={{ width: "100%", maxWidth: 1040, display: "grid", gap: 28 }}>

        {/* Header */}
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, margin: 0, color: theme.colors.text }}>
            Campaigns&nbsp;
            {campaigns.length > 0 && (
              <span style={{ color: theme.colors.muted }}>({campaigns.length})</span>
            )}
          </div>
          <div style={{ marginTop: 6, color: theme.colors.muted, fontSize: 15 }}>
            Jump back into an existing world, or start a new one.
          </div>
        </div>

        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={onCreateCampaign} title="Create a new campaign">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <IconPlus size={14} />
              New Campaign
            </span>
          </Button>

          <div style={{ width: 1, height: 24, background: theme.colors.panelBorder, margin: "0 4px" }} />

          <label
            style={{
              padding: "7px 14px",
              borderRadius: theme.radius.control,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: theme.colors.inputBg,
              color: importFile ? theme.colors.text : theme.colors.muted,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxWidth: 200,
              textOverflow: "ellipsis",
              display: "block",
            }}
            title={importFile ? importFile.name : "Choose a campaign JSON file"}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            {importFile ? importFile.name : "Choose file…"}
          </label>

          <Button variant="ghost" onClick={importCampaign} disabled={!importFile || importBusy} title="Import selected campaign file">
            {importBusy ? "Importing…" : "Import"}
          </Button>

          {importMsg ? <span style={{ fontSize: 12, color: msgColor }}>{importMsg}</span> : null}
        </div>

        {/* Campaign grid */}
        {sorted.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 20 }}>
            {sorted.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                onOpen={() => onOpenCampaign(c.id)}
                onEdit={() => onEditCampaign(c.id)}
                onDelete={() => onDeleteCampaign(c.id)}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: theme.colors.muted, fontSize: 15, padding: "48px 0", textAlign: "center" }}>
            No campaigns yet — create one above to get started.
          </div>
        )}
      </div>
    </div>
  );
}
