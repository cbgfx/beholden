import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import { IconPlayer, IconShield, IconSpeed, IconHeart, IconInitiative, IconConditions, IconAttack, IconHeal, IconConditionByKey } from "@/icons";
import { rollDiceExpr, hasDiceTerm } from "@/lib/dice";
import { useWs } from "@/services/ws";
import { Select } from "@/ui/Select";
import { useItemSearch } from "@/views/CompendiumView/hooks/useItemSearch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaggedItem { name: string; source: string }
interface ProficiencyMap {
  skills: TaggedItem[];
  saves: TaggedItem[];
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  languages: TaggedItem[];
  spells: TaggedItem[];
  invocations: TaggedItem[];
}

interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  notes?: string;
  source?: "compendium" | "custom";
  itemId?: string;
  rarity?: string | null;
  type?: string | null;
  attunement?: boolean;
  magic?: boolean;
  description?: string;
}

interface InventoryPickerPayload {
  source: "compendium" | "custom";
  name: string;
  quantity: number;
  itemId?: string;
  rarity?: string | null;
  type?: string | null;
  attunement?: boolean;
  magic?: boolean;
  description?: string;
}

interface CompendiumItemDetail {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  attunement: boolean;
  magic: boolean;
  text: string | string[];
}

interface CharacterData {
  classId?: string;
  raceId?: string;
  bgId?: string;
  subclass?: string | null;
  abilityMethod?: string;
  hd?: number | null;
  chosenOptionals?: string[];
  chosenSkills?: string[];
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  proficiencies?: ProficiencyMap;
  inventory?: InventoryItem[];
}

interface ConditionInstance {
  key: string;
  [k: string]: unknown;
}

interface Character {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: CharacterData | null;
  campaigns: CharacterCampaign[];
  conditions?: ConditionInstance[];
  overrides?: { tempHp: number; acBonus: number; hpMaxBonus: number };
  deathSaves?: { success: number; fail: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilKey = typeof ABILITY_KEYS[number];

const ABILITY_LABELS: Record<AbilKey, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};
const ABILITY_FULL: Record<AbilKey, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

const ALL_SKILLS: { name: string; abil: AbilKey }[] = [
  { name: "Acrobatics",      abil: "dex" },
  { name: "Animal Handling", abil: "wis" },
  { name: "Arcana",          abil: "int" },
  { name: "Athletics",       abil: "str" },
  { name: "Deception",       abil: "cha" },
  { name: "History",         abil: "int" },
  { name: "Insight",         abil: "wis" },
  { name: "Intimidation",    abil: "cha" },
  { name: "Investigation",   abil: "int" },
  { name: "Medicine",        abil: "wis" },
  { name: "Nature",          abil: "int" },
  { name: "Perception",      abil: "wis" },
  { name: "Performance",     abil: "cha" },
  { name: "Persuasion",      abil: "cha" },
  { name: "Religion",        abil: "int" },
  { name: "Sleight of Hand", abil: "dex" },
  { name: "Stealth",         abil: "dex" },
  { name: "Survival",        abil: "wis" },
];

const CONDITIONS = [
  { key: "blinded",       name: "Blinded" },
  { key: "charmed",       name: "Charmed" },
  { key: "deafened",      name: "Deafened" },
  { key: "frightened",    name: "Frightened" },
  { key: "grappled",      name: "Grappled" },
  { key: "incapacitated", name: "Incapacitated" },
  { key: "invisible",     name: "Invisible" },
  { key: "paralyzed",     name: "Paralyzed" },
  { key: "petrified",     name: "Petrified" },
  { key: "poisoned",      name: "Poisoned" },
  { key: "prone",         name: "Prone" },
  { key: "restrained",    name: "Restrained" },
  { key: "stunned",       name: "Stunned" },
  { key: "unconscious",   name: "Unconscious" },
  { key: "concentration", name: "Concentration" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mod(score: number | null): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}
function fmtMod(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}
function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
function isProficientIn(list: TaggedItem[], name: string): boolean {
  return list.some((s) => s.name.toLowerCase() === name.toLowerCase());
}
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CharacterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [char, setChar] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hpAmount, setHpAmount] = useState("");
  const [hpSaving, setHpSaving] = useState(false);
  const [hpError, setHpError] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const flashRef = useRef<number | null>(null);
  const hpInputRef = useRef<HTMLInputElement>(null);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [condSaving, setCondSaving] = useState(false);
  const [dsSaving, setDsSaving] = useState(false);

