import { useState } from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { cancelBtnStyle } from "@/views/character/CharacterViewParts";

const RED = "#dc2626";
const RED_DIM = "rgba(220,38,38,0.18)";
const RED_GLOW = "rgba(220,38,38,0.35)";

function IconSwordsPower({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M105.7 41.16l-47.03 1.31 29.3 36.85L116 69.13zm300.6 0L396 69.14l28 10.2 29.3-36.86zm-278.4 8.18L139 79.87l-30.5 11.14L370.7 213.1l19.4-41.6zm256.2 0l-106.7 49.7 54.4 25.36 71.7-33.38L373 79.88zM180.2 144.3l-58.3 27.2 19.4 41.6 93.3-43.4zm241.1 2.8l-49.2 105.5 13 14.9 55.9-120zm-330.63.1l-19.6.4 55.83 119.8 12.9-14.8zm349.43 44.7l-30.6 65.6-34 84.7-55.8 33.3c-3.1 7.3-6.8 14-11.2 20C295.7 413.2 277 425 256 425s-39.7-11.8-52.5-29.5c-4.4-6.1-8.2-12.8-11.3-20.2l-55.1-33.2-27.9-70-37.13-79.7-29.5 19.4 45.5 151.8 81.23 97.1V487h174v-26.2l80.6-97.1 45.6-151.9zM256 249c-14.3 0-27.7 7.9-38 22.1-10.3 14.1-17 34.4-17 56.9s6.7 42.8 17 56.9c10.3 14.2 23.7 22.1 38 22.1s27.7-7.9 38-22.1c10.3-14.1 17-34.4 17-56.9s-6.7-42.8-17-56.9c-10.3-14.2-23.7-22.1-38-22.1z" />
    </svg>
  );
}

export function CharacterInitiativePrompt(props: {
  encounterId: string;
  combatantId: string;
  initiativeBonus: number;
  accentColor: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [roll, setRoll] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bonus = props.initiativeBonus;
  const bonusLabel = bonus >= 0 ? `+${bonus}` : String(bonus);
  const rollNum = parseInt(roll, 10);
  const total = roll !== "" && !isNaN(rollNum) ? rollNum : null;

  const submit = async () => {
    if (total === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(
        `/api/encounters/${props.encounterId}/combatants/${props.combatantId}/initiative`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initiative: total }),
        },
      );
      props.onClose();
      props.onSubmitted?.();
    } catch {
      setError("Could not submit. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="initiative-prompt-title"
        style={{
          background: "#080e18",
          border: `2px solid ${RED}`,
          borderRadius: 16,
          width: "min(360px, 92vw)",
          display: "flex", flexDirection: "column",
          boxShadow: `0 0 0 1px ${RED_GLOW}, 0 0 40px ${RED_DIM}, 0 24px 60px rgba(0,0,0,0.85)`,
          overflow: "hidden",
        }}
      >
        {/* Icon banner */}
        <div
          style={{
            background: `linear-gradient(160deg, ${RED_DIM} 0%, transparent 70%)`,
            borderBottom: `1px solid rgba(220,38,38,0.22)`,
            display: "flex", flexDirection: "column", alignItems: "center",
            paddingTop: 28, paddingBottom: 16, gap: 10,
          }}
        >
          <div style={{ color: RED, filter: `drop-shadow(0 0 14px ${RED_GLOW})` }}>
            <IconSwordsPower size={58} />
          </div>
          <span id="initiative-prompt-title" style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Roll Initiative
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: "var(--fs-body)", color: C.muted }}>
            Your modifier:{" "}
            <span style={{ color: RED, fontWeight: 800 }}>d20 {bonusLabel}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Initiative total
            </label>
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              value={roll}
              onChange={(e) => {
                const filtered = e.target.value
                  .replace(/[^0-9-]/g, "")
                  .replace(/^(-?)(.*)$/, (_, sign, rest) => sign + rest.replace(/-/g, ""));
                setRoll(filtered);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && total !== null) void submit();
                if (e.key === "Escape") props.onClose();
              }}
              placeholder="—"
              style={{
                padding: "12px 14px", borderRadius: 8, textAlign: "center",
                border: `1px solid ${total !== null ? RED + "88" : "rgba(255,255,255,0.12)"}`,
                background: total !== null ? RED_DIM : "rgba(255,255,255,0.05)",
                color: "#fff", fontSize: "var(--fs-title)", fontWeight: 900,
                outline: "none", width: "100%", boxSizing: "border-box",
                transition: "border-color 120ms ease, background 120ms ease",
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: "var(--fs-small)", color: RED }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={total === null || submitting}
              onClick={() => void submit()}
              style={{
                flex: 1, padding: "12px 20px", borderRadius: 10,
                cursor: total === null || submitting ? "not-allowed" : "pointer",
                background: total !== null ? RED : "rgba(255,255,255,0.05)",
                border: `1px solid ${total !== null ? RED : "rgba(255,255,255,0.1)"}`,
                color: "#fff", fontWeight: 800, fontSize: "var(--fs-body)",
                opacity: total === null || submitting ? 0.45 : 1,
                boxShadow: total !== null ? `0 0 18px ${RED_GLOW}` : "none",
                transition: "background 120ms ease, opacity 120ms ease, box-shadow 120ms ease",
              }}
            >
              {submitting ? "Submitting…" : total !== null ? `Submit ${total}` : "Enter the Fight!"}
            </button>
            <button
              type="button"
              onClick={props.onClose}
              style={{ ...cancelBtnStyle, flexShrink: 0 }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
