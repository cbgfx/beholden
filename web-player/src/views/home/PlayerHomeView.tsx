import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { fetchMyCharacters } from "@/services/actorApi";
import { C } from "@/lib/theme";
import { IconPlayer } from "@/icons";
import { HealthBar, accentButtonStyle, ghostButtonStyle } from "@beholden/shared/ui";

const LS_KEY = "beholden:lastOpened";

function readLastOpened(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}
function touchLastOpened(id: string) {
  const map = readLastOpened();
  map[id] = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

interface Campaign {
  id: string;
  name: string;
  updatedAt: number;
  playerCount: number;
  imageUrl: string | null;
}

interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

interface UserCharacter {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  color: string | null;
  imageUrl: string | null;
  campaigns: CharacterCampaign[];
}

export function PlayerHomeView() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastOpened, setLastOpened] = useState<Record<string, number>>(readLastOpened);

  function reload() {
    return Promise.all([
      api<Campaign[]>("/api/me/campaigns"),
      fetchMyCharacters(),
    ]).then(([camps, chars]) => {
      setCampaigns(camps);
      setCharacters(chars as UserCharacter[]);
    });
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCharacter(id: string) {
    touchLastOpened(id);
    setLastOpened(readLastOpened());
    navigate(`/characters/${id}`);
  }

  function openCampaign(id: string) {
    touchLastOpened(id);
    setLastOpened(readLastOpened());
    navigate(`/campaigns/${id}`);
  }

  const sortedCharacters = useMemo(() =>
    [...characters].sort((a, b) => (lastOpened[b.id] ?? 0) - (lastOpened[a.id] ?? 0)),
  [characters, lastOpened]);

  const sortedCampaigns = useMemo(() =>
    [...campaigns].sort((a, b) => (lastOpened[b.id] ?? 0) - (lastOpened[a.id] ?? 0)),
  [campaigns, lastOpened]);

  return (
    <div style={{ height: "100%", background: C.bg, color: C.text, overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── My Characters ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: "var(--fs-hero)", fontWeight: 800 }}>My Characters</h2>
          <button style={{ ...accentButtonStyle(C.colorGold, { textColor: C.textDark, borderColor: "transparent", padding: "8px 18px", fontSize: "var(--fs-subtitle)" }), background: C.colorGold }} onClick={() => navigate("/characters/new")}>
            + Create Character
          </button>
        </div>

        {loading && <p style={{ color: C.muted }}>Loading…</p>}
        {error && <p style={{ color: C.red }}>{error}</p>}

        {!loading && !error && characters.length === 0 && (
          <p style={{ color: C.muted, fontSize: "var(--fs-medium)" }}>No characters yet. Create one to get started.</p>
        )}

        {!loading && characters.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
            marginBottom: 40,
          }}>
            {sortedCharacters.map((ch) => (
              <CharacterRow key={ch.id} ch={ch} onOpen={openCharacter} onRefresh={reload} />
            ))}
          </div>
        )}

        {/* ── Your Campaigns ── */}
        {!loading && campaigns.length > 0 && (
          <>
            <h2 style={{ margin: "0 0 20px", fontSize: "var(--fs-hero)", fontWeight: 800 }}>Your Campaigns</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 18,
            }}>
              {sortedCampaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  characters={characters}
                  onOpen={openCampaign}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Character card ───────────────────────────────────────────────────────────

function CharacterRow({ ch, onOpen, onRefresh }: {
  ch: UserCharacter;
  onOpen: (id: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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
      await onRefresh();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); setConfirmDelete(false); }
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

// ── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign: c, characters, onOpen }: {
  campaign: Campaign;
  characters: UserCharacter[];
  onOpen: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [imgHovered, setImgHovered] = useState(false);

  const assignedChars = characters.filter((ch) =>
    ch.campaigns.some((cc) => cc.campaignId === c.id)
  );

  const initials = c.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      overflow: "hidden",
      display: "grid",
      gridTemplateRows: "160px 1fr auto",
      boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
    }}>
      {/* Banner */}
      <div
        style={{
          position: "relative", height: 160, overflow: "hidden",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: c.imageUrl ? "#000" : "linear-gradient(135deg,rgba(56,182,255,0.18) 0%,rgba(56,182,255,0.04) 100%)",
          cursor: "default",
        }}
        onMouseEnter={() => setImgHovered(true)}
        onMouseLeave={() => setImgHovered(false)}
      >
        {c.imageUrl
          ? <img src={`${c.imageUrl}?v=${c.updatedAt}`} alt="" style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%", objectFit: "cover", display: "block",
              opacity: imgHovered ? 0.85 : 1, transition: "opacity 0.15s",
            }} />
          : <span style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 52, fontWeight: 900,
              color: "rgba(56,182,255,0.18)", letterSpacing: 4, userSelect: "none",
            }}>{initials}</span>
        }
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: "var(--fs-title)", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.name}
        </div>
        <div style={{ fontSize: "var(--fs-subtitle)", color: C.muted }}>
          {c.playerCount} player{c.playerCount !== 1 ? "s" : ""}
        </div>

        {/* Assigned characters */}
        {assignedChars.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
            {assignedChars.map((ch) => (
              <span key={ch.id} style={{
                fontSize: "var(--fs-small)", padding: "2px 8px", borderRadius: 20,
                background: `${ch.color ?? C.accentHl}22`,
                border: `1px solid ${ch.color ?? C.accentHl}55`,
                color: ch.color ?? C.accentHl, fontWeight: 600,
              }}>
                {ch.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "0 12px 14px", display: "flex", gap: 8 }}>
        <button
          style={{ ...accentButtonStyle(C.colorGold, { textColor: C.textDark, borderColor: "transparent", padding: "8px 18px", fontSize: "var(--fs-subtitle)" }), background: C.colorGold, flex: 1 }}
          onClick={() => onOpen(c.id)}
        >
          Open
        </button>
        <button
          style={{ ...ghostButtonStyle({ textColor: C.colorGold, borderColor: "rgba(251,191,36,0.35)", padding: "6px 14px", fontSize: "var(--fs-small)", borderRadius: 7 }), flexShrink: 0 }}
          onClick={() => navigate(`/characters/new?campaign=${c.id}`)}
        >
          + Assign
        </button>
      </div>
    </div>
  );
}

// ── Shared button styles ─────────────────────────────────────────────────────

