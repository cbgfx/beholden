import { translateUi } from "@/i18n";
import { useUiTranslation, UiText } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";

import { C, withAlpha } from "@/lib/theme";
import { Select } from "@/ui/Select";
import { IconButton } from "@/ui/IconButton";
import { NavButtons } from "../shared/CharacterCreatorParts";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  profChipStyle,
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
  setRolledScore,
  usedIndices,
  remaining,
  primaryKeys,
  bgBonuses,
  hasBgBonuses,
  backgroundName,
  raceBonuses,
  hasRaceBonuses,
  raceName,
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
  setAbilityMethod: (method: "standard" | "pointbuy" | "rolled") => void;
  setStandardAssign: (key: string, idx: number) => void;
  setPointBuyScore: (key: string, score: number) => void;
  setRolledScore: (key: string, score: number) => void;
  usedIndices: number[];
  remaining: number;
  primaryKeys: string[];
  bgBonuses: Record<string, number>;
  hasBgBonuses: boolean;
  backgroundName: string | undefined;
  raceBonuses: Record<string, number>;
  hasRaceBonuses: boolean;
  raceName: string | undefined;
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
  const translateUi = useUiTranslation("playerUi");
    const bonus = bgBonuses[k];
    const raceBonus = raceBonuses[k];
    const isPrimary = primaryKeys.includes(k);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ color: isPrimary ? C.colorGold : C.muted, fontSize: "var(--fs-small)", fontWeight: isPrimary ? 800 : 600 }}>{abilityLabels[k]}</span>
        {isPrimary ? <span style={{ fontSize: "var(--fs-tiny)", color: C.colorGold, opacity: 0.75 }}>{translateUi("★ Primary")}</span> : null}
        {raceBonus != null ? (
          <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "rgba(74,222,128,0.18)", border: "1px solid rgba(74,222,128,0.4)", color: C.green }}>
            +{raceBonus} {raceName ?? "species"}
          </span>
        ) : null}
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
      <h2 style={headingStyle}>{<UiText text={"Ability Scores"} namespace="playerUi" />}</h2>
      {hasRaceBonuses ? (
        <div style={{ ...detailBoxStyle, marginBottom: 16, padding: "10px 14px" }}>
          <span style={{ fontSize: "var(--fs-small)", color: C.green }}>
            {<UiText text={"Species bonuses applied:"} namespace="playerUi" />} {Object.entries(raceBonuses).map(([k, v]) => `${abilityLabels[k]} +${v}`).join(", ")}
          </span>
        </div>
      ) : null}
      {hasBgBonuses ? (
        <div style={{ ...detailBoxStyle, marginBottom: 16, padding: "10px 14px" }}>
          <span style={{ fontSize: "var(--fs-small)", color: C.colorMagic }}>
            {<UiText text={"Background bonuses applied:"} namespace="playerUi" />} {Object.entries(bgBonuses).map(([k, v]) => `${abilityLabels[k]} +${v}`).join(", ")}
          </span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {(["standard", "pointbuy", "rolled"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setAbilityMethod(m)}
            style={{
              padding: "7px 16px",
              borderRadius: 8,
              cursor: "pointer",
              border: `1px solid ${form.abilityMethod === m ? C.accentHl : withAlpha(C.panelBorder, 0.14)}`,
              background: form.abilityMethod === m ? withAlpha(C.accentHl, 0.15) : C.panelBg,
              color: form.abilityMethod === m ? C.accentHl : withAlpha(C.muted, 0.7),
              fontWeight: form.abilityMethod === m ? 700 : 500,
              fontSize: "var(--fs-subtitle)",
            }}
          >
            {m === "standard" ? <UiText text={"Standard Array"} namespace="playerUi" /> : m === "pointbuy" ? <UiText text={"Point Buy"} namespace="playerUi" /> : <UiText text={"Rolled"} namespace="playerUi" />}
          </button>
        ))}
      </div>

      {form.abilityMethod === "standard" ? (
        <div>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 12 }}>{<UiText text={"Assign each value to one ability:"} namespace="playerUi" />} {standardArray.join(", ")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {abilityKeys.map((k) => {
              const assigned = form.standardAssign[k];
              const baseVal = assigned >= 0 ? standardArray[assigned] : undefined;
              const totalVal = baseVal != null ? baseVal + (bgBonuses[k] ?? 0) + (raceBonuses[k] ?? 0) : undefined;
              return (
                <div key={k} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`, background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent" }}>
                  <AbilityLabel k={k} />
                  <Select value={assigned >= 0 ? String(assigned) : ""} onChange={(e) => setStandardAssign(k, e.target.value === "" ? -1 : Number(e.target.value))} style={{ width: "100%" }}>
                    <option value="">—</option>
                    {standardArray.map((v, i) => (!usedIndices.includes(i) || i === assigned ? <option key={i} value={String(i)}>{v}</option> : null))}
                  </Select>
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2, textAlign: "center" }}>
                    {totalVal != null ? <>{baseVal !== totalVal ? <span style={{ color: C.colorMagic, marginRight: 4 }}>{totalVal}</span> : null}{translateUi("mod {{value1}}{{value2}}", { value1: abilityMod(totalVal) >= 0 ? "+" : "", value2: abilityMod(totalVal) })}</> : null}
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
            <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{<UiText text={"Points remaining:"} namespace="playerUi" />}</span>
            <span style={{ fontWeight: 700, color: remaining < 0 ? C.red : C.accentHl }}>{remaining} / {pointBuyBudget}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {abilityKeys.map((k) => {
              const score = form.pbScores[k] ?? 8;
              const total = score + (bgBonuses[k] ?? 0) + (raceBonuses[k] ?? 0);
              return (
                <div key={k} style={{ textAlign: "center", padding: "8px", borderRadius: 8, border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`, background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent" }}>
                  <AbilityLabel k={k} />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    <IconButton size="sm" disabled={score <= 8} onClick={() => setPointBuyScore(k, score - 1)}>−</IconButton>
                    <span style={{ fontWeight: 700, minWidth: 24 }}>{score}{total !== score ? <span style={{ color: C.colorMagic, fontSize: "var(--fs-small)" }}> ({total})</span> : null}</span>
                    <IconButton size="sm" disabled={score >= 15 || remaining < (pointBuyCosts[score + 1] ?? 99) - (pointBuyCosts[score] ?? 0)} onClick={() => setPointBuyScore(k, score + 1)}>+</IconButton>
                  </div>
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>{<UiText text={"mod"} namespace="playerUi" />} {abilityMod(total) >= 0 ? "+" : ""}{abilityMod(total)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {form.abilityMethod === "rolled" ? (
        <div>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 12 }}>
            <UiText text={"Roll at the table, then enter each result here."} namespace="playerUi" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            {abilityKeys.map((k) => {
              const score = form.rolledScores[k] ?? 8;
              const total = score + (bgBonuses[k] ?? 0) + (raceBonuses[k] ?? 0);
              return (
                <label key={k} style={{ textAlign: "center", padding: 8, borderRadius: 8, border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`, background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent" }}>
                  <AbilityLabel k={k} />
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={score}
                    onChange={(event) => setRolledScore(k, Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
                    style={{ ...inputStyle, width: "100%", textAlign: "center" }}
                  />
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>
                    {total !== score ? <span style={{ color: C.colorMagic, marginRight: 4 }}>{total}</span> : null}
                    <UiText text={"mod"} namespace="playerUi" /> {abilityMod(total) >= 0 ? "+" : ""}{abilityMod(total)}
                  </div>
                </label>
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
  const raceBonuses = deriveRaceAbilityBonuses(ctx.raceDetail, ctx.raceDetail?.parsedChoices?.abilityScoreChoice, ctx.form);
  const hasRaceBonuses = Object.keys(raceBonuses).length > 0;

  return renderAbilityScoresStep({
    form: ctx.form,
    setAbilityMethod: (method) => ctx.setField("abilityMethod", method),
    setStandardAssign: (key, idx) => ctx.setForm((f) => ({ ...f, standardAssign: { ...f.standardAssign, [key]: idx } })),
    setPointBuyScore: (key, score) => ctx.setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [key]: score } })),
    setRolledScore: (key, score) => ctx.setForm((f) => ({ ...f, rolledScores: { ...f.rolledScores, [key]: score } })),
    usedIndices,
    remaining,
    primaryKeys,
    bgBonuses,
    hasBgBonuses,
    backgroundName: ctx.bgDetail?.name,
    raceBonuses,
    hasRaceBonuses,
    raceName: ctx.raceDetail?.name,
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
  isEditing = false,
  hpReview,
  hpMax,
  creationHpMethod,
  creationHpRolls,
  setCreationHpMethod,
  setCreationHpRoll,
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
  isEditing?: boolean;
  hpReview?: { required: boolean; reviewed: boolean; onReview: (reviewed: boolean) => void };
  hpMax: string | number;
  creationHpMethod: "average" | "physical" | "manual";
  creationHpRolls: Record<string, string>;
  setCreationHpMethod: (method: "average" | "physical" | "manual") => void;
  setCreationHpRoll: (level: number, value: string) => void;
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
      <h2 style={headingStyle}>{<UiText text={"Combat Stats"} namespace="playerUi" />}</h2>
      <p style={{ color: C.muted, marginBottom: 16 }}>{isEditing ? "Recorded HP is preserved. Review it when changing class, level, or Constitution." : <UiText text={"Auto-calculated from your choices — HP Max and Armor Class can be overridden."} namespace="playerUi" />}</p>
      {!isEditing ? <div style={{ marginBottom: 18 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>Hit Points</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["average", "physical", "manual"] as const).map((method) => <button key={method} type="button" onClick={() => setCreationHpMethod(method)} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", border: `1px solid ${creationHpMethod === method ? C.accentHl : C.panelBorder}`, background: creationHpMethod === method ? withAlpha(C.accentHl, 0.15) : C.panelBg, color: creationHpMethod === method ? C.accentHl : C.muted, fontWeight: 700 }}>
            {method === "average" ? "Average" : method === "physical" ? "Physical rolls" : "Manual total"}
          </button>)}
        </div>
        {creationHpMethod === "physical" && level > 1 ? <div style={{ ...detailBoxStyle, marginTop: 12 }}>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 10 }}>Roll one d{hd} at the table for each level after 1, then enter the raw die result.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            {Array.from({ length: level - 1 }, (_, index) => index + 2).map((entryLevel) => <label key={entryLevel} style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
              Level {entryLevel}
              <input type="number" min={1} max={hd} value={creationHpRolls[String(entryLevel)] ?? ""} onChange={(event) => setCreationHpRoll(entryLevel, event.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 4 }} />
            </label>)}
          </div>
        </div> : null}
      </div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>{<UiText text={"HP Max"} namespace="playerUi" />}</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>{isEditing ? "Recorded base HP; adjust it here if needed." : hpFormulaLabel}</div>
          <input type="number" value={hpMax} readOnly={!isEditing && creationHpMethod !== "manual"} onChange={(e) => setField("hpMax", e.target.value)} style={{ ...inputStyle, width: "100%", opacity: !isEditing && creationHpMethod !== "manual" ? 0.75 : 1 }} />
        </div>
        <div>
          <label style={labelStyle}>{<UiText text={"Armor Class"} namespace="playerUi" />}</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>{acFormulaLabel}</div>
          <input type="number" value={ac} onChange={(e) => setField("ac", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div>
          <label style={labelStyle}>{<UiText text={"Speed (ft)"} namespace="playerUi" />}</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>{<UiText text={"From species ("} namespace="playerUi" />}{raceSpeed} {<UiText text={"ft)"} namespace="playerUi" />}</div>
          <div style={{ ...inputStyle, width: "100%", opacity: 0.6, cursor: "default" }}>{speed}</div>
        </div>
      </div>
      {sections.length > 0 ? (
        <div style={{ ...detailBoxStyle, marginTop: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "var(--fs-subtitle)" }}>{<UiText text={"Your Proficiencies"} namespace="playerUi" />}</div>
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
      {hpReview?.required && <label style={{ display: "flex", gap: 8, margin: "16px 0", color: C.text }}>
        <input type="checkbox" checked={hpReview.reviewed} onChange={(event) => hpReview.onReview(event.target.checked)} />
        I have reviewed HP Max for this class, level, or Constitution change.
      </label>}
      <NavButtons step={9} nextDisabled={Boolean(hpReview?.required && !hpReview.reviewed)} onBack={onBack} onNext={onNext} />
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
    { label: translateUi("Skills"), items: prof.skills },
    { label: translateUi("Expertise"), items: prof.expertise },
    { label: translateUi("Saves"), items: prof.saves },
    { label: translateUi("Armor"), items: prof.armor },
    { label: translateUi("Weapons"), items: prof.weapons },
    { label: translateUi("Tools"), items: prof.tools },
    { label: translateUi("Languages"), items: prof.languages },
    { label: translateUi("Maneuvers"), items: prof.maneuvers },
    { label: translateUi("Metamagic"), items: prof.metamagic },
    { label: translateUi("Magic Item Plans"), items: prof.plans },
    { label: translateUi("Spells"), items: prof.spells },
    { label: translateUi("Invocations"), items: prof.invocations },
  ].filter((s) => s.items.length > 0);

  return renderDerivedStatsStep({
    isEditing: ctx.isEditing,
    hpReview: ctx.hpReview,
    level: ctx.form.level,
    hpMax: ctx.form.hpMax,
    creationHpMethod: ctx.form.creationHpMethod,
    creationHpRolls: ctx.form.creationHpRolls,
    setCreationHpMethod: (method) => ctx.setForm((form) => ({ ...form, creationHpMethod: method })),
    setCreationHpRoll: (level, value) => ctx.setForm((form) => ({ ...form, creationHpRolls: { ...form.creationHpRolls, [String(level)]: value } })),
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
