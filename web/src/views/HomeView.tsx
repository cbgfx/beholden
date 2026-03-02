import React, { useMemo, useState } from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconPencil, IconTrash, IconPlus } from "@/icons";

type CampaignSummary = {
  id: string;
  name: string;
};

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
    return [...campaigns].sort((a, b) => a.name.localeCompare(b.name));
  }, [campaigns]);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");

  async function importCampaign() {
    if (!importFile) return;
    setImportBusy(true);
    setImportMsg("");
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/campaigns/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Import failed");
      setImportMsg("Campaign imported.");
      setImportFile(null);
      await onRefresh();
    } catch (e: unknown) {
      setImportMsg(String((e as any)?.message ?? e));
    } finally {
      setImportBusy(false);
    }
  }

  function exportCampaign(id: string) {
    if (!id) return;
    window.location.href = `/api/campaigns/${id}/export`;
  }

  const page: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    padding: 28,
    gap: 14,
  };

  const titleWrap: React.CSSProperties = {
    width: 900,
    maxWidth: "100%",
  };

  const h1: React.CSSProperties = { fontSize: 24, fontWeight: 900, margin: 0, color: theme.colors.text };
  const sub: React.CSSProperties = { marginTop: 6, color: theme.colors.muted };

  const rail: React.CSSProperties = {
    width: 900,
    maxWidth: "100%",
    display: "flex",
    gap: 14,
    overflowX: "auto",
    paddingBottom: 10,
    scrollSnapType: "x mandatory",
  };

  const cardBase: React.CSSProperties = {
    flex: "0 0 260px",
    minHeight: 220,
    background: theme.colors.panelBg,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.panel,
    padding: 14,
    boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
    scrollSnapAlign: "start",
    display: "grid",
    gap: 10,
  };

  const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 900, color: theme.colors.text };

  const iconBtn: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: theme.colors.panelBg,
    color: theme.colors.text,
    display: "inline-grid",
    placeItems: "center",
    cursor: "pointer",
  };

  return (
    <div style={page}>
      <div style={titleWrap}>
        <div style={h1}>Campaigns</div>
        <div style={sub}>Create a new campaign, import one, or jump back into an existing world.</div>
      </div>

      <div style={rail}>
        {/* Create / Import card */}
        <div style={cardBase}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={cardTitle}>Create / Import</div>
          </div>

          <div style={{ color: theme.colors.muted, lineHeight: 1.35, fontSize: 13 }}>
            Campaigns are stored as separate JSON files on disk for smaller saves and easy backups.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Button onClick={onCreateCampaign} title="Create campaign">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <IconPlus />
                Campaign
              </span>
            </Button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              style={{ color: theme.colors.text }}
            />

            <Button onClick={importCampaign} disabled={!importFile || importBusy} title="Import campaign">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {importBusy ? "Importing…" : "Import"}
              </span>
            </Button>

            {importMsg ? (
              <div style={{ fontSize: 12, color: importMsg.toLowerCase().includes("fail") ? theme.colors.red : theme.colors.muted }}>
                {importMsg}
              </div>
            ) : null}
          </div>
        </div>

        {/* Campaign cards */}
        {sorted.map((c) => (
          <div key={c.id} style={cardBase}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={cardTitle}>{c.name}</div>
                <div style={{ fontSize: 11, color: theme.colors.muted, wordBreak: "break-all" }}>Campaign ID: {c.id}</div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => onEditCampaign(c.id)} style={iconBtn} title="Edit campaign" aria-label="Edit campaign">
                  <IconPencil />
                </button>
                <button onClick={() => onDeleteCampaign(c.id)} style={iconBtn} title="Delete campaign" aria-label="Delete campaign">
                  <IconTrash />
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
              <Button onClick={() => onOpenCampaign(c.id)} title="Open campaign">
                Open
              </Button>

              <Button onClick={() => exportCampaign(c.id)} title="Export campaign JSON">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Export
                </span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
