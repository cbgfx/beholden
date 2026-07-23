import React from "react";

import { C } from "@/lib/theme";
import { Select } from "@/ui/Select";
import { NavButtons } from "../shared/CharacterCreatorParts";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  profChipStyle,
  smallBtnStyle,
  sourceTagStyle,
} from "../shared/CharacterCreatorStyles";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  STANDARD_ARRAY,
} from "@/views/character-creator/constants/CharacterCreatorConstants";
import { abilityMod } from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  deriveRaceAbilityBonuses,
  getPrimaryAbilityKeys,
  pointBuySpent,
  resolvedScores,
  type FormState,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { buildProficiencyMap as buildProficiencyMapFromUtils } from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";

interface TaggedItemLike {
  name: string;
  source: string;
}

function renderAbilityScoresStep({
  form,
  setAbilityMethod,
  setStandardAssign,
  setPointBuyScore,
  usedIndices,
  remaining,
  primaryKeys,
  bgBonuses,
  hasBgBonuses,
  backgroundName,
  abilityLabels,
  abilityKeys,
  standardArray,
  pointBuyBudget,
  pointBuyCosts,
  abilityMod,
  onBack,
  onNext,
  side,
}: {
  form: Record<string, any>;
  setAbilityMethod: (method: "standard" | "pointbuy") => void;
  setStandardAssign: (key: string, idx: number) => void;
  setPointBuyScore: (key: string, score: number) => void;
  usedIndices: number[];
  remaining: number;
  primaryKeys: string[];
  bgBonuses: Record<string, number>;
  hasBgBonuses: boolean;
  backgroundName: string | undefined;
  abilityLabels: Record<string, string>;
  abilityKeys: readonly string[];
  standardArray: number[];
  pointBuyBudget: number;
  pointBuyCosts: Record<number, number>;
  abilityMod: (score: number) => number;
  onBack: () => void;
  onNext: () => void;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  function AbilityLabel({ k }: { k: string }) {
    const bonus = bgBonuses[k];
    const isPrimary = primaryKeys.includes(k);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ color: isPrimary ? C.colorGold : C.muted, fontSize: "var(--fs-small)", fontWeight: isPrimary ? 800 : 600 }}>{abilityLabels[k]}</span>
        {isPrimary ? <span style={{ fontSize: "var(--fs-tiny)", color: C.colorGold, opacity: 0.75 }}>★ Primary</span> : null}
        {bonus != null ? (
          <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "rgba(167,139,250,0.18)", border: "1px solid rgba(167,139,250,0.4)", color: C.colorMagic }}>
            +{bonus} {backgroundName ?? "bg"}
          </span>
        ) : null}
      </div>
    );
  }

  const main = (
    <div>
      <h2 style={headingStyle}>Ability Scores</h2>
      {hasBgBonuses ? (
        <div style={{ ...detailBoxStyle, marginBottom: 16, padding: "10px 14px" }}>
          <span style={{ fontSize: "var(--fs-small)", color: C.colorMagic }}>
            Background bonuses applied: {Object.entries(bgBonuses).map(([k, v]) => `${abilityLabels[k]} +${v}`).join(", ")}
          </span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {(["standard", "pointbuy"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setAbilityMethod(m)}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${form.abilityMethod === m ? C.accentHl : "rgba(255,255,255,0.14)"}`,
              background: form.abilityMethod === m ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
              color: form.abilityMethod === m ? C.accentHl : "rgba(160,180,220,0.7)",
              fontWeight: form.abilityMethod === m ? 700 : 500,
              fontSize: "var(--fs-subtitle)",
            }}
          >
            {m === "standard" ? "Standard Array" : "Point Buy"}
          </button>
        ))}
      </div>

      {form.abilityMethod === "standard" ? (
        <div>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 12 }}>Assign each value to one ability: {standardArray.join(", ")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {abilityKeys.map((k) => {
              const assigned = form.standardAssign[k];
              const baseVal = assigned >= 0 ? standardArray[assigned] : undefined;
              const totalVal = baseVal != null ? baseVal + (bgBonuses[k] ?? 0) : undefined;
              return (
                <div key={k} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`, background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent" }}>
                  <AbilityLabel k={k} />
                  <Select value={assigned >= 0 ? String(assigned) : ""} onChange={(e) => setStandardAssign(k, e.target.value === "" ? -1 : Number(e.target.value))} style={{ width: "100%" }}>
                    <option value="">—</option>
                    {standardArray.map((v, i) => (!usedIndices.includes(i) || i === assigned ? <option key={i} value={String(i)}>{v}</option> : null))}
                  </Select>
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2, textAlign: "center" }}>
                    {totalVal != null ? <>{baseVal !== totalVal ? <span style={{ color: C.colorMagic, marginRight: 4 }}>{totalVal}</span> : null}{`mod ${abilityMod(totalVal) >= 0 ? "+" : ""}${abilityMod(totalVal)}`}</> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {form.abilityMethod === "pointbuy" ? (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
            <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>Points remaining:</span>
            <span style={{ fontWeight: 700, color: remaining < 0 ? C.red : C.accentHl }}>{remaining} / {pointBuyBudget}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {abilityKeys.map((k) => {
              const score = form.pbScores[k] ?? 8;
              const total = score + (bgBonuses[k] ?? 0);
              return (
                <div key={k} style={{ textAlign: "center", padding: "8px", borderRadius: 8, border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`, background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent" }}>
                  <AbilityLabel k={k} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    <button type="button" disabled={score <= 8} onClick={() => setPointBuyScore(k, score - 1)} style={{ ...smallBtnStyle, opacity: score <= 8 ? 0.4 : 1 }}>−</button>
                    <span style={{ fontWeight: 700, minWidth: 24 }}>{score}{bgBonuses[k] ? <span style={{ color: C.colorMagic, fontSize: "var(--fs-small)" }}> ({total})</span> : null}</span>
                    <button type="button" disabled={score >= 15 || remaining < (pointBuyCosts[score + 1] ?? 99) - (pointBuyCosts[score] ?? 0)} onClick={() => setPointBuyScore(k, score + 1)} style={{ ...smallBtnStyle, opacity: (score >= 15 || remaining < (pointBuyCosts[score + 1] ?? 99) - (pointBuyCosts[score] ?? 0)) ? 0.4 : 1 }}>+</button>
                  </div>
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>mod {abilityMod(total) >= 0 ? "+" : ""}{abilityMod(total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <NavButtons step={5} onBack={onBack} onNext={onNext} />
    </div>
  );
  return { main, side };
}

export function renderAbilityScoresFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const usedIndices = Object.values(ctx.form.standardAssign).filter((v) => v >= 0);
  const spent = pointBuySpent(ctx.form.pbScores);
  const remaining = POINT_BUY_BUDGET - spent;
  const primaryKeys = getPrimaryAbilityKeys(ctx.classDetail);
  const bgBonuses = ctx.form.bgAbilityBonuses;
  const hasBgBonuses = Object.keys(bgBonuses).length > 0;

  return renderAbilityScoresStep({
    form: ctx.form,
    setAbilityMethod: (method) => ctx.setField("abilityMethod", method),
    setStandardAssign: (key, idx) => ctx.setForm((f) => ({ ...f, standardAssign: { ...f.standardAssign, [key]: idx } })),
    setPointBuyScore: (key, score) => ctx.setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [key]: score } })),
    usedIndices,
    remaining,
    primaryKeys,
    bgBonuses,
    hasBgBonuses,
    backgroundName: ctx.bgDetail?.name,
    abilityLabels: ABILITY_LABELS,
    abilityKeys: ABILITY_KEYS,
    standardArray: STANDARD_ARRAY,
    pointBuyBudget: POINT_BUY_BUDGET,
    pointBuyCosts: POINT_BUY_COSTS,
    abilityMod,
    onBack: () => ctx.setStep(4),
    onNext: () => ctx.setStep(6),
    side: ctx.sideSummary,
  });
}

function renderDerivedStatsStep({
  level,
  hpMax,
  ac,
  speed,
  setField,
  hd,
  conMod,
  dexMod,
  raceSpeed,
  sections,
  onBack,
  onNext,
  side,
}: {
  level: number;
  hpMax: string | number;
  ac: string | number;
  speed: string | number;
  setField: (key: "hpMax" | "ac" | "speed", value: string) => void;
  hd: number;
  conMod: number;
  dexMod: number;
  raceSpeed: number;
  sections: Array<{ label: string; items: TaggedItemLike[] }>;
  onBack: () => void;
  onNext: () => void;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  const hpPerLaterLevel = Math.floor(hd / 2) + 1;
  const conLabel = conMod >= 0 ? `+ ${conMod} CON` : `- ${Math.abs(conMod)} CON`;
  const hpFormulaLabel = level <= 1
    ? `Level 1: ${hd} ${conLabel}`
    : `Level 1: ${hd} ${conLabel}; later levels: ${hpPerLaterLevel} ${conLabel}`;
  const dexBaseAc = 10 + dexMod;
  const acFormulaLabel = Number(ac) > dexBaseAc
    ? `${ac} (a class or species feature raised this above 10 ${dexMod >= 0 ? "+" : ""}${dexMod} DEX)`
    : `10 + ${dexMod >= 0 ? "+" : ""}${dexMod} DEX (base)`;
  const main = (
    <div>
      <h2 style={headingStyle}>Combat Stats</h2>
      <p style={{ color: C.muted, marginBottom: 16 }}>Auto-calculated from your choices — HP Max and Armor Class can be overridden.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>HP Max</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>{hpFormulaLabel}</div>
          <input type="number" value={hpMax} onChange={(e) => setField("hpMax", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div>
          <label style={labelStyle}>Armor Class</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>{acFormulaLabel}</div>
          <input type="number" value={ac} onChange={(e) => setField("ac", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div>
          <label style={labelStyle}>Speed (ft)</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>From species ({raceSpeed} ft)</div>
          <div style={{ ...inputStyle, width: "100%", opacity: 0.6, cursor: "default" }}>{speed}</div>
        </div>
      </div>
      {sections.length > 0 ? (
        <div style={{ ...detailBoxStyle, marginTop: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "var(--fs-subtitle)" }}>Your Proficiencies</div>
          {sections.map((section) => (
            <div key={section.label} style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>{section.label}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {section.items.map((item, index) => (
                  <span key={`${section.label}:${item.name}:${item.source}:${index}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={profChipStyle}>{item.name}</span>
                    {String(item.source ?? "").trim() ? <span style={sourceTagStyle}>{item.source}</span> : null}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <NavButtons step={9} onBack={onBack} onNext={onNext} />
    </div>
  );
  return { main, side };
}

export function renderDerivedStatsFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const raceAbilityBonuses = deriveRaceAbilityBonuses(ctx.raceDetail, ctx.raceDetail?.parsedChoices?.abilityScoreChoice, ctx.form);
  const scores = resolvedScores(ctx.form, ctx.selectedFeatAbilityBonuses, raceAbilityBonuses);
  const conMod = abilityMod(scores.con ?? 10);
  const dexMod = abilityMod(scores.dex ?? 10);
  const hd = ctx.effectiveHitDie;
  const prof: ProficiencyMap = buildProficiencyMapFromUtils({
    form: ctx.form,
    classDetail: ctx.classDetail,
    raceDetail: ctx.raceDetail,
    bgDetail: ctx.bgDetail,
    classCantrips: ctx.classCantrips,
    classSpells: ctx.classSpells,
    classInvocations: ctx.classInvocations,
    bgOriginFeatDetail: ctx.bgOriginFeatDetail,
    raceFeatDetail: ctx.raceFeatDetail,
    classFeatDetails: ctx.classFeatDetails,
    levelUpFeatDetails: ctx.levelUpFeatDetails,
    spellChoiceOptionsByKey: ctx.featSpellChoiceOptions,
    itemChoiceOptionsByKey: ctx.growthOptionEntriesByKey,
  });
  const sections = [
    { label: "Skills", items: prof.skills },
    { label: "Expertise", items: prof.expertise },
    { label: "Saves", items: prof.saves },
    { label: "Armor", items: prof.armor },
    { label: "Weapons", items: prof.weapons },
    { label: "Tools", items: prof.tools },
    { label: "Languages", items: prof.languages },
    { label: "Maneuvers", items: prof.maneuvers },
    { label: "Metamagic", items: prof.metamagic },
    { label: "Magic Item Plans", items: prof.plans },
    { label: "Spells", items: prof.spells },
    { label: "Invocations", items: prof.invocations },
  ].filter((s) => s.items.length > 0);

  return renderDerivedStatsStep({
    level: ctx.form.level,
    hpMax: ctx.form.hpMax,
    ac: ctx.form.ac,
    speed: ctx.form.speed,
    setField: (key, value) => ctx.setField(key as keyof FormState, value as never),
    hd,
    conMod,
    dexMod,
    raceSpeed: ctx.raceDetail?.speed ?? 30,
    sections,
    onBack: () => ctx.setStep(8),
    onNext: () => ctx.setStep(10),
    side: ctx.sideSummary,
  });
}
