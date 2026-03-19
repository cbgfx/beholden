import React, { useRef, useState } from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconPencil, IconTrash, IconDownload, IconCamera, IconUsers } from "@/icons";
import { api } from "@/services/api";

export type CampaignSummary = {
  id: string;
  name: string;
  updatedAt?: number;
  playerCount?: number;
  imageUrl?: string | null;
};

type Props = {
  campaign: CampaignSummary;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => Promise<void> | void;
};

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

export function CampaignCard({ campaign: c, onOpen, onEdit, onDelete, onRefresh }: Props) {
  const [hovered, setHovered] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const initials = c.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const hasImage = Boolean(c.imageUrl);

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("image", file);
      await api<unknown>(`/api/campaigns/${c.id}/image`, { method: "POST", body: fd });
      await onRefresh();
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  }

  async function handleRemoveImage(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api<unknown>(`/api/campaigns/${c.id}/image`, { method: "DELETE" });
    } catch (err) {
      console.error("Image delete failed:", err);
    }
    await onRefresh();
  }

  function exportCampaign() {
    window.location.href = `/api/campaigns/${c.id}/export`;
  }

  return (
    <div style={card}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleImageSelected}
        style={{ display: "none" }}
      />

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
        onClick={() => imageInputRef.current?.click()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        title="Click to set banner image"
      >
        {hasImage && (
          <img
            src={`${c.imageUrl}?v=${c.updatedAt ?? 0}`}
            alt=""
            style={{
              position: "absolute",
              top: 0, left: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              display: "block",
              opacity: hovered ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          />
        )}

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

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)",
            fontSize: 13,
            fontWeight: 600,
            transition: "color 0.15s",
            pointerEvents: "none",
          }}
        >
          <IconCamera size={20} />
          {hovered ? (hasImage ? "Change image" : "Add image") : null}
        </div>

        {hasImage && hovered && (
          <button
            onClick={handleRemoveImage}
            title="Remove banner image"
            style={{
              position: "absolute",
              top: 10, right: 10,
              width: 28, height: 28,
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
        <div style={{ fontSize: 20, fontWeight: 800, color: theme.colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: -0.3 }}>
          {c.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {c.playerCount !== undefined && (
            <div style={{ fontSize: 14, color: theme.colors.muted, display: "flex", alignItems: "center", gap: 6 }}>
              <IconUsers size={14} />
              {c.playerCount === 1 ? "1 Player" : `${c.playerCount} Players`}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: "rgba(160,180,220,0.45)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.id}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={cardFooter}>
        <Button onClick={onOpen} title="Open campaign" style={{ flex: 1, minWidth: 0 }}>
          Open
        </Button>
        <button onClick={exportCampaign} style={iconBtn} title="Export campaign JSON" aria-label="Export campaign">
          <IconDownload size={17} />
        </button>
        <button onClick={onEdit} style={iconBtn} title="Rename campaign" aria-label="Edit campaign">
          <IconPencil size={16} />
        </button>
        <button onClick={onDelete} style={iconBtnDanger} title="Delete campaign" aria-label="Delete campaign">
          <IconTrash size={16} />
        </button>
      </div>
    </div>
  );
}
