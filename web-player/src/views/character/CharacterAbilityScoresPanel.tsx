import { AbilityScoresCompact } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { CollapsiblePanel, PanelHeaderAddButton, Tooltip } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/panelRegistry";
import { getModifierState, StateBadge } from "@/views/character/CharacterAbilitiesPanelHelpers";
import type { AbilKey, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { ABILITY_FULL, ABILITY_LABELS } from "@/views/character/CharacterSheetConstants";
import { getSaveBonus, hasNamedProficiency } from "@/views/character/CharacterSheetUtils";

export interface AbilityScoresPanelProps {
  scores: Record<AbilKey, number | null>;
  scoreExplanations?: Partial<Record<AbilKey, string>>;
  pb: number;
  prof?: ProficiencyMap | null;
  saveBonuses?: Partial<Record<AbilKey, number>>;
  abilityCheckAdvantages?: Partial<Record<AbilKey, boolean>>;
  abilityCheckDisadvantages?: Partial<Record<AbilKey, boolean>>;
  saveAdvantages?: Partial<Record<AbilKey, boolean>>;
  saveDisadvantages?: Partial<Record<AbilKey, boolean>>;
  accentColor: string;
  nonProficientArmorPenalty: boolean;
  d20TestPenalty?: number;
  mod: (score: number | null) => number;
  fmtMod: (value: number) => string;
  onOpenPermanentBuffs: () => void;
}

export function AbilityScoresPanel({
  scores,
  scoreExplanations,
  pb,
  prof,
  saveBonuses,
  abilityCheckAdvantages,
  abilityCheckDisadvantages,
  saveAdvantages,
  saveDisadvantages,
  accentColor,
  nonProficientArmorPenalty,
  d20TestPenalty = 0,
  mod,
  fmtMod,
  onOpenPermanentBuffs,
}: AbilityScoresPanelProps) {
  const abilityKeys = ["str", "dex", "con", "int", "wis", "cha"] as AbilKey[];
  const derivedPb = Math.max(1, (pb - 1) * 4);
  const abilityMeta = Object.fromEntries(
    abilityKeys.map((k) => {
      const score = scores[k];
      const m = mod(score);
      const isProfSave = prof ? hasNamedProficiency(prof.saves, ABILITY_FULL[k]) : false;
      const save = getSaveBonus(ABILITY_FULL[k], k, scores, derivedPb, prof ?? undefined, saveBonuses?.[k] ?? 0) - d20TestPenalty;
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
    <CollapsiblePanel
      title="Abilities &amp; Saves"
      color={accentColor}
      storageKey={PANEL_IDS.abilitiesSaves}
      actions={<PanelHeaderAddButton color={accentColor} onClick={onOpenPermanentBuffs} title="Permanent buffs" />}
      summary={abilityKeys.map((key) => `${ABILITY_LABELS[key]} ${scores[key] ?? "-"}`).join(" · ")}
    >
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
  );
}
