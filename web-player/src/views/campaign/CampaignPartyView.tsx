import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { SharedConditionInstance } from "@beholden/shared/domain";
import { EmptyState } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { IconPlayer, IconConditionByKey } from "@/icons";
import { useWs } from "@/services/ws";
import { hpColor } from "@/views/character/CharacterSheetUtils";

type ConditionInstance = SharedConditionInstance;

export interface PartyMember {
  id: string;
  userId: string | null;
  playerName: string;
  characterName: string;
  className: string;
  species: string;
  level: number;
  hpPercent: number;
  ac: number;
  speed: number | null;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  conditions: ConditionInstance[];
  characterData?: Record<string, unknown> | null;
}

interface CampaignBastionSummary {
  id: string;
  name: string;
  active: boolean;
  level: number;
  specialSlots: number;
  specialSlotsUsed: number;
}

function hpLabel(pct: number): string {
  if (pct <= 0) return "Down";
  if (pct < 25) return "Critical";
  if (pct < 50) return "Bloodied";
  if (pct < 75) return "Bloody";
  return "Healthy";
}

function MemberCard({ m, campaignId }: { m: PartyMember; campaignId: string }) {
  const navigate = useNavigate();
  const color = m.color ?? C.accentHl;
  const hpC = hpColor(m.hpPercent);

  return (
    <div
      onClick={() => navigate(`/campaigns/${campaignId}/members/${m.id}`)}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${color}33`,
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}66`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}33`;
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 10,
            flexShrink: 0,
            background: `${color}22`,
            border: `2px solid ${color}55`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {m.imageUrl ? (
            <img src={m.imageUrl} alt={m.characterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <IconPlayer size={28} style={{ opacity: 0.4 }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "var(--fs-body)", color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {m.characterName || "Unnamed"}
          </div>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 2 }}>
            {[m.className, m.species].filter(Boolean).join(" · ")}
          </div>
          <div style={{ fontSize: "var(--fs-small)", color, fontWeight: 700, marginTop: 1 }}>Level {m.level}</div>
          {m.playerName ? (
            <div style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.4)", marginTop: 1 }}>{m.playerName}</div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "4px 8px",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "var(--fs-body)", fontWeight: 900, color: C.text }}>{m.ac}</span>
          <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 600 }}>AC</span>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: "var(--fs-small)", color: hpC, fontWeight: 700 }}>{hpLabel(m.hpPercent)}</span>
          <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>{m.hpPercent}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              borderRadius: 3,
              width: `${m.hpPercent}%`,
              background: hpC,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {m.conditions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {m.conditions.map((c, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: "var(--fs-small)",
                padding: "2px 7px",
                borderRadius: 20,
                fontWeight: 600,
                background: "rgba(248,113,113,0.12)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#fca5a5",
              }}
            >
              <IconConditionByKey condKey={c.key} size={10} />
              {String(c.key)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CampaignPartyView() {
  const { id: campaignId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [party, setParty] = React.useState<PartyMember[]>([]);
  const [campaignName, setCampaignName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [bastions, setBastions] = React.useState<CampaignBastionSummary[]>([]);
  const taskStateRef = React.useRef(
    new Map<string, { timer: number | null; inflight: boolean; pending: boolean }>()
  );

  const enqueue = React.useCallback((key: string, run: () => Promise<void> | void, delayMs = 150) => {
    let state = taskStateRef.current.get(key);
    if (!state) {
      state = { timer: null, inflight: false, pending: false };
      taskStateRef.current.set(key, state);
    }
    if (state.timer != null) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state!.timer = null;
      const execute = () => {
        if (state!.inflight) {
          state!.pending = true;
          return;
        }
        state!.inflight = true;
        Promise.resolve(run())
          .catch(() => {})
          .finally(() => {
            state!.inflight = false;
            if (state!.pending) {
              state!.pending = false;
              execute();
            }
          });
      };
      execute();
    }, delayMs);
  }, []);

  React.useEffect(() => {
    return () => {
      for (const state of taskStateRef.current.values()) {
        if (state.timer != null) window.clearTimeout(state.timer);
      }
      taskStateRef.current.clear();
    };
  }, []);

  const fetchParty = React.useCallback(() => {
    if (!campaignId) return;
    api<PartyMember[]>(`/api/campaigns/${campaignId}/party`)
      .then(setParty)
      .catch((e) => setError(e?.message ?? "Failed to load party"))
      .finally(() => setLoading(false));
  }, [campaignId]);

  const fetchPartyMember = React.useCallback(async (playerId: string): Promise<PartyMember | null> => {
    if (!campaignId || !playerId) return null;
    try {
      return await api<PartyMember>(`/api/campaigns/${campaignId}/party/${playerId}`);
    } catch {
      return null;
    }
  }, [campaignId]);

  React.useEffect(() => {
    if (!campaignId) return;
    fetchParty();
    api<{ bastions: CampaignBastionSummary[] }>(`/api/campaigns/${campaignId}/bastions`)
      .then((res) => setBastions((res.bastions ?? []).filter((entry) => entry.active)))
      .catch(() => setBastions([]));
    api<{ id: string; name: string }[]>("/api/me/campaigns")
      .then((list) => {
        const c = list.find((entry) => entry.id === campaignId);
        if (c) setCampaignName(c.name);
      })
      .catch(() => {});
  }, [campaignId, fetchParty]);

  useWs(
    React.useCallback(
      (msg) => {
        if (msg.type === "players:changed") {
          const cId = (msg.payload as any)?.campaignId as string | undefined;
          if (cId === campaignId) {
            enqueue(`party:${campaignId}`, async () => {
              fetchParty();
            });
          }
          return;
        }
        if (msg.type === "players:delta") {
          const payload = (msg.payload ?? {}) as {
            campaignId?: string;
            action?: "upsert" | "delete" | "refresh";
            playerId?: string;
          };
          if (payload.campaignId !== campaignId) return;
          if (payload.action === "delete" && payload.playerId) {
            setParty((prev) => prev.filter((member) => member.id !== payload.playerId));
            return;
          }
          if (payload.action === "upsert" && payload.playerId) {
            enqueue(`party:delta:${campaignId}:${payload.playerId}`, async () => {
              const member = await fetchPartyMember(payload.playerId!);
              if (!member) {
                setParty((prev) => prev.filter((entry) => entry.id !== payload.playerId));
                return;
              }
              setParty((prev) => {
                const idx = prev.findIndex((entry) => entry.id === member.id);
                if (idx === -1) return [...prev, member];
                const next = prev.slice();
                next[idx] = member;
                return next;
              });
            }, 80);
            return;
          }
          enqueue(`party:${campaignId}`, async () => {
            fetchParty();
          });
        }
        if (msg.type === "bastions:changed") {
          const cId = (msg.payload as any)?.campaignId as string | undefined;
          if (cId === campaignId) {
            enqueue(`bastions:${campaignId}`, async () => {
              const res = await api<{ bastions: CampaignBastionSummary[] }>(`/api/campaigns/${campaignId}/bastions`);
              setBastions((res.bastions ?? []).filter((entry) => entry.active));
            });
          }
        }
      },
      [campaignId, enqueue, fetchParty, fetchPartyMember]
    )
  );

  const inner = (() => {
    if (loading) return <EmptyState textColor={C.muted}>Loading…</EmptyState>;
    if (error) return <EmptyState textColor={C.colorPinkRed}>{error}</EmptyState>;
    if (party.length === 0) return <EmptyState textColor={C.muted}>No players in this campaign yet.</EmptyState>;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {party.map((m) => (
          <MemberCard key={m.id} m={m} campaignId={campaignId!} />
        ))}
      </div>
    );
  })();

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px" }}>
        <button
          type="button"
          onClick={() => navigate("/")}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "var(--fs-subtitle)", padding: 0, marginBottom: 20 }}
        >
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: "var(--fs-hero)", fontWeight: 900 }}>{campaignName || "Campaign"}</h1>
          <span style={{ fontSize: "var(--fs-medium)", color: C.muted }}>— Party</span>
        </div>
        {inner}

        {bastions.length > 0 ? (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 900 }}>Bastions</h2>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>({bastions.length})</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {bastions.map((bastion) => (
                <button
                  key={bastion.id}
                  onClick={() => navigate(`/campaigns/${campaignId}/bastions/${bastion.id}`)}
                  style={{
                    textAlign: "left",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 12,
                    padding: 12,
                    color: C.text,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800 }}>{bastion.name}</div>
                  <div style={{ marginTop: 4, fontSize: "var(--fs-small)", color: C.muted }}>
                    Level {bastion.level} • Slots {bastion.specialSlotsUsed}/{bastion.specialSlots}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