  const fetchChar = useCallback(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then(setChar)
      .catch((e) => setError(e?.message ?? "Failed to load character"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchChar(); }, [fetchChar]);

  // Re-fetch whenever the DM changes something in any campaign this character is in
  useWs(useCallback((msg) => {
    if (msg.type !== "players:changed") return;
    const campaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (!campaignId) return;
    // Only reload if this character is actually assigned to that campaign
    setChar((prev) => {
      if (prev?.campaigns.some((c) => c.campaignId === campaignId)) {
        fetchChar();
      }
      return prev; // state unchanged — fetchChar will update it
    });
  }, [fetchChar]));

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const prof = char.characterData?.proficiencies;
  const pb = profBonus(char.level);
  const hd = char.characterData?.hd ?? null;

  const scores: Record<AbilKey, number | null> = {
    str: char.strScore, dex: char.dexScore, con: char.conScore,
    int: char.intScore, wis: char.wisScore, cha: char.chaScore,
  };

  const accentColor = char.color ?? C.accentHl;
  const overrides = char.overrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const effectiveHpMax = Math.max(1, char.hpMax + (overrides.hpMaxBonus ?? 0));
  const effectiveAc = char.ac + (overrides.acBonus ?? 0);
  const tempHp = overrides.tempHp ?? 0;
  const hpPct = effectiveHpMax > 0 ? Math.max(0, Math.min(1, char.hpCurrent / effectiveHpMax)) : 0;
  const tempPct = effectiveHpMax > 0 ? Math.min(1 - hpPct, tempHp / effectiveHpMax) : 0;
  const passivePerc = 10 + mod(char.wisScore) + (prof && isProficientIn(prof.skills, "Perception") ? pb : 0);
  const passiveInv  = 10 + mod(char.intScore) + (prof && isProficientIn(prof.skills, "Investigation") ? pb : 0);

  function rollAndFlash(): number {
    const result = rollDiceExpr(hpAmount.trim());
    if (hasDiceTerm(hpAmount)) {
      setHpAmount(String(result));
      setLastRoll(result);
      if (flashRef.current) window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => setLastRoll(null), 1600);
      hpInputRef.current?.focus();
    }
    return result;
  }

