import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import { IconPlayers } from "@/icons";
import { Select } from "@/ui/Select";
import { Button } from "@/ui/Button";
import type { Campaign, UserCharacter } from "./PlayerHomeUtils";

export function CampaignCard({ campaign: c, characters, onOpen, onAssigned }: {
  campaign: Campaign;
  characters: UserCharacter[];
  onOpen: (id: string) => void;
  onAssigned: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const accent = c.color ?? C.colorGold;

  const assignedChars = characters.filter((ch) =>
    ch.campaigns.some((cc) => cc.campaignId === c.id)
  );
  const unassignedChars = characters.filter((ch) =>
    !ch.campaigns.some((cc) => cc.campaignId === c.id)
  );

  async function handleAssign() {
    if (!selectedCharId) return;
    setAssigning(true);
    try {
      await api(`/api/me/characters/${selectedCharId}/assign`, jsonInit("POST", { campaignIds: [c.id] }));
      await onAssigned();
      setAssignOpen(false);
      setSelectedCharId("");
    } catch (err) {
      console.error(err);
    } finally {
      setAssigning(false);
    }
  }

  const initials = c.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
      background: `linear-gradient(155deg, color-mix(in srgb, ${accent} 5%, transparent) 0%, rgba(255,255,255,0.045) 45%, rgba(255,255,255,0.025) 100%)`,
      border: `1px solid ${isHovered ? `color-mix(in srgb, ${accent} 40%, transparent)` : "rgba(255,255,255,0.1)"}`,
      borderRadius: 12,
      overflow: "hidden",
      display: "grid",
      gridTemplateRows: "160px 1fr auto",
      transform: isHovered ? "translateY(-4px)" : "translateY(0)",
      boxShadow: isHovered
        ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 22px 52px rgba(0,0,0,0.46), 0 0 28px color-mix(in srgb, ${accent} 11%, transparent)`
        : "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 32px rgba(0,0,0,0.32), 0 3px 10px rgba(0,0,0,0.22)",
      transition: "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
    }}>
      {/* Banner */}
      <div
        style={{
          position: "relative", height: 160, overflow: "hidden",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: c.imageUrl ? "#000" : "linear-gradient(135deg,rgba(56,182,255,0.18) 0%,rgba(56,182,255,0.04) 100%)",
          cursor: "default",
        }}
      >
        {c.imageUrl
          ? <img src={c.imageUrl} alt="" style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%", objectFit: "cover", display: "block",
              opacity: isHovered ? 0.9 : 1,
              transform: isHovered ? "scale(1.025)" : "scale(1)",
              transition: "opacity 200ms ease, transform 260ms ease",
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
        <div style={{ fontSize: "var(--fs-subtitle)", color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>
          <IconPlayers size={16} />
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
      {assignOpen ? (
        <div style={{ padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {unassignedChars.length > 0 ? (
            <>
              <Select
                value={selectedCharId}
                onChange={(e) => setSelectedCharId(e.target.value)}
                style={{ width: "100%" }}
                autoFocus
              >
                <option value="">Choose a character…</option>
                {unassignedChars.map((ch) => (
                  <option key={ch.id} value={ch.id}>{ch.name}</option>
                ))}
              </Select>
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  variant="primary"
                  disabled={!selectedCharId || assigning}
                  style={{ flex: 1 }}
                  onClick={() => void handleAssign()}
                >
                  {assigning ? "Assigning…" : "Assign"}
                </Button>
                <Button
                  variant="ghost"
                  style={{ flexShrink: 0 }}
                  onClick={() => { setAssignOpen(false); setSelectedCharId(""); }}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>All your characters are already in this campaign.</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button
                  variant="ghost"
                  style={{ flex: 1 }}
                  onClick={() => navigate(`/characters/new?campaign=${c.id}`)}
                >
                  Create new character
                </Button>
                <Button
                  variant="ghost"
                  style={{ flexShrink: 0 }}
                  onClick={() => setAssignOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{ padding: "0 12px 14px", display: "flex", gap: 8 }}>
          <Button
            variant="primary"
            style={{ flex: 1 }}
            onClick={() => onOpen(c.id)}
          >
            Open
          </Button>
          <Button
            variant="ghost"
            style={{ flexShrink: 0 }}
            onClick={() => setAssignOpen(true)}
          >
            + Assign
          </Button>
        </div>
      )}
    </div>
  );
}
