import React, { useMemo, useRef, useState } from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconPencil, IconTrash, IconPlus, IconDownload, IconCamera, IconUsers } from "@/icons";

type CampaignSummary = {
  id: string;
  name: string;
  updatedAt?: number;
  playerCount?: number;
  imageUrl?: string | null;
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

  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [hoveredBannerId, setHoveredBannerId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  function handleBannerClick(campaignId: string) {
    setUploadTargetId(campaignId);
    imageInputRef.current?.click();
  }

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const targetId = uploadTargetId;
    e.target.value = "";
    setUploadTargetId(null);
    if (!file || !targetId) return;
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`/api/campaigns/${targetId}/image`, { method: "POST", body: fd });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as any)?.message ?? "Upload failed");
      }
      await onRefresh();
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  }

  async function handleRemoveImage(campaignId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/campaigns/${campaignId}/image`, { method: "DELETE" });
    await onRefresh();
  }

  // ── Layout ──────────────────────────────────────────────────────────
  const page: React.CSSProperties = {
    width: "100%",
    minHeight: "100%",
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    padding: "36px 28px 60px",
    gap: 32,
  };

  const inner: React.CSSProperties = {
    width: "100%",
    maxWidth: 1040,
    display: "grid",
    gap: 28,
  };

  const h1: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 900,
    margin: 0,
    color: theme.colors.text,
  };

  const sub: React.CSSProperties = {
    marginTop: 6,
    color: theme.colors.muted,
    fontSize: 15,
  };

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
  };

  const msgColor = importMsg.toLowerCase().includes("fail") || importMsg.toLowerCase().includes("error")
    ? theme.colors.red
    : theme.colors.muted;

  // ── Campaign grid ────────────────────────────────────────────────────
  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
    gap: 20,
  };

  // ── Campaign card ────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: theme.colors.panelBg,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.panel,
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "170px 1fr auto",
    boxShadow: "0 4px 28px rgba(0,0,0,0.4)",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };

  const cardBody: React.CSSProperties = {
    padding: "16px 18px 10px",
    display: "grid",
    gap: 8,
  };

  const cardTitle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 800,
    color: theme.colors.text,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    letterSpacing: -0.3,
  };

  const cardMeta: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  };

  const cardPlayerCount: React.CSSProperties = {
    fontSize: 14,
    color: theme.colors.muted,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };

  const cardId: React.CSSProperties = {
    fontSize: 11,
    color: "rgba(160,180,220,0.45)",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const cardFooter: React.CSSProperties = {
    padding: "0 12px 12px",
    display: "flex",
    gap: 8,
    alignItems: "center",
  };

  const iconBtn: React.CSSProperties = {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 9,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: "rgba(255,255,255,0.07)",
    color: theme.colors.text,
    display: "inline-grid",
    placeItems: "center",
    cursor: "pointer",
    transition: "background 0.12s, border-color 0.12s",
  };

  const iconBtnDanger: React.CSSProperties = {
    ...iconBtn,
    color: theme.colors.red,
    background: "rgba(255,93,93,0.1)",
    borderColor: "rgba(255,93,93,0.35)",
  };

  return (
    <div style={page}>
      {/* Hidden file input for image uploads */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleImageSelected}
        style={{ display: "none" }}
      />

      <div style={inner}>
        {/* Header */}
        <div>
          <div style={h1}>
            Campaigns
            {campaigns.length > 0 && (
              <span style={{ marginLeft: 10, fontSize: "0.6em", fontWeight: 600, color: theme.colors.muted, verticalAlign: "middle" }}>
                ({campaigns.length})
              </span>
            )}
          </div>
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

              const isHovered = hoveredBannerId === c.id;
              const hasImage = Boolean(c.imageUrl);

              return (
                <div key={c.id} style={card}>
                  {/* ── Banner ── */}
                  <div
                    style={{
                      position: "relative",
                      height: 170,
                      overflow: "hidden",
                      borderBottom: `1px solid ${theme.colors.panelBorder}`,
                      cursor: "pointer",
                      background: hasImage
                        ? "#000"
                        : "linear-gradient(135deg, rgba(240,165,0,0.20) 0%, rgba(240,165,0,0.05) 100%)",
                    }}
                    onClick={() => handleBannerClick(c.id)}
                    onMouseEnter={() => setHoveredBannerId(c.id)}
                    onMouseLeave={() => setHoveredBannerId(null)}
                    title="Click to set banner image"
                  >
                    {/* Background image */}
                    {hasImage && (
                      <img
                        src={`${c.imageUrl}?v=${c.updatedAt ?? 0}`}
                        alt=""
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                          opacity: isHovered ? 0.7 : 1,
                          transition: "opacity 0.15s",
                        }}
                      />
                    )}

                    {/* Initials watermark — no-image fallback */}
                    {!hasImage && (
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 52,
                          fontWeight: 900,
                          color: "rgba(240,165,0,0.22)",
                          letterSpacing: 4,
                          userSelect: "none",
                        }}
                      >
                        {initials}
                      </span>
                    )}

                    {/* Camera overlay — always subtly visible, strong on hover */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        color: isHovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)",
                        fontSize: 13,
                        fontWeight: 600,
                        transition: "color 0.15s",
                        pointerEvents: "none",
                      }}
                    >
                      <IconCamera size={20} />
                      {isHovered ? (hasImage ? "Change image" : "Add image") : null}
                    </div>

                    {/* Remove image button (top-right corner when hovered) */}
                    {hasImage && isHovered && (
                      <button
                        onClick={(e) => handleRemoveImage(c.id, e)}
                        title="Remove banner image"
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          border: "1px solid rgba(255,93,93,0.55)",
                          background: "rgba(0,0,0,0.7)",
                          color: theme.colors.red,
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                          fontSize: 18,
                          lineHeight: 1,
                          zIndex: 10,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* ── Body ── */}
                  <div style={cardBody}>
                    <div style={cardTitle}>{c.name}</div>
                    <div style={cardMeta}>
                      {c.playerCount !== undefined && (
                        <div style={cardPlayerCount}>
                          <IconUsers size={14} />
                          {c.playerCount === 1 ? "1 Player" : `${c.playerCount} Players`}
                        </div>
                      )}
                    </div>
                    <div style={cardId}>{c.id}</div>
                  </div>

                  {/* ── Footer ── */}
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
                      <IconDownload size={17} />
                    </button>

                    <button
                      onClick={() => onEditCampaign(c.id)}
                      style={iconBtn}
                      title="Rename campaign"
                      aria-label="Edit campaign"
                    >
                      <IconPencil size={16} />
                    </button>

                    <button
                      onClick={() => onDeleteCampaign(c.id)}
                      style={iconBtnDanger}
                      title="Delete campaign"
                      aria-label="Delete campaign"
                    >
                      <IconTrash size={16} />
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
              fontSize: 15,
              padding: "48px 0",
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