  async function applyHp(kind: "damage" | "heal", resolvedAmt?: number) {
    const amt = resolvedAmt ?? rollDiceExpr(hpAmount.trim());
    if (amt <= 0) {
      setHpError("Enter a number > 0  (e.g. 8, 2d6+3, +5)");
      return;
    }
    if (!char) return;
    setHpError(null);
    const newHp = kind === "heal"
      ? Math.min(char.hpCurrent + amt, effectiveHpMax)
      : Math.max(0, char.hpCurrent - amt);
    setHpSaving(true);
    try {
      await api(`/api/me/characters/${char.id}`, jsonInit("PUT", { hpCurrent: newHp }));
      setChar((prev) => prev ? { ...prev, hpCurrent: newHp } : prev);
      setHpAmount("");
      setLastRoll(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setHpError(`Failed: ${msg}`);
      console.error("HP update failed:", e);
    } finally {
      setHpSaving(false);
    }
  }

  /** If the expression starts with '+', auto-treat as heal. */
  function resolveKind(explicit: "damage" | "heal"): "damage" | "heal" {
    if (hpAmount.trim().startsWith("+")) return "heal";
    return explicit;
  }

  function handleApplyHp(explicit: "damage" | "heal") {
    const kind = resolveKind(explicit);
    if (hasDiceTerm(hpAmount)) {
      const rolled = rollAndFlash();
      // apply on next tick so the rolled value flashes first
      setTimeout(() => applyHp(kind, rolled), 0);
    } else {
      applyHp(kind);
    }
  }

  async function saveDeathSaves(next: { success: number; fail: number }) {
    if (!char) return;
    setDsSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/deathSaves`, jsonInit("PATCH", next));
      setChar((prev) => prev ? { ...prev, deathSaves: next } : prev);
    } catch (e) {
      console.error("Death saves update failed:", e);
    } finally {
      setDsSaving(false);
    }
  }

  async function toggleCondition(key: string) {
    if (!char) return;
    const current = char.conditions ?? [];
    const has = current.some((c) => c.key === key);
    const next = has ? current.filter((c) => c.key !== key) : [...current, { key }];
    setCondSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/conditions`, jsonInit("PATCH", { conditions: next }));
      setChar((prev) => prev ? { ...prev, conditions: next } : prev);
    } finally { setCondSaving(false); }
  }

  async function saveCharacterData(updatedData: CharacterData) {
    const updated = await api<Character>(`/api/me/characters/${char!.id}`, jsonInit("PUT", {
      name: char!.name,
      characterData: { ...char!.characterData, ...updatedData },
    }));
    setChar((prev) => prev ? { ...prev, characterData: { ...prev.characterData, ...updatedData } } : prev);
    return updated;
  }

  return (
    <Wrap>
      {/* ── Character header / HUD ───────────────────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "18px 20px", marginBottom: 20,
      }}>
        {/* Top row: portrait + info + edit */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 12, flexShrink: 0,
            background: `${accentColor}22`, border: `2px solid ${accentColor}66`,
            overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {char.imageUrl
              ? <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <IconPlayer size={36} style={{ opacity: 0.35 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 900, letterSpacing: -0.5, color: C.text }}>
              {char.name}
            </h1>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 3 }}>
              {[char.className, char.characterData?.subclass, char.species].filter(Boolean).join(" · ")}
              <span style={{ marginLeft: 10, color: accentColor, fontWeight: 700, fontSize: 12 }}>Level {char.level}</span>
            </div>
            {char.playerName && (
              <div style={{ fontSize: 11, color: "rgba(160,180,220,0.45)", marginBottom: 3 }}>Player: {char.playerName}</div>
            )}
            {char.campaigns.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {char.campaigns.map((c) => (
                  <span key={c.id} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                    background: `${accentColor}18`, border: `1px solid ${accentColor}44`, color: accentColor,
                  }}>{c.campaignName}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => navigate(`/characters/${char.id}/edit`)} style={{
            padding: "7px 16px", borderRadius: 8, cursor: "pointer",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)",
            color: C.muted, fontWeight: 600, fontSize: 13, flexShrink: 0,
          }}>✎ Edit</button>
        </div>

        {/* HP bar */}
        <div style={{ height: 32, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden", position: "relative", marginBottom: 8 }}>
          <div style={{ position: "absolute", inset: 0, right: `${(1 - hpPct) * 100}%`, background: hpPct > 0.5 ? C.green : hpPct > 0.25 ? "#f59e0b" : C.red, borderRadius: 8, transition: "right 0.3s, background 0.3s" }} />
          {tempHp > 0 && tempPct > 0 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${hpPct * 100}%`, width: `${tempPct * 100}%`, background: "#f59e0b", opacity: 0.7 }} />
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)", gap: 4 }}>
            <IconHeart size={11} style={{ opacity: 0.8 }} />
            {char.hpCurrent} / {effectiveHpMax}
            {tempHp > 0 && <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>+{tempHp} temp</span>}
            {(overrides.hpMaxBonus ?? 0) !== 0 && <span style={{ fontSize: 10, color: "#f59e0b" }}>(max {(overrides.hpMaxBonus ?? 0) > 0 ? "+" : ""}{overrides.hpMaxBonus})</span>}
          </div>
        </div>

        {/* HP actions — Combat HUD */}
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
            {/* Damage hex */}
            <HexBtn variant="damage" title="Apply damage (Enter)" disabled={hpSaving} onClick={() => handleApplyHp("damage")}>
              <IconAttack size={22} />
            </HexBtn>

            {/* Amount input */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
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
                  if (e.key === "Escape") { setHpAmount(""); setHpError(null); setLastRoll(null); }
                }}
                placeholder="1d6+2 / +10"
                inputMode="text"
                style={{
                  width: 120, textAlign: "center",
                  padding: "10px 12px", borderRadius: 12,
                  border: `1px solid ${hpError ? C.red + "88" : "rgba(255,255,255,0.1)"}`,
                  background: "rgba(255,255,255,0.05)",
                  color: C.text, fontWeight: 900, fontSize: 17, outline: "none",
                  animation: lastRoll !== null ? "playerRollFlash 1.6s ease forwards" : "none",
                }}
              />
              <span style={{ fontSize: 10, color: C.muted, minHeight: 14 }}>
                {lastRoll !== null
                  ? `rolled ${lastRoll}`
                  : hd !== null
                    ? `HD: ${char.level}d${hd}`
                    : ""}
              </span>
            </div>

            {/* Heal hex */}
            <HexBtn variant="heal" title="Apply heal (Shift+Enter)" disabled={hpSaving} onClick={() => handleApplyHp("heal")}>
              <IconHeal size={22} />
            </HexBtn>

            {/* Conditions hex */}
            <HexBtn variant="conditions" title="Add / remove conditions" disabled={false} onClick={() => setCondPickerOpen((o) => !o)}>
              <IconConditions size={22} />
            </HexBtn>
          </div>

          {/* Error / saving feedback */}
          {(hpError || hpSaving) && (
            <div style={{ textAlign: "center", fontSize: 11, color: hpError ? C.red : C.muted }}>
              {hpError ?? "Saving…"}
            </div>
          )}
        </div>

        {/* Mini stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 14 }}>
          <MiniStat
            label="Armor Class"
            value={effectiveAc !== char.ac ? `${effectiveAc} (${fmtMod(overrides.acBonus)})` : String(effectiveAc)}
            accent={accentColor} icon={<IconShield size={11} />}
          />
          <MiniStat label="Speed" value={`${char.speed} ft`} icon={<IconSpeed size={11} />} />
          <MiniStat label="Initiative" value={fmtMod(mod(char.dexScore))} accent={accentColor} icon={<IconInitiative size={11} />} />
          <MiniStat label="Prof. Bonus" value={`+${pb}`} accent={accentColor} />
          <MiniStat label="Passive Perc." value={String(passivePerc)} />
          <MiniStat label="Passive Inv." value={String(passiveInv)} />
        </div>

        {/* Death Saving Throws — only when at 0 HP */}
        {char.hpCurrent === 0 && (
          <div style={{
            margin: "4px 0 10px",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.35)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: C.red, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Death Saving Throws
              </span>
              {dsSaving && <span style={{ fontSize: 9, color: C.muted }}>saving…</span>}
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {/* Successes */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.06em" }}>Success</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((i) => {
                    const filled = i < (char.deathSaves?.success ?? 0);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={dsSaving}
                        onClick={() => {
                          const cur = char.deathSaves?.success ?? 0;
                          const next = cur > i ? i : i + 1;
                          saveDeathSaves({ success: Math.min(3, next), fail: char.deathSaves?.fail ?? 0 });
                        }}
                        style={{
                          width: 22, height: 22, borderRadius: "50%",
                          border: `2px solid ${filled ? "#4ade80" : "rgba(74,222,128,0.3)"}`,
                          background: filled ? "#4ade80" : "transparent",
                          cursor: dsSaving ? "default" : "pointer",
                          padding: 0,
                          transition: "all 120ms",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Skull divider */}
              <span style={{ fontSize: 18, opacity: 0.4 }}>💀</span>

              {/* Failures */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.06em" }}>Failure</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((i) => {
                    const filled = i < (char.deathSaves?.fail ?? 0);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={dsSaving}
                        onClick={() => {
                          const cur = char.deathSaves?.fail ?? 0;
                          const next = cur > i ? i : i + 1;
                          saveDeathSaves({ success: char.deathSaves?.success ?? 0, fail: Math.min(3, next) });
                        }}
                        style={{
                          width: 22, height: 22, borderRadius: "50%",
                          border: `2px solid ${filled ? C.red : "rgba(220,38,38,0.3)"}`,
                          background: filled ? C.red : "transparent",
                          cursor: dsSaving ? "default" : "pointer",
                          padding: 0,
                          transition: "all 120ms",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Status line */}
            {(char.deathSaves?.success ?? 0) >= 3 && (
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "#4ade80", textAlign: "center" }}>
                ✦ Stable — character has stabilised
              </div>
            )}
            {(char.deathSaves?.fail ?? 0) >= 3 && (
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: C.red, textAlign: "center" }}>
                ✦ Dead
              </div>
            )}
          </div>
        )}

        {/* Active conditions — hidden when none */}
        {(char.conditions ?? []).length > 0 && (
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <IconConditions size={10} /> Conditions
              {condSaving && <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", fontSize: 9 }}>saving…</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(char.conditions ?? []).map((cond, i) => (
                <span key={i} style={{
                  fontSize: 12, fontWeight: 700, padding: "4px 6px 4px 8px", borderRadius: 6,
                  background: `${C.red}18`, border: `1px solid ${C.red}44`, color: C.red,
                  textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  <IconConditionByKey condKey={cond.key} size={12} style={{ opacity: 0.85, flexShrink: 0 }} />
                  {CONDITIONS.find((c) => c.key === cond.key)?.name ?? cond.key}
                  <button onClick={() => toggleCondition(cond.key)} style={{
                    border: "none", background: "transparent", color: C.red,
                    cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0,
                    display: "inline-flex", alignItems: "center",
                  }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Condition picker drawer (fixed overlay) ───────────────────────── */}
      {condPickerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setCondPickerOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)" }}
          />
          {/* Drawer panel */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901,
            width: "min(340px, 90vw)",
            background: "#0e1220",
            borderLeft: "1px solid rgba(255,255,255,0.12)",
            display: "flex", flexDirection: "column",
            boxShadow: "-8px 0 30px rgba(0,0,0,0.5)",
          }}>
            {/* Drawer header */}
            <div style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconConditions size={16} style={{ color: "#f59e0b" }} />
                <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f59e0b" }}>
                  Conditions
                </span>
                {condSaving && <span style={{ fontSize: 10, color: C.muted }}>saving…</span>}
              </div>
              <button
                onClick={() => setCondPickerOpen(false)}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 6, color: C.muted, cursor: "pointer",
                  padding: "4px 10px", fontSize: 12, fontWeight: 700,
                }}
              >
                Close
              </button>
            </div>

            {/* Condition grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {CONDITIONS.map((cd) => {
                  const active = (char.conditions ?? []).some((c) => c.key === cd.key);
                  return (
                    <button
                      key={cd.key}
                      onClick={() => toggleCondition(cd.key)}
                      disabled={condSaving}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        padding: "10px 6px", borderRadius: 8,
                        background: active ? `${C.red}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? C.red + "77" : "rgba(255,255,255,0.10)"}`,
                        color: active ? C.red : C.muted,
                        cursor: condSaving ? "wait" : "pointer",
                        transition: "all 120ms",
                        outline: "none",
                      }}
                    >
                      <IconConditionByKey condKey={cd.key} size={22} style={{ opacity: active ? 1 : 0.5 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
                        {cd.name}
                      </span>
                      {active && (
                        <span style={{ fontSize: 9, color: C.red, fontWeight: 900, letterSpacing: "0.04em" }}>ACTIVE</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Two-column body ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* ── LEFT: Abilities + Saves + Skills ─────────────────────── */}
        <div style={{ flex: "0 0 270px", minWidth: 230, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Ability Scores */}
          <Panel>
            <PanelTitle color={accentColor}>Ability Scores</PanelTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {ABILITY_KEYS.map((k) => {
                const score = scores[k];
                const m = mod(score);
                const isSave = prof ? isProficientIn(prof.saves, ABILITY_FULL[k]) : false;
                return (
                  <div key={k} style={{
                    textAlign: "center", padding: "8px 4px", borderRadius: 9,
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${isSave ? accentColor + "55" : "rgba(255,255,255,0.10)"}`,
                    position: "relative",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", marginBottom: 2 }}>
                      {ABILITY_LABELS[k]}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: isSave ? accentColor : C.text }}>
                      {m >= 0 ? "+" : ""}{m}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{score ?? "—"}</div>
                    {isSave && (
                      <div style={{
                        position: "absolute", top: 3, right: 4,
                        width: 5, height: 5, borderRadius: "50%",
                        background: accentColor,
                      }} title="Save proficiency" />
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Saving Throws */}
          <Panel>
            <PanelTitle color={accentColor}>Saving Throws</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {ABILITY_KEYS.map((k) => {
                const isProfSave = prof ? isProficientIn(prof.saves, ABILITY_FULL[k]) : false;
                const bonus = mod(scores[k]) + (isProfSave ? pb : 0);
                const src = prof?.saves.find((s) => s.name.toLowerCase() === ABILITY_FULL[k].toLowerCase())?.source;
                return (
                  <div key={k} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "3px 4px", borderRadius: 5,
                  }}>
                    <ProfDot filled={isProfSave} color={accentColor} />
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, width: 28 }}>
                      {ABILITY_LABELS[k]}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>{ABILITY_FULL[k]}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: "right",
                      color: isProfSave ? accentColor : C.text,
                    }}>
                      {isProfSave && src
                        ? <Tooltip text={src}>{fmtMod(bonus)}</Tooltip>
                        : fmtMod(bonus)
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Skills */}
          <Panel>
            <PanelTitle color={C.green}>Skills</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {ALL_SKILLS.map(({ name, abil }) => {
                const isProfSkill = prof ? isProficientIn(prof.skills, name) : false;
                const bonus = mod(scores[abil]) + (isProfSkill ? pb : 0);
                const src = prof?.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
                return (
                  <div key={name} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "3px 4px", borderRadius: 4,
                  }}>
                    <ProfDot filled={isProfSkill} color={C.green} />
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: "rgba(160,180,220,0.45)",
                      letterSpacing: "0.04em", width: 24, textAlign: "center",
                    }}>
                      {ABILITY_LABELS[abil]}
                    </span>
                    <span style={{
                      fontSize: 12, color: isProfSkill ? C.text : C.muted,
                      flex: 1, fontWeight: isProfSkill ? 600 : 400,
                    }}>
                      {name}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, minWidth: 26, textAlign: "right",
                      color: isProfSkill ? C.green : C.text,
                    }}>
                      {isProfSkill && src
                        ? <Tooltip text={src}>{fmtMod(bonus)}</Tooltip>
                        : fmtMod(bonus)
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

        </div>

        {/* ── RIGHT: Combat + Proficiencies + Spells + Features + Inventory ── */}
        <div style={{ flex: "1 1 360px", minWidth: 280, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Proficiencies */}
          {prof && (() => {
            const sections = [
              { label: "Armor",     items: prof.armor,     color: "#a78bfa" },
              { label: "Weapons",   items: prof.weapons,   color: "#f87171" },
              { label: "Tools",     items: prof.tools,     color: "#fb923c" },
              { label: "Languages", items: prof.languages, color: "#60a5fa" },
            ].filter((s) => s.items.length > 0);
            if (!sections.length) return null;
            return (
              <Panel>
                <PanelTitle color={accentColor}>Proficiencies &amp; Languages</PanelTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sections.map((s) => (
                    <div key={s.label}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                        {s.label}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {s.items.map((item, i) => (
                          <Tooltip key={i} text={item.source}>
                            <span style={{
                              fontSize: 12, padding: "3px 9px", borderRadius: 5, cursor: "default",
                              background: s.color + "18", border: `1px solid ${s.color}44`,
                              color: s.color, fontWeight: 600,
                            }}>
                              {item.name}
                            </span>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })()}

          {/* Spells & Invocations */}
          {prof && (prof.spells.length > 0 || prof.invocations.length > 0) && (
            <Panel>
              <PanelTitle color="#a78bfa">Spells &amp; Invocations</PanelTitle>
              {prof.spells.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Known / Prepared
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {prof.spells.map((sp, i) => (
                      <Tooltip key={i} text={sp.source}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, cursor: "default",
                          background: "rgba(167,139,250,0.14)", border: "1px solid rgba(167,139,250,0.35)",
                          color: "#a78bfa",
                        }}>
                          {sp.name}
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}
              {prof.invocations.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Eldritch Invocations
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {prof.invocations.map((inv, i) => (
                      <Tooltip key={i} text={inv.source}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, cursor: "default",
                          background: "rgba(251,146,60,0.14)", border: "1px solid rgba(251,146,60,0.35)",
                          color: "#fb923c",
                        }}>
                          {inv.name}
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          )}

          {/* Class Features */}
          {char.characterData?.chosenOptionals && char.characterData.chosenOptionals.length > 0 && (
            <Panel>
              <PanelTitle color={C.green}>Class Features</PanelTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {char.characterData.chosenOptionals.map((f) => (
                  <span key={f} style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                    background: "rgba(94,203,107,0.11)", border: "1px solid rgba(94,203,107,0.28)",
                    color: C.green,
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {/* Inventory */}
          <InventoryPanel
            charId={char.id}
            charName={char.name}
            charData={char.characterData}
            accentColor={accentColor}
            onSave={saveCharacterData}
          />

          {/* Back button */}
          <div style={{ paddingTop: 4 }}>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 8, padding: "7px 16px", color: C.muted,
                cursor: "pointer", fontSize: 13,
              }}>
              ← Back
            </button>
          </div>

        </div>
      </div>
    </Wrap>
  );
}

// ---------------------------------------------------------------------------
// Inventory Panel
// ---------------------------------------------------------------------------

function InventoryPanel({ charId, charName, charData, accentColor, onSave }: {
  charId: string;
  charName: string;
  charData: CharacterData | null;
  accentColor: string;
  onSave: (data: CharacterData) => Promise<unknown>;
}) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    (charData?.inventory ?? []) as InventoryItem[]
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function persist(updated: InventoryItem[]) {
    setSaving(true);
    try {
      await onSave({ inventory: updated });
      setItems(updated);
    } finally {
      setSaving(false);
    }
  }

  async function addItem(payload?: InventoryPickerPayload) {
    const legacyName = newName.trim();
    const next = payload ?? {
      source: "custom" as const,
      name: legacyName,
      quantity: newQty,
      description: newNotes.trim() || undefined,
    };
    if (!next.name) return;
    const item: InventoryItem = {
      id: uid(),
      name: next.name,
      quantity: Math.max(1, next.quantity),
      equipped: false,
      source: next.source,
      itemId: next.itemId,
      rarity: next.rarity ?? null,
      type: next.type ?? null,
      attunement: next.attunement ?? false,
      magic: next.magic ?? false,
      description: next.description?.trim() || undefined,
    };
    await persist([...items, item]);
    setAdding(false);
    setNewName("");
    setNewQty(1);
    setNewNotes("");
    setPickerOpen(false);
  }

  async function toggleEquipped(id: string) {
    await persist(items.map((it) => it.id === id ? { ...it, equipped: !it.equipped } : it));
  }

  async function removeItem(id: string) {
    await persist(items.filter((it) => it.id !== id));
  }

  async function changeQty(id: string, delta: number) {
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      const q = Math.max(1, it.quantity + delta);
      return { ...it, quantity: q };
    });
    await persist(updated);
  }

  const equipped = items.filter((it) => it.equipped);
  const backpack = items.filter((it) => !it.equipped);

  return (
    <Panel>
      <PanelTitle color="#fbbf24">
        Inventory
        {saving && <span style={{ fontSize: 9, color: C.muted, marginLeft: 6, fontWeight: 400, textTransform: "none" }}>saving…</span>}
      </PanelTitle>

      {/* Equipped */}
      {equipped.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>Equipped</div>
          {equipped.map((it) => (
            <ItemRow key={it.id} item={it} accentColor={accentColor}
              onToggle={toggleEquipped} onRemove={removeItem} onQty={changeQty} />
          ))}
        </div>
      )}

      {/* Backpack */}
      {backpack.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>{equipped.length > 0 ? "Backpack" : "Items"}</div>
          {backpack.map((it) => (
            <ItemRow key={it.id} item={it} accentColor={accentColor}
              onToggle={toggleEquipped} onRemove={removeItem} onQty={changeQty} />
          ))}
        </div>
      )}

      {/* Inventory add controls */}
      {false ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: items.length > 0 ? 10 : 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={nameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder="Item name…"
              autoFocus
              style={inputStyle}
            />
            <input
              type="number"
              value={newQty}
              min={1}
              onChange={(e) => setNewQty(Number(e.target.value))}
              style={{ ...inputStyle, width: 56, textAlign: "center" }}
            />
          </div>
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)…"
            style={{ ...inputStyle, fontSize: 11, color: C.muted }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { void addItem(); }} disabled={!newName.trim()} style={addBtnStyle(accentColor)}>
              Add
            </button>
            <button onClick={() => { setAdding(false); setNewName(""); setNewQty(1); setNewNotes(""); }} style={cancelBtnStyle}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setPickerOpen(true); }}
          style={{
            marginTop: items.length > 0 ? 8 : 0,
            background: "transparent",
            border: "1px dashed rgba(255,255,255,0.18)",
            borderRadius: 7, padding: "5px 12px",
            color: C.muted, fontSize: 12, cursor: "pointer",
            width: "100%",
          }}>
          + Add item
        </button>
      )}

      <InventoryItemPickerModal
        isOpen={pickerOpen}
        accentColor={accentColor}
        onClose={() => setPickerOpen(false)}
        onAdd={addItem}
      />
    </Panel>
  );
}

function ItemRow({ item, accentColor, onToggle, onRemove, onQty }: {
  item: InventoryItem;
  accentColor: string;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onQty: (id: string, delta: number) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 2px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      {/* Equip toggle */}
      <button
        onClick={() => onToggle(item.id)}
        title={item.equipped ? "Unequip" : "Equip"}
        style={{
          width: 14, height: 14, borderRadius: "50%", flexShrink: 0, padding: 0,
          border: `1.5px solid ${item.equipped ? accentColor : "rgba(255,255,255,0.3)"}`,
          background: item.equipped ? accentColor : "transparent",
          cursor: "pointer",
        }}
      />

      {/* Name + notes */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: C.text, fontWeight: item.equipped ? 600 : 400 }}>
          {item.name}
        </span>
        {(item.rarity || item.type || item.attunement || item.magic) && (
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
            {[
              item.rarity ? titleCase(item.rarity) : null,
              item.type ?? null,
              item.attunement ? "Attunement" : null,
              item.magic ? "Magic" : null,
            ].filter(Boolean).join(" • ")}
          </div>
        )}
        {item.notes && (
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>{item.notes}</span>
        )}
      </div>

      {/* Quantity stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {item.quantity > 1 && (
          <button onClick={() => onQty(item.id, -1)} style={stepperBtn}>−</button>
        )}
        {item.quantity > 1 && (
          <span style={{ fontSize: 12, color: C.muted, minWidth: 20, textAlign: "center" }}>
            ×{item.quantity}
          </span>
        )}
        <button onClick={() => onQty(item.id, +1)} style={stepperBtn}>+</button>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        title="Remove"
        style={{
          background: "transparent", border: "none",
          color: "rgba(255,255,255,0.22)", cursor: "pointer",
          fontSize: 15, padding: "0 2px", lineHeight: 1, flexShrink: 0,
        }}>
        ×
      </button>
    </div>
  );
}

function InventoryItemPickerModal(props: {
  isOpen: boolean;
  accentColor: string;
  onClose: () => void;
  onAdd: (payload?: InventoryPickerPayload) => void;
}) {
  const {
    q, setQ,
    rarityFilter, setRarityFilter, rarityOptions,
    typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement,
    filterMagic, setFilterMagic,
    hasActiveFilters, clearFilters,
    rows, busy,
  } = useItemSearch();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompendiumItemDetail | null>(null);
  const [qty, setQty] = useState(1);
  const [createMode, setCreateMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customRarity, setCustomRarity] = useState("");
  const [customType, setCustomType] = useState("");
  const [customAttunement, setCustomAttunement] = useState(false);
  const [customMagic, setCustomMagic] = useState(false);
  const [customDescription, setCustomDescription] = useState("");

  useEffect(() => {
    if (!props.isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  useEffect(() => {
    if (!props.isOpen) {
      setSelectedId(null);
      setDetail(null);
      setQty(1);
      setCreateMode(false);
      setCustomName("");
      setCustomRarity("");
      setCustomType("");
      setCustomAttunement(false);
      setCustomMagic(false);
      setCustomDescription("");
    }
  }, [props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || createMode || !selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    api<CompendiumItemDetail>(`/api/compendium/items/${selectedId}`)
      .then((data) => { if (alive) setDetail(data); })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [props.isOpen, createMode, selectedId]);

  if (!props.isOpen) return null;

  const detailText = detail
    ? (Array.isArray(detail.text) ? detail.text.join("\n\n") : detail.text ?? "")
    : "";

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(4, 8, 18, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "min(760px, calc(100vh - 40px))",
          background: C.bg,
          border: `1px solid ${C.panelBorder}`,
          borderRadius: 16,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          display: "grid",
          gridTemplateColumns: "minmax(320px, 380px) minmax(0, 1fr)",
          gap: 12,
          padding: 12,
        }}
      >
        <div style={inventoryPickerColumnStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fbbf24" }}>
              Browse Items
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateMode((v) => !v);
                setSelectedId(null);
              }}
              style={{
                border: `1px solid ${createMode ? props.accentColor : C.panelBorder}`,
                background: createMode ? `${props.accentColor}22` : "transparent",
                color: createMode ? props.accentColor : C.muted,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {createMode ? "Browse" : "Create New"}
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items..."
            style={inputStyle}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} style={{ width: "100%" }}>
              {rarityOptions.map((r) => (
                <option key={r} value={r}>{r === "all" ? "All Rarities" : titleCase(r)}</option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }}>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
              ))}
            </Select>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={toggleFilterPill(filterAttunement, props.accentColor)}>
              Attunement
            </button>
            <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={toggleFilterPill(filterMagic, props.accentColor)}>
              Magic
            </button>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} style={toggleFilterPill(false, props.accentColor)}>
                Clear
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: C.muted }}>
            {busy ? "Loading..." : `${rows.length} items`}
          </div>

          <div style={inventoryPickerListStyle}>
            {!busy && rows.length === 0 && (
              <div style={{ padding: 12, color: C.muted }}>No items found.</div>
            )}
            {rows.map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setCreateMode(false);
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: `1px solid ${C.panelBorder}`,
                    background: active ? `${props.accentColor}18` : "transparent",
                    color: C.text,
                    textAlign: "left",
                    padding: "10px 12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {item.rarity && <span style={{ width: 7, height: 7, borderRadius: "50%", background: inventoryRarityColor(item.rarity), flexShrink: 0 }} />}
                    <span style={{ fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </span>
                    {item.magic && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa" }}>Magic</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {[item.rarity ? titleCase(item.rarity) : null, item.type, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={inventoryPickerColumnStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
              {createMode ? "Create Item" : detail?.name ?? "Select an item"}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))} style={stepperBtn}>−</button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                style={{ ...inputStyle, width: 64, textAlign: "center", flex: "0 0 auto" }}
              />
              <button type="button" onClick={() => setQty((v) => v + 1)} style={stepperBtn}>+</button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (createMode) {
                  const name = customName.trim();
                  if (!name) return;
                  props.onAdd({
                    source: "custom",
                    name,
                    quantity: qty,
                    rarity: customRarity.trim() || null,
                    type: customType.trim() || null,
                    attunement: customAttunement,
                    magic: customMagic,
                    description: customDescription.trim() || undefined,
                  });
                  return;
                }
                if (!detail) return;
                props.onAdd({
                  source: "compendium",
                  name: detail.name,
                  quantity: qty,
                  itemId: detail.id,
                  rarity: detail.rarity,
                  type: detail.type,
                  attunement: detail.attunement,
                  magic: detail.magic,
                  description: detailText,
                });
              }}
              disabled={createMode ? !customName.trim() : !detail}
              style={addBtnStyle(props.accentColor)}
            >
              Add
            </button>
            <button type="button" onClick={props.onClose} style={cancelBtnStyle}>
              Close
            </button>
          </div>

          {createMode ? (
            <>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Item name"
                style={inputStyle}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={customRarity}
                  onChange={(e) => setCustomRarity(e.target.value)}
                  placeholder="Rarity"
                  style={inputStyle}
                />
                <input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Type"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <label style={inventoryCheckboxLabel}>
                  <input type="checkbox" checked={customAttunement} onChange={(e) => setCustomAttunement(e.target.checked)} />
                  Requires Attunement
                </label>
                <label style={inventoryCheckboxLabel}>
                  <input type="checkbox" checked={customMagic} onChange={(e) => setCustomMagic(e.target.checked)} />
                  Magic Item
                </label>
              </div>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Description or notes..."
                rows={12}
                style={{ ...inputStyle, resize: "vertical", minHeight: 220, fontFamily: "inherit", lineHeight: 1.5 }}
              />
            </>
          ) : detail ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detail.magic && <InventoryTag label="Magic" color="#a78bfa" />}
                {detail.attunement && <InventoryTag label="Attunement" color={props.accentColor} />}
                {detail.rarity && <InventoryTag label={titleCase(detail.rarity)} color={inventoryRarityColor(detail.rarity)} />}
                {detail.type && <InventoryTag label={detail.type} color={C.muted} />}
              </div>
              <div style={inventoryPickerDetailStyle}>
                {detailText || <span style={{ color: C.muted }}>No description.</span>}
              </div>
            </>
          ) : (
            <div style={{ color: C.muted, lineHeight: 1.5 }}>
              Pick a compendium item on the left, or switch to <strong>Create New</strong> to add a custom entry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 999,
      color,
      border: `1px solid ${color}44`,
      background: `${color}18`,
    }}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  if (!text) return <>{children}</>;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 5px)", left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(10,15,28,0.97)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 6, padding: "4px 8px",
          fontSize: 11, color: "rgba(160,180,220,0.85)",
          whiteSpace: "nowrap", zIndex: 200, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "28px 20px" }}>
        {children}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 12, padding: "14px 16px",
    }}>
      {children}
    </div>
  );
}

function PanelTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.1em", color,
      marginBottom: 10,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: `${color}30` }} />
    </div>
  );
}

function ProfDot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: filled ? color : "transparent",
      border: `1.5px solid ${filled ? color : "rgba(255,255,255,0.2)"}`,
    }} />
  );
}

function HexBtn({ variant, title, disabled, onClick, children }: {
  variant: "damage" | "heal" | "conditions";
  title: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const bg = variant === "damage" ? C.red : variant === "heal" ? C.green : "#f59e0b";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 56, height: 52,
        display: "grid", placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "2px solid rgba(255,255,255,0.1)",
        background: bg, color: "#fff",
        clipPath: "polygon(25% 4%, 75% 4%, 98% 50%, 75% 96%, 25% 96%, 2% 50%)",
        boxShadow: disabled ? "none" : "0 2px 0 0 rgba(0,0,0,0.3)",
        animation: disabled ? "none" : "playerHexPulse 2.2s ease-in-out infinite",
        opacity: disabled ? 0.4 : 1,
        transition: "transform 80ms ease, opacity 150ms ease",
        userSelect: "none",
      }}
      onMouseDown={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      textAlign: "center", padding: "8px 6px", borderRadius: 8,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accent ? accent + "33" : "rgba(255,255,255,0.09)"}`,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 3,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
      }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: accent ?? C.text }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const subLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.muted,
  textTransform: "uppercase", letterSpacing: "0.07em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 7, padding: "6px 10px",
  color: C.text, fontSize: 13, outline: "none",
};

const stepperBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 4, width: 20, height: 20,
  color: C.muted, cursor: "pointer", fontSize: 13,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};

function addBtnStyle(accent: string): React.CSSProperties {
  return {
    background: accent, color: "#000",
    border: "none", borderRadius: 7,
    padding: "6px 14px", fontSize: 13,
    fontWeight: 700, cursor: "pointer",
  };
}

const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 7, padding: "6px 14px",
  fontSize: 13, color: C.muted, cursor: "pointer",
};

const inventoryCheckboxLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: C.muted,
};

const inventoryPickerColumnStyle: React.CSSProperties = {
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  padding: 12,
  gap: 10,
};

const inventoryPickerListStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 220,
  overflowY: "auto",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
};

const inventoryPickerDetailStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 260,
  overflowY: "auto",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
  padding: 12,
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
  fontSize: 13,
  color: C.text,
};

function inventoryRarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common": return C.muted;
    case "uncommon": return "#1eff00";
    case "rare": return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact": return "#e6cc80";
    default: return C.muted;
  }
}

function toggleFilterPill(active: boolean, accentColor: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? accentColor : C.panelBorder}`,
    background: active ? `${accentColor}18` : "rgba(255,255,255,0.04)",
    color: active ? accentColor : C.muted,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  };
}
