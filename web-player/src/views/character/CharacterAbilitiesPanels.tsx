import React from "react";
import { AbilityScoresCompact } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { CollapsiblePanel, ProfDot, Tooltip } from "@/views/character/CharacterViewParts";
import type { AbilKey, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { ABILITY_FULL, ABILITY_LABELS, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import { getSaveBonus, getSkillBonus, getSkillProficiencyTier, hasNamedProficiency } from "@/views/character/CharacterSheetUtils";
import { formatWeaponProficiencyName } from "@/views/character/CharacterInventory";

export interface CharacterAbilitiesPanelsProps {
  scores: Record<AbilKey, number | null>;
  scoreExplanations?: Partial<Record<AbilKey, string>>;
  pb: number;
  prof?: ProficiencyMap | null;
  saveBonuses?: Partial<Record<AbilKey, number>>;
  abilityCheckAdvantages?: Partial<Record<AbilKey, boolean>>;
  abilityCheckDisadvantages?: Partial<Record<AbilKey, boolean>>;
  saveAdvantages?: Partial<Record<AbilKey, boolean>>;
  saveDisadvantages?: Partial<Record<AbilKey, boolean>>;
  skillAdvantages?: Record<string, boolean>;
  skillDisadvantages?: Record<string, boolean>;
  accentColor: string;
  stealthDisadvantage: boolean;
  nonProficientArmorPenalty: boolean;
  hasJackOfAllTrades?: boolean;
  mod: (score: number | null) => number;
  fmtMod: (value: number) => string;
}

function getModifierState(hasAdvantage: boolean, hasDisadvantage: boolean): "advantage" | "disadvantage" | null {
  if (hasAdvantage === hasDisadvantage) return null;
  return hasAdvantage ? "advantage" : "disadvantage";
}

function StateBadge({
  state,
  accentColor,
  title,
}: {
  state: "advantage" | "disadvantage" | null;
  accentColor: string;
  title: string;
}) {
  if (!state) return null;
  const positive = state === "advantage";
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        borderRadius: 999,
        border: `1px solid ${positive ? accentColor + "88" : "rgba(248,113,113,0.55)"}`,
        background: positive ? accentColor + "1f" : "rgba(248,113,113,0.14)",
        color: positive ? accentColor : C.colorPinkRed,
        fontSize: "var(--fs-small)",
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {positive ? "A" : "D"}
    </span>
  );
}

export function CharacterAbilitiesPanels({
  scores,
  scoreExplanations,
  pb,
  prof,
  saveBonuses,
  abilityCheckAdvantages,
  abilityCheckDisadvantages,
  saveAdvantages,
  saveDisadvantages,
  skillAdvantages,
  skillDisadvantages,
  accentColor,
  stealthDisadvantage,
  nonProficientArmorPenalty,
  hasJackOfAllTrades = false,
  mod,
  fmtMod,
}: CharacterAbilitiesPanelsProps) {
  const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as AbilKey[];
  const derivedPb = Math.max(1, (pb - 1) * 4);
  const abilityMeta = Object.fromEntries(
    abilityKeys.map((k) => {
      const score = scores[k];
      const m = mod(score);
      const isProfSave = prof ? hasNamedProficiency(prof.saves, ABILITY_FULL[k]) : false;
      const save = getSaveBonus(ABILITY_FULL[k], k, scores, derivedPb, prof ?? undefined, saveBonuses?.[k] ?? 0);
      const abilityCheckState = getModifierState(Boolean(abilityCheckAdvantages?.[k]), Boolean(abilityCheckDisadvantages?.[k]));
      const armorSaveDisadvantage = nonProficientArmorPenalty && (k === "str" || k === "dex");
      const saveState = getModifierState(Boolean(saveAdvantages?.[k]), Boolean(saveDisadvantages?.[k]) || armorSaveDisadvantage);
      return [k, { score, m, isProfSave, save, abilityCheckState, saveState, armorSaveDisadvantage }] as const;
    })
  ) as Record<AbilKey, {
    score: number | null;
    m: number;
    isProfSave: boolean;
    save: number;
    abilityCheckState: "advantage" | "disadvantage" | null;
    saveState: "advantage" | "disadvantage" | null;
    armorSaveDisadvantage: boolean;
  }>;

  return (
    <>
      <CollapsiblePanel title="Abilities &amp; Saves" color={accentColor} storageKey="abilities-saves">
        <AbilityScoresCompact
          scores={scores}
          compact
          accentColor={accentColor}
          mutedColor={C.muted}
          textColor={C.text}
          pillBackground="rgba(255,255,255,0.06)"
          pillBorderColor="rgba(255,255,255,0.10)"
          minColumnWidth={160}
          getModifier={(score) => mod(score)}
          formatModifier={fmtMod}
          renderLabel={({ key }) => {
            const k = key as AbilKey;
            const { isProfSave } = abilityMeta[k];
            return (
              <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: isProfSave ? accentColor : C.muted }}>
                {ABILITY_LABELS[k]}
              </span>
            );
          }}
          renderScore={({ key }) => {
            const k = key as AbilKey;
            const { score, isProfSave } = abilityMeta[k];
            return (
              <Tooltip text={scoreExplanations?.[k] ?? `${ABILITY_FULL[k]}: ${score ?? "not set"}.`} multiline>
                <div style={{ padding: "6px 2px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: `1px solid ${isProfSave ? accentColor + "55" : "rgba(255,255,255,0.10)"}`, textAlign: "center", fontSize: "var(--fs-subtitle)", fontWeight: 900, color: isProfSave ? accentColor : C.text, cursor: "help", width: "100%" }}>
                  {score ?? "-"}
                </div>
              </Tooltip>
            );
          }}
          renderMod={({ key }) => {
            const k = key as AbilKey;
            const { m, abilityCheckState } = abilityMeta[k];
            return (
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, textAlign: "center", color: abilityCheckState === "disadvantage" ? C.colorPinkRed : abilityCheckState === "advantage" ? accentColor : C.text, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                <span>{fmtMod(m)}</span>
                <StateBadge
                  state={abilityCheckState}
                  accentColor={accentColor}
                  title={`${abilityCheckState === "advantage" ? "Advantage" : "Disadvantage"} on ${ABILITY_FULL[k]} checks`}
                />
              </div>
            );
          }}
          renderSave={({ key }) => {
            const k = key as AbilKey;
            const { m, save, isProfSave, saveState, armorSaveDisadvantage } = abilityMeta[k];
            return (
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, textAlign: "center", color: saveState === "disadvantage" ? C.colorPinkRed : saveState === "advantage" ? accentColor : isProfSave ? accentColor : C.text, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                <Tooltip text={isProfSave ? `${fmtMod(m)} (mod) + ${pb} (prof) = ${fmtMod(save)}${armorSaveDisadvantage ? " - Disadvantage from armor" : ""}` : `${fmtMod(m)} (mod, not proficient)${armorSaveDisadvantage ? " - Disadvantage from armor" : ""}`}>
                  <span style={{ cursor: "help" }}>{fmtMod(save)}</span>
                </Tooltip>
                <StateBadge
                  state={saveState}
                  accentColor={accentColor}
                  title={`${saveState === "advantage" ? "Advantage" : "Disadvantage"} on ${ABILITY_FULL[k]} saving throws`}
                />
                {isProfSave && <span style={{ position: "absolute", top: -2, right: 0, width: 5, height: 5, borderRadius: "50%", background: accentColor }} />}
              </div>
            );
          }}
        />
      </CollapsiblePanel>

      <CollapsiblePanel title="Skills" color={accentColor} storageKey="skills">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 2 }}>
          {ALL_SKILLS.map(({ name, abil }) => {
            const tier = getSkillProficiencyTier(prof ?? undefined, name);
            const isProfSkill = tier >= 1;
            const isExpertise = tier >= 2;
            const bonus = getSkillBonus(name, abil, scores, Math.max(1, (pb - 1) * 4), prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades });
            const src = prof?.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
            const expertiseSrc = prof?.expertise.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
            const armorPenalty = nonProficientArmorPenalty && (abil === "str" || abil === "dex");
            const stealthPenalty = name === "Stealth" && stealthDisadvantage;
            const skillState = getModifierState(Boolean(skillAdvantages?.[name]), Boolean(skillDisadvantages?.[name]) || armorPenalty || stealthPenalty);
            return (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 4px",
                  borderRadius: 4,
                  minWidth: 0,
                }}
              >
                <ProfDot filled={isProfSkill} color={isExpertise ? accentColor : C.green} />
                <span
                  style={{
                    fontSize: "var(--fs-tiny)",
                    fontWeight: 700,
                    color: "rgba(160,180,220,0.45)",
                    letterSpacing: "0.04em",
                    width: 24,
                    textAlign: "center",
                  }}
                >
                  {ABILITY_LABELS[abil]}
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-small)",
                    color: isProfSkill ? C.text : C.muted,
                    flex: 1,
                    fontWeight: isProfSkill ? 600 : 400,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  {isExpertise && (
                    <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: accentColor }}>EXP</span>
                  )}
                  <StateBadge
                    state={skillState}
                    accentColor={accentColor}
                    title={`${skillState === "advantage" ? "Advantage" : "Disadvantage"} on ${name} checks`}
                  />
                </span>
                <span
                  style={{
                    fontSize: "var(--fs-subtitle)",
                    fontWeight: 700,
                    minWidth: 26,
                    textAlign: "right",
                    color: skillState === "disadvantage" ? C.colorPinkRed : skillState === "advantage" ? accentColor : isExpertise ? accentColor : isProfSkill ? C.green : C.text,
                  }}
                >
                  {isProfSkill && (src || expertiseSrc)
                    ? <Tooltip text={[src, expertiseSrc].filter(Boolean).join(" - ")}>{fmtMod(bonus)}</Tooltip>
                    : fmtMod(bonus)}
                </span>
              </div>
            );
          })}
        </div>
      </CollapsiblePanel>

    </>
  );
}

