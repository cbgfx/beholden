import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { accentButtonStyle, ghostButtonStyle } from "@beholden/shared/ui";
import type { Campaign, UserCharacter } from "./PlayerHomeUtils";

export function CampaignCard({ campaign: c, characters, onOpen }: {
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
