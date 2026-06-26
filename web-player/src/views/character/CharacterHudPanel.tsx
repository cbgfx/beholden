import React from "react";
import { SHARED_CONDITION_DEFS } from "@beholden/shared/domain";
import { C } from "@/lib/theme";
import { IconAttack, IconConditionByKey, IconConditions, IconHeal, IconHeart, IconInspiration, IconPlayer } from "@/icons";
import { HexBtn, Panel } from "@/views/character/CharacterViewParts";
import { HealthBar } from "@beholden/shared/ui";
import type { CharacterCampaign, ConditionInstance, CharacterData } from "@/views/character/CharacterSheetTypes";
import { CharacterHudXpPopup } from "./CharacterHudXpPopup";
import { CharacterHudDeathSaves } from "./CharacterHudDeathSaves";
import { CharacterHudConditionsDrawer } from "./CharacterHudConditionsDrawer";

interface CharacterHudLike {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpCurrent: number;
  imageUrl: string | null;
  characterData: CharacterData | null;
  campaigns: CharacterCampaign[];
  conditions?: ConditionInstance[];
  deathSaves?: { success: number; fail: number };
}

function IconCharacterInfo(props: { size?: number; style?: React.CSSProperties }) {
  const { size = 18, style } = props;
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} fill="currentColor" style={style} aria-hidden="true">
      <path d="M453.295 17.117c-.546 7.232 1.619 15.478 5.957 22.612 4.338 7.133 10.666 12.847 17.338 15.69 9.655-11.206-5.483-37.974-20.092-38.624-1.09-.07-2.254.137-3.203.322zm-111.547 8.38L329.492 49.61l61.018 100.326 25.627-2.127 13.676-21.777-9.063-14.9-27.34 16.628-37.931-62.371L350.8 57.7l27.34-16.628-9.346-15.368zm93.977 1.62-60.194 36.61 23.905 39.303 60.193-36.61c-6.345-4.604-11.676-10.635-15.754-17.34-4.078-6.704-6.981-14.21-8.15-21.963zm-125.01 19.711-161.647 2.62c10.403 24.036 7.492 47.197-4.388 65.648-18.658-14.237-44.341-15.374-63.407-17.717-14.06 123.827-6.22 225.967-6.271 342.149-.004 9.469-1.157 23.12 4.826 32.947 1.887 3.1 4.37 5.928 8.129 8.342 17.708-6.206 41.405-12.44 54.87-22.274-6.951-.825-14.755.952-21.138.955-8.458-.04-19.144-6.11-24.748-19.496-2.919-6.973-6.636-18.193-.181-29.072 2.838-4.785 9.383-10.302 14.26-10.328 94.651.504 191.392-.32 279.568.154-5.523-76.851-10.013-154.096-5.53-232.308l-4.146.343-14.842-24.404-66.867 40.668 6.781 10.598-15.162 9.699-59.097-92.371 15.16-9.7L255 115.966l68.46-41.637-11.95-19.65-2.606-4.285zm-180.17 4.383c-15.366 8.213-29.102 17.702-40.99 28.707 16.167 1.495 33.74 3.063 48.64 9.95 3.139-13.836-3.247-26.896-7.65-38.657zm202.268 38.494-66.645 40.534 7.275 11.962 33.325-20.265 9.351 15.377-33.322 20.267 7.277 11.963 66.643-40.533zM201.41 136.278l.445 17.992c-30.522.253-58.62 2.029-90.013 2.11v-18a35163.72 35163.72 0 0 0 89.568-2.103zm144.983 78.98.24 17.996-234.346 3.143-.242-17.996zm.078 40.684.408 17.992-123.654 2.81-.41-17.994zm-235.178 3.097h90.602v17.998h-90.602zm234.795 33.237.406 17.992-62.158 1.406-.406-17.994zm-83.686 1.455.338 17.996-150.3 2.808-.337-17.994zm85.946 52.806.402 17.995-125.647 2.808-.402-17.992zm-196.323 70.79c10.05 9.261 17.925 22.065 15.078 36.718-2.074 10.682-10.422 17.606-19.814 23.106s-20.775 9.866-32.512 13.914a1395.68 1395.68 0 0 1-12.238 4.154l301.387-7.672c7.772-.45 14.658-5.66 19.734-13.406 5.082-7.754 7.477-17.817 6.895-23.236-.583-5.419-4.857-14.677-10.973-21.48-6.116-6.805-13.547-10.824-19.025-10.618l-.198.008zm-39.785 2.787c-1.07 1.802-.466 8.714 1.303 12.939 3.72 8.887 6.028 8.437 8.232 8.447 8.877 2.102 17.347.269 25.85-1.025-2.053-4.123-5.283-8.704-10.283-12.113-4.12-2.809-20.675-15.634-25.102-8.248z" />
    </svg>
  );
}