export function CharacterProficienciesPanel({
  prof,
  accentColor,
}: {
  prof: ProficiencyMap | null | undefined;
  accentColor: string;
}) {
  if (!prof) return null;
  const sections = [
    { label: "Armor", items: prof.armor, color: C.colorMagic },
    { label: "Weapons", items: prof.weapons, color: C.colorPinkRed },
    { label: "Maneuvers", items: prof.maneuvers, color: C.accentHl },
    { label: "Magic Item Plans", items: prof.plans, color: C.colorRitual },
    { label: "Tools", items: prof.tools, color: C.colorOrange },
    { label: "Expertise", items: prof.expertise, color: accentColor },
    { label: "Languages", items: prof.languages, color: C.colorRitual },
  ].filter((s) => s.items.length > 0);
  if (!sections.length) return null;
  return (
    <CollapsiblePanel title="Proficiencies &amp; Languages" color={accentColor} storageKey="proficiencies">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sections.map((s) => (
          <div key={s.label}>
            <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
              {s.label}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {s.items.map((item, i) => (
                <Tooltip key={i} text={item.source}>
                  <span
                    style={{
                      fontSize: "var(--fs-small)",
                      padding: "3px 9px",
                      borderRadius: 5,
                      cursor: "default",
                      background: s.color + "18",
                      border: `1px solid ${s.color}44`,
                      color: s.color,
                      fontWeight: 600,
                    }}
                  >
                    {s.label === "Weapons" ? formatWeaponProficiencyName(item.name) : item.name}
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
