import { C } from "@/lib/theme";
import { IconPlayer, IconShield, IconSpeed, IconInitiative, IconHeart, IconConditionByKey } from "@/icons";
import { abilityMod, formatModifier, hpColor } from "@/views/character/CharacterSheetUtils";
import { MiniStat, Tag } from "@beholden/shared/ui";
import type { SharedConditionInstance } from "@beholden/shared/domain";
import type { PartyMember } from "./CampaignPartyView";
import { MINI_STAT_THEME } from "./PartyMemberTheme";

export function PartyMemberHeader({
  member,
  color,
  subclass,
  headerDirection,
  headerAlign,
  topStatsWidth,
  topStatsColumns,
}: {
  member: PartyMember;
  color: string;
  subclass?: string;
  headerDirection: React.CSSProperties["flexDirection"];
  headerAlign: React.CSSProperties["alignItems"];
  topStatsWidth: string | undefined;
  topStatsColumns: string;
}) {
  const m = member;
  const hpC = hpColor(m.hpPercent);
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 20,
          flexDirection: headerDirection,
          alignItems: headerAlign,
          marginBottom: 24,
          paddingBottom: 20,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 14,
            flexShrink: 0,
            background: `${color}18`,
            border: `2px solid ${color}44`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {m.imageUrl
            ? <img src={m.imageUrl} alt={m.characterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <IconPlayer size={36} style={{ opacity: 0.3 }} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 900, letterSpacing: -0.5 }}>
              {m.characterName || "Unnamed"}
            </h2>
            <Tag label={`Level ${m.level}`} color={color} />
          </div>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 3 }}>
            {[m.className, subclass, m.species].filter(Boolean).join(" - ")}
          </div>
          {m.playerName ? (
            <div style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.35)", marginTop: 2 }}>{m.playerName}</div>
          ) : null}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: topStatsColumns, gap: 8, flexShrink: 0, width: topStatsWidth }}>
          <MiniStat label="AC" value={String(m.ac)} icon={<IconShield size={11} />} theme={MINI_STAT_THEME} />
          <MiniStat label="Init" value={formatModifier(abilityMod(m.dexScore))} icon={<IconInitiative size={11} />} theme={MINI_STAT_THEME} />
          <MiniStat label="Speed" value={m.speed ? `${m.speed}ft` : "--"} icon={<IconSpeed size={11} />} theme={MINI_STAT_THEME} />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: "var(--fs-small)", display: "flex", alignItems: "center", gap: 5, color: hpC, fontWeight: 700 }}>
            <IconHeart size={11} /> Hit Points
          </span>
          <span style={{ fontSize: "var(--fs-small)", color: C.muted, fontWeight: 600 }}>{m.hpPercent}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 4, width: `${m.hpPercent}%`, background: hpC, transition: "width 0.5s ease" }} />
        </div>
      </div>

      {m.conditions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {m.conditions.map((condition: SharedConditionInstance, index) => (
            <span
              key={`${String(condition.key)}:${index}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: "var(--fs-small)",
                padding: "3px 9px",
                borderRadius: 20,
                fontWeight: 600,
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.25)",
                color: "#fca5a5",
              }}
            >
              <IconConditionByKey condKey={condition.key} size={10} />
              {String(condition.key)}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