const BASE_CONDITIONS = SHARED_CONDITION_DEFS;

function getAvailableConditions(char: Pick<CharacterHudLike, "className">) {
  return /barbarian/i.test(String(char.className ?? ""))
    ? [{ key: "rage", name: "Rage" }, ...BASE_CONDITIONS]
    : BASE_CONDITIONS;
}

function conditionDisplayLabel(cond: ConditionInstance): string {
  if (cond.key === "polymorphed") {
    const name = (cond as Record<string, unknown>).polymorphName;
    return typeof name === "string" && name ? `✦ ${name}` : "Polymorphed";
  }
  const def = [...BASE_CONDITIONS, { key: "rage", name: "Rage" }].find((c) => c.key === cond.key);
  const base = def?.name ?? cond.key;
  const extra = cond.casterName || cond.sourceName;
  return extra ? `${base} (${extra})` : base;
}

export interface CharacterHudPanelProps {
  embedded?: boolean;
  char: CharacterHudLike;
  accentColor: string;
  xpEarned: number;
  xpNeeded: number;
  xpInput: string;
  xpPopupOpen: boolean;
  setXpInput: (value: string) => void;
  setXpPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  saveXp: (value: number) => Promise<void>;
  onOpenInfo: () => void;
  onLevelUp: () => void;
  onEdit: () => void;
  onPortraitClick: () => void;
  portraitUploading?: boolean;
  effectiveHpMax: number;
  tempHp: number;
  hpPct: number;
  tempPct: number;
  hpError: string | null;
  hpSaving: boolean;
  hpAmount: string;
  hd: number | null;
  lastRoll: number | null;
  hpInputRef: React.RefObject<HTMLInputElement | null>;
  setHpError: (value: string | null) => void;
  setLastRoll: (value: number | null) => void;
  setHpAmount: (value: string) => void;
  handleApplyHp: (kind: "damage" | "heal") => void;
  inspirationActive: boolean;
  handleToggleInspiration: () => void;
  condPickerOpen: boolean;
  setCondPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  condSaving: boolean;
  toggleCondition: (key: string) => void;
  dsSaving: boolean;
  saveDeathSaves: (next: { success: number; fail: number }) => void;
  hpMaxBonus: number;
}

