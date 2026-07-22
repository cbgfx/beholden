import { C } from "@/lib/theme";
import { IconBastions } from "@beholden/shared/icons";
import { HeaderActionLink, SectionTitle } from "@beholden/shared/ui";
import type { Bastion } from "./BastionViewShared";
import { pillStyle } from "./BastionViewShared";

export function BastionHeader({
  bastion,
  campaignId,
  playerSpecialUsed,
  ownSpecialSlots,
  hirelingsTotal,
  defendersTotal,
  saving,
  saveMessage,
  onToggleMaintain,
}: {
  bastion: Bastion;
  campaignId: string | undefined;
  playerSpecialUsed: number;
  ownSpecialSlots: number;
  hirelingsTotal: number;
  defendersTotal: number;
  saving: boolean;
  saveMessage: { text: string; ok: boolean } | null;
  onToggleMaintain: () => void;
}) {
  return (
    <>
      <HeaderActionLink to={campaignId ? `/campaigns/${campaignId}` : "/"} color={C.muted} padding="0 0 20px" borderRadius={0} fontSize="var(--fs-small)">
        {"<- Back to Campaign"}
      </HeaderActionLink>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 20,
          padding: "14px 16px 18px",
          borderRadius: 14,
          border: "1px solid rgba(251,191,36,0.20)",
          background:
            "radial-gradient(130% 160% at 0% 0%, rgba(251,191,36,0.16) 0%, rgba(56,182,255,0.08) 45%, rgba(255,255,255,0.02) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: 10,
                border: `1px solid rgba(251,191,36,0.52)`,
                background: "linear-gradient(180deg, rgba(251,191,36,0.26), rgba(251,191,36,0.10))",
                color: C.colorGold,
                flexShrink: 0,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.28), 0 10px 24px rgba(251,191,36,0.18)",
              }}
            >
              <IconBastions size={22} />
            </span>
            <SectionTitle
              color={C.text}
              style={{
                textTransform: "none",
                letterSpacing: -0.2,
                fontSize: "clamp(2.15rem, 2.5vw, 2.65rem)",
                fontWeight: 900,
                marginBottom: 0,
                lineHeight: 1.05,
                textShadow: "0 2px 16px rgba(56,182,255,0.15)",
              }}
            >
              {bastion.name}
            </SectionTitle>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Level {bastion.level}</span>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>|</span>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Slots {playerSpecialUsed}/{ownSpecialSlots}</span>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>|</span>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Hirelings {hirelingsTotal}</span>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>|</span>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>
              Defenders {defendersTotal} ({bastion.defendersArmed ?? 0} armed / {bastion.defendersUnarmed ?? 0} unarmed)
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {saving && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, opacity: 0.6 }}>Saving...</span>}
          {!saving && saveMessage && (
            <span style={{ fontSize: "var(--fs-tiny)", color: saveMessage.ok ? C.muted : C.colorPinkRed }}>
              {saveMessage.text}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleMaintain}
            style={pillStyle(bastion.maintainOrder)}
          >
            Maintain
          </button>
        </div>
      </div>
    </>
  );
}
