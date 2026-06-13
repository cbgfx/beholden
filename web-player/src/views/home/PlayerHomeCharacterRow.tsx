import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { fetchMyCharacter } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { IconDownload, IconPlayer } from "@/icons";
import type { FlatCharacterSheetDto } from "@beholden/shared/api";
import { HealthBar, ghostButtonStyle } from "@beholden/shared/ui";
import {
  CHARACTER_EXPORT_FORMAT,
  CHARACTER_EXPORT_VERSION,
  buildExportFilename,
  exportIconButtonStyle,
  normalizeCharacterTransfer,
  type UserCharacter,
} from "./PlayerHomeUtils";

export function CharacterRow({ ch, onOpen, onRefresh, onError }: {
  ch: UserCharacter;
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const color = ch.color ?? C.accentHl;
  const hpPct = ch.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((ch.hpCurrent / ch.hpMax) * 100))) : 0;
  const hpColor = hpPct <= 0 ? "#6b7280" : hpPct < 25 ? C.colorPinkRed : hpPct < 50 ? C.colorOrange : hpPct < 75 ? C.colorGold : "#4ade80";
  const hpLabel = hpPct <= 0 ? "Down" : hpPct < 25 ? "Critical" : hpPct < 50 ? "Bloodied" : hpPct < 75 ? "Bloody" : "Healthy";

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      await api(`/api/me/characters/${ch.id}/image`, { method: "POST", body: fd });
      await onRefresh();
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/api/me/characters/${ch.id}`, { method: "DELETE" });
      const raw = localStorage.getItem("beholden:lastCharacter");
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { id?: string };
          if (parsed?.id === ch.id) {
            localStorage.removeItem("beholden:lastCharacter");
            window.dispatchEvent(new Event("beholden:lastCharacter"));
          }
        } catch {}
      }
      await onRefresh();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const character = await fetchMyCharacter(ch.id);
      const normalizedCharacter = normalizeCharacterTransfer(character as unknown as Record<string, unknown>) as unknown as FlatCharacterSheetDto;
      const payload = {
        format: CHARACTER_EXPORT_FORMAT,
        version: CHARACTER_EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        character: normalizedCharacter,
      } satisfies { format: string; version: number; exportedAt: string; character: FlatCharacterSheetDto };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = buildExportFilename(ch.name);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      onError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${confirmDelete ? "rgba(248,113,113,0.35)" : `${color}33`}`,
      borderRadius: 14,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      transition: "border-color 0.15s",
    }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelected} style={{ display: "none" }} />

      {/* Top row: portrait + info + AC */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* Portrait */}
        <div
          onClick={() => fileRef.current?.click()}
          title="Click to change portrait"
          style={{
            width: 54, height: 54, borderRadius: 10, flexShrink: 0, cursor: "pointer",
            overflow: "hidden", position: "relative",
            background: `${color}22`, border: `2px solid ${color}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {ch.imageUrl
            ? <img src={ch.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <IconPlayer size={28} style={{ opacity: 0.4 }} />}
          {uploading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-tiny)", color: "#fff" }}>…</div>
          )}
        </div>

        {/* Info — clickable to open sheet */}
        <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpen(ch.id)}>
          <div style={{ fontSize: "var(--fs-body)", fontWeight: 800, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ch.name}
          </div>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 2 }}>
            {[ch.className, ch.species].filter(Boolean).join(" · ")}
          </div>
          <div style={{ fontSize: "var(--fs-small)", color, fontWeight: 700, marginTop: 1 }}>Level {ch.level}</div>
        </div>

        {/* AC badge */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 10px", flexShrink: 0,
        }}>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: C.text }}>{ch.ac}</span>
          <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 600 }}>AC</span>
        </div>
      </div>

      {/* HP bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: "var(--fs-small)", color: hpColor, fontWeight: 700 }}>{hpLabel}</span>
          <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>{ch.hpCurrent} / {ch.hpMax}</span>
        </div>
        <HealthBar
          current={ch.hpCurrent}
          max={ch.hpMax}
          height={6}
          radius={3}
          trackColor="rgba(255,255,255,0.08)"
          fillColor={hpColor}
          transition="width 0.4s ease"
        />
      </div>

      {/* Campaigns */}
      {ch.campaigns.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {ch.campaigns.map((c) => (
            <span key={c.id} style={{
              fontSize: "var(--fs-small)", padding: "2px 8px", borderRadius: 20, fontWeight: 600,
              background: `${color}18`, border: `1px solid ${color}44`, color,
            }}>
              {c.campaignName}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: "var(--fs-small)", color: C.colorPinkRed, flex: 1 }}>Delete this character?</span>
          <button disabled={deleting} onClick={handleDelete}
            style={{ ...ghostButtonStyle({ textColor: C.colorPinkRed, borderColor: "rgba(248,113,113,0.45)", padding: "6px 14px", fontSize: "var(--fs-small)", borderRadius: 7 }), flexShrink: 0 }}>
            {deleting ? "…" : "Yes, delete"}
          </button>
          <button onClick={() => setConfirmDelete(false)} style={{ ...ghostButtonStyle({ textColor: C.colorGold, borderColor: "rgba(251,191,36,0.35)", padding: "6px 14px", fontSize: "var(--fs-small)", borderRadius: 7 }), flexShrink: 0 }}>Cancel</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            style={{
              ...exportIconButtonStyle,
              opacity: exporting ? 0.45 : 1,
              cursor: exporting ? "not-allowed" : exportIconButtonStyle.cursor,
            }}
            onClick={() => void handleExport()}
            title="Export character"
            aria-label="Export character"
            disabled={exporting}
          >
            <IconDownload size={17} />
          </button>
          <button style={{ ...ghostButtonStyle({ textColor: C.colorGold, borderColor: "rgba(251,191,36,0.35)", padding: "6px 14px", fontSize: "var(--fs-small)", borderRadius: 7 }), flex: 1, flexShrink: 0 }} onClick={() => navigate(`/characters/${ch.id}/edit`)}>
            Edit
          </button>

          <button
            style={{ ...ghostButtonStyle({ textColor: "rgba(248,113,113,0.7)", borderColor: "rgba(248,113,113,0.25)", padding: "6px 14px", fontSize: "var(--fs-small)", borderRadius: 7 }), flex: 1, flexShrink: 0 }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