export function CharacterHudPanel(props: CharacterHudPanelProps) {
  const {
    char,
    embedded = false,
    accentColor,
    xpEarned,
    xpNeeded,
    xpInput,
    xpPopupOpen,
    setXpInput,
    setXpPopupOpen,
    saveXp,
    onOpenInfo,
    onLevelUp,
    onEdit,
    onPortraitClick,
    portraitUploading,
    effectiveHpMax,
    tempHp,
    hpPct,
    hpError,
    hpSaving,
    hpAmount,
    hd,
    lastRoll,
    hpInputRef,
    setHpError,
    setLastRoll,
    setHpAmount,
    handleApplyHp,
    inspirationActive,
    handleToggleInspiration,
    condPickerOpen,
    setCondPickerOpen,
    condSaving,
    toggleCondition,
    dsSaving,
    saveDeathSaves,
    hpMaxBonus,
  } = props;
  const availableConditions = React.useMemo(() => getAvailableConditions(char), [char]);

  function stripEditionTag(s: string): string {
    return s.replace(/\s*\[(?:5\.5e|2024|5e|5\.0)\]\s*$/i, "").trim();
  }

  return (
    <>
      <Panel embedded={embedded}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div
            onClick={onPortraitClick}
            title="Click to change portrait"
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              flexShrink: 0,
              background: `${accentColor}22`,
              border: `2px solid ${accentColor}66`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
            }}
          >
            {char.imageUrl ? <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <IconPlayer size={36} style={{ opacity: 0.35 }} />}
            {portraitUploading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-tiny)", color: "#fff" }}>…</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin: "0 0 3px",
              fontSize: "clamp(var(--fs-title), 1.4vw, 22px)",
              lineHeight: 1.15,
              fontWeight: 800,
              letterSpacing: -0.2,
              color: C.text,
            }}>
              {char.name}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 6px", marginBottom: 3, fontSize: "var(--fs-subtitle)", color: C.muted }}>
              {[char.className, char.characterData?.classes?.[0]?.subclass, char.species].filter(Boolean).map((item, i, arr) => (
                <React.Fragment key={i}>
                  <span style={{ whiteSpace: "nowrap" }}>{stripEditionTag(item!)}</span>
                  {i < arr.length - 1 && <span style={{ opacity: 0.35, userSelect: "none" }}>·</span>}
                </React.Fragment>
              ))}
              <span style={{ color: accentColor, fontWeight: 700, fontSize: "var(--fs-small)", whiteSpace: "nowrap" }}>Lv {char.level}</span>
            </div>
            {char.playerName && <div style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.45)", marginBottom: 3 }}>Player: {char.playerName}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {char.campaigns.map((c) => (
                  <span
                    key={c.id}
                    style={{
                      fontSize: "var(--fs-tiny)",
                      padding: "1px 7px",
                      borderRadius: 20,
                      fontWeight: 700,
                      background: `${accentColor}14`,
                      border: `1px solid ${accentColor}33`,
                      color: accentColor,
                      whiteSpace: "nowrap",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={c.campaignName}
                  >
                    {c.campaignName}
                  </span>
                ))}
              </div>
              <CharacterHudXpPopup
                xpEarned={xpEarned}
                xpNeeded={xpNeeded}
                xpInput={xpInput}
                xpPopupOpen={xpPopupOpen}
                setXpInput={setXpInput}
                setXpPopupOpen={setXpPopupOpen}
                saveXp={saveXp}
                accentColor={accentColor}
              />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {xpEarned >= xpNeeded && xpNeeded > 0 && (
              <button
                onClick={onLevelUp}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: `${accentColor}22`,
                  border: `1px solid ${accentColor}88`,
                  color: accentColor,
                  fontWeight: 700,
                  fontSize: "var(--fs-small)",
                }}
              >
                ↑ Level Up
              </button>
            )}
            <button
              onClick={onOpenInfo}
              title="Character Information"
              style={{
                padding: "7px 11px",
                borderRadius: 8,
                cursor: "pointer",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: C.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCharacterInfo size={18} />
            </button>
            <button
              onClick={onEdit}
              style={{
                padding: "7px 11px",
                borderRadius: 8,
                cursor: "pointer",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.16)",
                color: C.muted,
                fontWeight: 600,
                fontSize: "var(--fs-body)",
              }}
            >
              ✎
            </button>
          </div>
        </div>

        <HealthBar
          current={char.hpCurrent}
          max={effectiveHpMax}
          temp={tempHp}
          height={32}
          radius={8}
          trackColor="rgba(255,255,255,0.07)"
          fillColor={hpPct > 0.5 ? C.green : hpPct > 0.25 ? "#f59e0b" : C.red}
          tempColor="#f59e0b"
          transition="width 0.3s ease, background 0.3s ease"
          style={{ border: "1px solid rgba(255,255,255,0.12)", marginBottom: 8 }}
          label={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-body)", fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)", gap: 4 }}>
              <IconHeart size={11} style={{ opacity: 0.8 }} />
              {char.hpCurrent} / {effectiveHpMax}
              {tempHp > 0 && <span style={{ fontSize: "var(--fs-small)", color: "#fff", fontWeight: 700 }}>+{tempHp} temp</span>}
              {hpMaxBonus !== 0 && <span style={{ fontSize: "var(--fs-tiny)", color: "#f59e0b" }}>(max {hpMaxBonus > 0 ? "+" : ""}{hpMaxBonus})</span>}
            </div>
          }
        />

        <style>{`
          @keyframes playerHexPulse {
            0%   { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
            50%  { filter: drop-shadow(0 0 10px rgba(255,255,255,0.10)); }
            100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
          }
          @keyframes playerRollFlash {
            0%   { color: #fbbf24; transform: scale(1.1); }
            60%  { color: #fbbf24; transform: scale(1.1); }
            100% { color: inherit; transform: scale(1); }
          }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 8px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
            <HexBtn variant="inspiration" active={inspirationActive} title="Toggle Heroic Inspiration" disabled={false} onClick={handleToggleInspiration}>
              <IconInspiration size={22} />
            </HexBtn>
            <HexBtn variant="damage" title="Apply damage (Enter)" disabled={hpSaving} onClick={() => handleApplyHp("damage")}>
              <IconAttack size={22} />
            </HexBtn>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1, minWidth: 0 }}>
              <input
                ref={hpInputRef}
                value={hpAmount}
                onChange={(e) => {
                  setHpError(null);
                  setLastRoll(null);
                  setHpAmount(e.target.value.replace(/[^0-9dD+\-]/g, ""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyHp(e.shiftKey ? "heal" : "damage");
                  }
                  if (e.key === "Escape") {
                    setHpAmount("");
                    setHpError(null);
                    setLastRoll(null);
                  }
                }}
                placeholder="1d6+2 / +10"
                inputMode="text"
                style={{
                  width: "100%",
                  textAlign: "center",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${hpError ? C.red + "88" : "rgba(255,255,255,0.1)"}`,
                  background: "rgba(255,255,255,0.05)",
                  color: C.text,
                  fontWeight: 900,
                  fontSize: "var(--fs-large)",
                  outline: "none",
                  animation: lastRoll !== null ? "playerRollFlash 1.6s ease forwards" : "none",
                }}
              />
              <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, minHeight: 14 }}>
                {lastRoll !== null ? `rolled ${lastRoll}` : hd !== null ? `HD: ${char.level}d${hd}` : ""}
              </span>
            </div>
            <HexBtn variant="heal" title="Apply heal (Shift+Enter)" disabled={hpSaving} onClick={() => handleApplyHp("heal")}>
              <IconHeal size={22} />
            </HexBtn>
            <HexBtn variant="conditions" title="Add / remove conditions" disabled={false} onClick={() => setCondPickerOpen((o) => !o)}>
              <IconConditions size={22} />
            </HexBtn>
          </div>
          {(hpError || hpSaving) && <div style={{ textAlign: "center", fontSize: "var(--fs-small)", color: hpError ? C.red : C.muted }}>{hpError ?? "Saving..."}</div>}
        </div>

        <CharacterHudDeathSaves
          hpCurrent={char.hpCurrent}
          deathSaves={char.deathSaves}
          dsSaving={dsSaving}
          saveDeathSaves={saveDeathSaves}
        />

        {(char.conditions ?? []).length > 0 && (
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: accentColor, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <IconConditions size={10} /> Conditions
              {condSaving && <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", fontSize: "var(--fs-tiny)" }}>saving...</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...(char.conditions ?? [])].sort((a, b) => {
                const ai = availableConditions.findIndex((c) => c.key === a.key);
                const bi = availableConditions.findIndex((c) => c.key === b.key);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
              }).map((cond, i) => (
                <span key={i} style={{ fontSize: "var(--fs-small)", fontWeight: 700, padding: "4px 6px 4px 8px", borderRadius: 6, background: `${accentColor}18`, border: `1px solid ${accentColor}44`, color: accentColor, textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <IconConditionByKey condKey={cond.key} size={12} style={{ opacity: 0.85, flexShrink: 0 }} />
                  {conditionDisplayLabel(cond)}
                  <button onClick={() => toggleCondition(cond.key)} style={{ border: "none", background: "transparent", color: C.red, cursor: "pointer", fontSize: "var(--fs-body)", lineHeight: 1, padding: 0, display: "inline-flex", alignItems: "center" }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <CharacterHudConditionsDrawer
        condPickerOpen={condPickerOpen}
        availableConditions={availableConditions}
        accentColor={accentColor}
        conditions={char.conditions ?? []}
        condSaving={condSaving}
        toggleCondition={toggleCondition}
        onClose={() => setCondPickerOpen(false)}
      />
    </>
  );
}
