import React from "react";
import { SHARED_CONDITION_DEFS } from "@beholden/shared/domain";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { IconAttack, IconConditionByKey, IconConditions, IconHeal, IconHeart, IconInspiration } from "@/icons";
import { HexBtn, Panel } from "@/views/character/CharacterViewParts";
import { HealthBar } from "@beholden/shared/ui";
import type { CharacterCampaign, ConditionInstance, CharacterData } from "@/views/character/CharacterSheetTypes";
import {
  concentrationSpellNamesFromLookup,
  type ConcentrationSpellLookupRow,
} from "./CharacterConcentrationSpells";
import { CharacterConcentrationPickerModal } from "./CharacterConcentrationPickerModal";
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
  effectiveHpMax: number;
  tempHp: number;
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
  concentrationSpell?: string | null;
  onConcentrationSpellChange?: (v: string | null) => void;
  concentrationSpellNames?: string[];
}

export function CharacterHudPanel(props: CharacterHudPanelProps) {
  const {
    char,
    embedded = false,
    accentColor,
    effectiveHpMax,
    tempHp,
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
    concentrationSpell,
    onConcentrationSpellChange,
    concentrationSpellNames = [],
  } = props;
  const [concentrationPickerOpen, setConcentrationPickerOpen] = React.useState(false);
  const [concentrationSearch, setConcentrationSearch] = React.useState("");
  const [concentrationSpells, setConcentrationSpells] = React.useState<string[]>([]);
  const [concentrationSpellsLoading, setConcentrationSpellsLoading] = React.useState(false);
  const [concentrationSpellsError, setConcentrationSpellsError] = React.useState(false);
  const concentrationSpellLookupKey = concentrationSpellNames.join("\u0000");
  const availableConditions = React.useMemo(() => getAvailableConditions(char), [char]);
  const displayHpMax = effectiveHpMax;
  const displayHpPct = displayHpMax > 0 ? Math.min(1, char.hpCurrent / displayHpMax) : 0;
  React.useEffect(() => {
    if (!concentrationPickerOpen) return;

    const names = concentrationSpellLookupKey
      .split("\u0000")
      .map((name) => name.trim())
      .filter(Boolean);
    let alive = true;

    setConcentrationSpells([]);
    setConcentrationSpellsError(false);
    if (names.length === 0) {
      setConcentrationSpellsLoading(false);
      return;
    }

    setConcentrationSpellsLoading(true);
    api<{ rows: ConcentrationSpellLookupRow[] }>("/api/spells/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names }),
    })
      .then((payload) => {
        if (alive) setConcentrationSpells(concentrationSpellNamesFromLookup(payload.rows ?? []));
      })
      .catch(() => {
        if (alive) setConcentrationSpellsError(true);
      })
      .finally(() => {
        if (alive) setConcentrationSpellsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [concentrationPickerOpen, concentrationSpellLookupKey]);
  return (
    <>
      <Panel embedded={embedded}>
        <HealthBar
          current={char.hpCurrent}
          max={displayHpMax}
          temp={tempHp}
          height={32}
          radius={8}
          trackColor="rgba(255,255,255,0.07)"
          fillColor={displayHpPct > 0.5 ? C.green : displayHpPct > 0.25 ? "#f59e0b" : C.red}
          tempColor="#f59e0b"
          transition="width 0.3s ease, background 0.3s ease"
          style={{ border: "1px solid rgba(255,255,255,0.12)", marginBottom: 8 }}
          label={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-body)", fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)", gap: 4 }}>
              <IconHeart size={11} style={{ opacity: 0.8 }} />
              {char.hpCurrent} / {displayHpMax}
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
                  {cond.key === "concentration" ? (
                    <span
                      onClick={() => { setConcentrationSearch(""); setConcentrationPickerOpen(true); }}
                      title="Click to set spell"
                      style={{ cursor: "pointer" }}
                    >
                      {concentrationSpell ? concentrationSpell : "Concentrating"}
                    </span>
                  ) : conditionDisplayLabel(cond)}
                  <button
                    onClick={() => {
                      toggleCondition(cond.key);
                      if (cond.key === "concentration") {
                        onConcentrationSpellChange?.(null);
                        setConcentrationPickerOpen(false);
                      }
                    }}
                    style={{ border: "none", background: "transparent", color: C.red, cursor: "pointer", fontSize: "var(--fs-body)", lineHeight: 1, padding: 0, display: "inline-flex", alignItems: "center" }}
                  >×</button>
                </span>
              ))}
            </div>
          </div>
        )}

      </Panel>

      <CharacterConcentrationPickerModal
        open={concentrationPickerOpen}
        accentColor={accentColor}
        currentSpell={concentrationSpell}
        search={concentrationSearch}
        spells={concentrationSpells}
        loading={concentrationSpellsLoading}
        loadError={concentrationSpellsError}
        onSearchChange={setConcentrationSearch}
        onSelect={(spellName) => {
          onConcentrationSpellChange?.(spellName);
          setConcentrationPickerOpen(false);
        }}
        onClose={() => setConcentrationPickerOpen(false)}
      />

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
