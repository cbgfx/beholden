import React, { useMemo, useRef, useState } from "react";
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

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── Layout ──────────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    width: "100%",
    minHeight: "100%",
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    padding: "32px 24px 60px",
    gap: 28,
  };

  const inner: React.CSSProperties = {
    width: "100%",
    maxWidth: 960,
    display: "grid",
    gap: 24,
  };

  const h1: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 900,
    margin: 0,
    color: theme.colors.text,
  };

  const sub: React.CSSProperties = {
    marginTop: 6,
    color: theme.colors.muted,
    fontSize: 14,
  };

  // ── Action bar ───────────────────────────────────────────────────────
  const actionBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  };

  const divider: React.CSSProperties = {
    width: 1,
    height: 24,
    background: theme.colors.panelBorder,
    margin: "0 4px",
  };

  const fileLabel: React.CSSProperties = {
    padding: "7px 12px",
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
  };

  const msgColor = importMsg.toLowerCase().includes("fail") || importMsg.toLowerCase().includes("error")
    ? theme.colors.red
    : theme.colors.muted;

  // ── Campaign grid ────────────────────────────────────────────────────
  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  };

  // ── Campaign card ────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: theme.colors.panelBg,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.panel,
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "72px 1fr auto",
    boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
    transition: "border-color 0.15s",
  };

  const cardBanner: React.CSSProperties = {
    background: "linear-gradient(135deg, rgba(240,165,0,0.18) 0%, rgba(240,165,0,0.04) 100%)",
    borderBottom: `1px solid ${theme.colors.panelBorder}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  };

  const cardBody: React.CSSProperties = {
    padding: "12px 14px 8px",
    display: "grid",
    gap: 3,
  };

  const cardTitle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 800,
    color: theme.colors.text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const cardId: React.CSSProperties = {
    fontSize: 11,
    color: theme.colors.muted,
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const cardFooter: React.CSSProperties = {
    padding: "0 10px 10px",
    display: "flex",
    gap: 6,
    alignItems: "center",
  };

  const iconBtn: React.CSSProperties = {
    width: 32,
    height: 32,
    flexShrink: 0,
    borderRadius: 8,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: "transparent",
    color: theme.colors.muted,
    display: "inline-grid",
    placeItems: "center",
    cursor: "pointer",
    transition: "color 0.12s, border-color 0.12s",
  };

  const iconBtnDanger: React.CSSProperties = {
    ...iconBtn,
    color: theme.colors.red,
    borderColor: "rgba(255,93,93,0.25)",
  };

  return (
    <div style={page}>
      <div style={inner}>
        {/* Header */}
        <div>
          <div style={h1}>Campaigns</div>
          <div style={sub}>Jump back into an existing world, or start a new one.</div>
        </div>

        {/* Action bar */}
        <div style={actionBar}>
          <Button onClick={onCreateCampaign} title="Create a new campaign">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <IconPlus size={14} />
              New Campaign
            </span>
          </Button>

          <div style={divider} />

          <label
            style={fileLabel}
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

          <Button
            variant="ghost"
            onClick={importCampaign}
            disabled={!importFile || importBusy}
            title="Import selected campaign file"
          >
            {importBusy ? "Importing…" : "Import"}
          </Button>

          {importMsg ? (
            <span style={{ fontSize: 12, color: msgColor }}>{importMsg}</span>
          ) : null}
        </div>

        {/* Campaign grid */}
        {sorted.length > 0 ? (
          <div style={grid}>
            {sorted.map((c) => {
              const initials = c.name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0] ?? "")
                .join("")
                .toUpperCase();

              return (
                <div key={c.id} style={card}>
                  {/* Banner */}
                  <div style={cardBanner}>
                    <span
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: "rgba(240,165,0,0.35)",
                        letterSpacing: 2,
                        userSelect: "none",
                      }}
                    >
                      {initials}
                    </span>
                  </div>

                  {/* Body */}
                  <div style={cardBody}>
                    <div style={cardTitle}>{c.name}</div>
                    <div style={cardId}>{c.id}</div>
                  </div>

                  {/* Footer */}
                  <div style={cardFooter}>
                    <Button
                      onClick={() => onOpenCampaign(c.id)}
                      title="Open campaign"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      Open
                    </Button>

                    <button
                      onClick={() => exportCampaign(c.id)}
                      style={iconBtn}
                      title="Export campaign JSON"
                      aria-label="Export campaign"
                    >
                      <IconDownload />
                    </button>

                    <button
                      onClick={() => onEditCampaign(c.id)}
                      style={iconBtn}
                      title="Rename campaign"
                      aria-label="Edit campaign"
                    >
                      <IconPencil size={14} />
                    </button>

                    <button
                      onClick={() => onDeleteCampaign(c.id)}
                      style={iconBtnDanger}
                      title="Delete campaign"
                      aria-label="Delete campaign"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              color: theme.colors.muted,
              fontSize: 14,
              padding: "40px 0",
              textAlign: "center",
            }}
          >
            No campaigns yet — create one above to get started.
          </div>
        )}
      </div>
    </div>
  );
}
