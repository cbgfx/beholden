import React from "react";
import { C } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { NavButtons } from "../shared/CharacterCreatorParts";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  sourceTagStyle,
  statLabelStyle,
  statValueStyle,
} from "../shared/CharacterCreatorStyles";
import { PreparedSpellProgressionBlock } from "@/views/character/CharacterViewParts";
import { parseAppliedSpeciesTraitEffects } from "../utils/CharacterCreatorClassFeatureUtils";
import { collectDefensesFromEffects, collectSensesFromEffects } from "@/domain/character/parseFeatureEffects";
import { titleCase } from "@/lib/format/titleCase";
import { ABILITY_KEYS, ABILITY_LABELS, ALL_LANGUAGES, ALL_SKILLS, ALL_TOOLS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";

interface RaceSummaryLike {
  id: string;
  name: string;
  speed?: number | null;
}

interface RaceDetailLike {
  name: string;
  speed: number | null;
  size: string | null;
  abilityScoreIncrease?: Record<string, number> | null;
  traits: Array<{ name: string; text: string; modifier: string[]; preparedSpellProgression?: PreparedSpellProgressionTable[]; effects?: unknown[] }>;
}

interface RaceChoiceSetLike {
  hasChosenSize: boolean;
  hasFeatChoice: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
  spellcastingAbilityChoice: { options: string[] } | null;
  abilityScoreChoice: { count: number; amount: number; from: string[] | null; flexible?: boolean } | null;
}

function SourceTag({ value }: { value: string | null | undefined }) {
  const label = String(value ?? "").trim();
  return label ? <span style={sourceTagStyle}>{label}</span> : null;
}

function renderSpeciesStep({
  availableRaces,
  filteredRaces,
  raceSearch,
  setRaceSearch,
  selectedRaceId,
  selectRace,
  raceDetail,
  raceChoices,
  chosenRaceSize,
  selectRaceSize,
  chosenRaceSpellAbility,
  selectRaceSpellAbility,
  chosenRaceSkills,
  chosenRaceTools,
  chosenRaceLanguages,
  toggleRacePick,
  chosenRaceAbilityChoices,
  toggleRaceAbilityChoice,
  raceAbilityMode,
  setRaceAbilityMode,
  raceAbilityBonuses,
  setRaceAbilityBonus,
  allSkills,
  allTools,
  allLanguages,
  raceFeatSearch,
  setRaceFeatSearch,
  filteredFeats,
  chosenRaceFeatId,
  selectRaceFeat,
  raceFeatDetail,
  onBack,
  onNext,
}: {
  availableRaces: RaceSummaryLike[];
  filteredRaces: RaceSummaryLike[];
  raceSearch: string;
  setRaceSearch: (value: string) => void;
  selectedRaceId: string;
  selectRace: (id: string) => void;
  raceDetail: RaceDetailLike | null;
  raceChoices: RaceChoiceSetLike | null;
  chosenRaceSize: string | null;
  selectRaceSize: (size: string) => void;
  chosenRaceSpellAbility: string | null;
  selectRaceSpellAbility: (ability: string) => void;
  chosenRaceSkills: string[];
  chosenRaceTools: string[];
  chosenRaceLanguages: string[];
  toggleRacePick: (key: "chosenRaceSkills" | "chosenRaceLanguages" | "chosenRaceTools", item: string, max: number) => void;
  chosenRaceAbilityChoices: string[];
  toggleRaceAbilityChoice: (ability: string, max: number) => void;
  raceAbilityMode: "split" | "even";
  setRaceAbilityMode: (mode: "split" | "even") => void;
  raceAbilityBonuses: Record<string, number>;
  setRaceAbilityBonus: (ability: string, amount: number | null) => void;
  allSkills: string[];
  allTools: string[];
  allLanguages: string[];
  raceFeatSearch: string;
  setRaceFeatSearch: (value: string) => void;
  filteredFeats: Array<{ id: string; name: string }>;
  chosenRaceFeatId: string | null;
  selectRaceFeat: (id: string, selected: boolean) => void;
  raceFeatDetail: { name: string; text?: string | null } | null;
  onBack: () => void;
  onNext: () => void;
}): { main: React.ReactNode; side: React.ReactNode } {
  const skillChoice = raceChoices?.skillChoice ?? null;
  const toolChoice = raceChoices?.toolChoice ?? null;
  const languageChoice = raceChoices?.languageChoice ?? null;
  const spellAbilityChoice = raceChoices?.spellcastingAbilityChoice ?? null;
  const missingRaceSize = Boolean(raceChoices?.hasChosenSize && !chosenRaceSize);
  const missingRaceSkills = Boolean(skillChoice && chosenRaceSkills.length < skillChoice.count);
  const missingRaceTools = Boolean(toolChoice && chosenRaceTools.length < toolChoice.count);
  const missingRaceLanguages = Boolean(languageChoice && chosenRaceLanguages.length < languageChoice.count);
  const missingRaceFeat = Boolean(raceChoices?.hasFeatChoice && !chosenRaceFeatId);
  const missingRaceSpellAbility = Boolean(spellAbilityChoice && !chosenRaceSpellAbility);
  const abilityChoice = raceChoices?.abilityScoreChoice ?? null;
  const abilityEvenTarget = abilityChoice?.flexible
    ? Math.min((abilityChoice.from ?? ABILITY_KEYS).length, Math.max(1, abilityChoice.count))
    : abilityChoice?.count ?? 0;
  const missingRaceAbilityChoice = abilityChoice
    ? abilityChoice.flexible
      ? (raceAbilityMode === "split" ? Object.keys(raceAbilityBonuses).length !== 2 : Object.keys(raceAbilityBonuses).length !== abilityEvenTarget)
      : chosenRaceAbilityChoices.length < abilityChoice.count
    : false;
  // Derived from the species' own trait effects, not a separately-authored vision/resistances
  // field: one fact, one home.
  const raceTraitEffects = raceDetail ? parseAppliedSpeciesTraitEffects(raceDetail) : [];
  const derivedSenses = collectSensesFromEffects(raceTraitEffects);
  const derivedResistances = collectDefensesFromEffects(raceTraitEffects).resistances;
  const nextDisabled =
    !selectedRaceId
    || missingRaceSize
    || missingRaceAbilityChoice
    || missingRaceSkills
    || missingRaceTools
    || missingRaceLanguages
    || missingRaceFeat
    || missingRaceSpellAbility;

  const main = (
    <div>
      <h2 style={headingStyle}>Choose a Species</h2>

      {availableRaces.length === 0 ? (
        <p style={{ color: C.muted }}>No species found in compendium.</p>
      ) : (
        <>
          <input
            value={raceSearch}
            onChange={(e) => setRaceSearch(e.target.value)}
            placeholder="Search species..."
            style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              maxHeight: 340,
              overflowY: "auto",
              paddingRight: 4,
              marginBottom: 4,
            }}
          >
            {filteredRaces.length === 0 && <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>}
            {filteredRaces.map((r) => {
              const sel = selectedRaceId === r.id;
              return (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => selectRace(r.id)}
                  style={{
                    padding: "10px 13px",
                    borderRadius: 8,
                    textAlign: "left",
                    border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                    background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                    color: sel ? C.accentHl : C.text,
                    cursor: "pointer",
                    fontWeight: sel ? 700 : 500,
                    fontSize: "var(--fs-subtitle)",
                    transition: "border-color 0.12s, background 0.12s",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </>
      )}

      {raceDetail && raceChoices && (raceChoices.hasChosenSize || skillChoice || toolChoice || languageChoice || raceChoices.hasFeatChoice || spellAbilityChoice || abilityChoice) && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {abilityChoice && (() => {
            const abilityPool = (abilityChoice.from ?? ABILITY_KEYS).map((key) => ({ key, label: ABILITY_LABELS[key as keyof typeof ABILITY_LABELS] ?? key.toUpperCase() }));

            if (!abilityChoice.flexible) {
              return (
                <div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                    <div style={{ ...labelStyle, margin: 0 }}>Ability Score Increase <SourceTag value={raceDetail.name} /></div>
                    <span style={{ fontSize: "var(--fs-small)", color: chosenRaceAbilityChoices.length >= abilityChoice.count ? C.accentHl : C.muted }}>
                      {chosenRaceAbilityChoices.length} / {abilityChoice.count}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {abilityPool.map(({ key, label }) => {
                      const sel = chosenRaceAbilityChoices.includes(key);
                      const locked = !sel && chosenRaceAbilityChoices.length >= abilityChoice.count;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={locked}
                          onClick={() => toggleRaceAbilityChoice(key, abilityChoice.count)}
                          style={{
                            padding: "6px 16px",
                            borderRadius: 6,
                            fontSize: "var(--fs-subtitle)",
                            cursor: locked ? "default" : "pointer",
                            border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                            background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                            color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                            fontWeight: sel ? 700 : 400,
                          }}
                        >
                          {label}
                          {sel && abilityChoice.amount !== 1 && <span style={{ marginLeft: 5, fontWeight: 800 }}>+{abilityChoice.amount}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const mode = raceAbilityMode;
            const bonuses = raceAbilityBonuses;
            const bonusCount = Object.keys(bonuses).length;
            const splitDone = bonusCount === 2;
            const evenDone = bonusCount === abilityEvenTarget;

            function handleSplitClick(key: string) {
              const current = bonuses[key];
              if (current) { setRaceAbilityBonus(key, null); return; }
              if (bonusCount >= 2) return;
              setRaceAbilityBonus(key, Object.values(bonuses).includes(2) ? 1 : 2);
            }
            function handleEvenClick(key: string) {
              if (bonuses[key]) { setRaceAbilityBonus(key, null); return; }
              if (bonusCount < abilityEvenTarget) setRaceAbilityBonus(key, 1);
            }

            return (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Ability Score Increase </span>
                  <SourceTag value={raceDetail.name} />
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {(["split", "even"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRaceAbilityMode(option)}
                      style={{
                        padding: "4px 12px",
                        borderRadius: 20,
                        cursor: "pointer",
                        fontSize: "var(--fs-small)",
                        fontWeight: 600,
                        border: `1px solid ${mode === option ? C.accentHl : "rgba(255,255,255,0.15)"}`,
                        background: mode === option ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.04)",
                        color: mode === option ? C.accentHl : C.muted,
                      }}
                    >
                      {option === "split" ? "+2 / +1" : (abilityEvenTarget < abilityPool.length ? `+1 x${abilityEvenTarget}` : "+1 each")}
                    </button>
                  ))}
                </div>
                <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 8 }}>
                  {mode === "split"
                    ? splitDone ? "All bonuses assigned" : !Object.values(bonuses).includes(2) ? "Click to assign +2" : "Click another for +1"
                    : evenDone ? "All bonuses assigned" : `Click abilities to assign +1 (${bonusCount}/${abilityEvenTarget})`}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {abilityPool.map(({ key, label }) => {
                    const bonus = bonuses[key];
                    const sel = bonus != null;
                    const canSelect = mode === "split" ? (!sel && bonusCount < 2) : (!sel && bonusCount < abilityEvenTarget);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => (mode === "split" ? handleSplitClick(key) : handleEvenClick(key))}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 6,
                          cursor: canSelect || sel ? "pointer" : "default",
                          border: `1px solid ${sel ? C.accentHl : canSelect ? "rgba(56,182,255,0.35)" : "rgba(255,255,255,0.12)"}`,
                          background: sel ? "rgba(56,182,255,0.2)" : "rgba(255,255,255,0.055)",
                          color: sel ? C.accentHl : canSelect ? "rgba(56,182,255,0.7)" : C.muted,
                          fontSize: "var(--fs-subtitle)",
                          fontWeight: sel ? 700 : 400,
                          opacity: !canSelect && !sel ? 0.45 : 1,
                        }}
                      >
                        {label}
                        {sel && <span style={{ marginLeft: 5, fontWeight: 800 }}>+{bonus}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {spellAbilityChoice && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Spellcasting Ability <SourceTag value={raceDetail.name} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                {spellAbilityChoice.options.map((ability) => {
                  const sel = chosenRaceSpellAbility === ability;
                  return (
                    <button
                      key={ability}
                      type="button"
                      onClick={() => selectRaceSpellAbility(ability)}
                      style={{
                        padding: "6px 16px",
                        borderRadius: 6,
                        fontSize: "var(--fs-subtitle)",
                        cursor: "pointer",
                        border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : C.text,
                        fontWeight: sel ? 700 : 400,
                        textTransform: "uppercase",
                      }}
                    >
                      {ability}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {raceChoices.hasChosenSize && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Size <SourceTag value={raceDetail.name} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Medium", "Small"].map((sz) => {
                  const sel = chosenRaceSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => selectRaceSize(sz)}
                      style={{
                        padding: "6px 16px",
                        borderRadius: 6,
                        fontSize: "var(--fs-subtitle)",
                        cursor: "pointer",
                        border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : C.text,
                        fontWeight: sel ? 700 : 400,
                      }}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {skillChoice && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <div style={{ ...labelStyle, margin: 0 }}>Skill Proficiency <SourceTag value={raceDetail.name} /></div>
                <span style={{ fontSize: "var(--fs-small)", color: chosenRaceSkills.length >= skillChoice.count ? C.accentHl : C.muted }}>
                  {chosenRaceSkills.length} / {skillChoice.count}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(skillChoice.from ?? allSkills).map((skill) => {
                  const sel = chosenRaceSkills.includes(skill);
                  const locked = !sel && chosenRaceSkills.length >= skillChoice.count;
                  return (
                    <button
                      key={skill}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleRacePick("chosenRaceSkills", skill, skillChoice.count)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontSize: "var(--fs-subtitle)",
                        cursor: locked ? "default" : "pointer",
                        border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                        fontWeight: sel ? 700 : 400,
                      }}
                    >
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {toolChoice && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <div style={{ ...labelStyle, margin: 0 }}>Tool Proficiency <SourceTag value={raceDetail.name} /></div>
                <span style={{ fontSize: "var(--fs-small)", color: chosenRaceTools.length >= toolChoice.count ? C.accentHl : C.muted }}>
                  {chosenRaceTools.length} / {toolChoice.count}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {(toolChoice.from ?? allTools).map((tool) => {
                  const sel = chosenRaceTools.includes(tool);
                  const locked = !sel && chosenRaceTools.length >= toolChoice.count;
                  return (
                    <button
                      key={tool}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleRacePick("chosenRaceTools", tool, toolChoice.count)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontSize: "var(--fs-subtitle)",
                        cursor: locked ? "default" : "pointer",
                        border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                        fontWeight: sel ? 700 : 400,
                      }}
                    >
                      {tool}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {languageChoice && (
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                <div style={{ ...labelStyle, margin: 0 }}>Language <SourceTag value={raceDetail.name} /></div>
                <span style={{ fontSize: "var(--fs-small)", color: chosenRaceLanguages.length >= languageChoice.count ? C.accentHl : C.muted }}>
                  {chosenRaceLanguages.length} / {languageChoice.count}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(languageChoice.from ?? allLanguages).map((lang) => {
                  const sel = chosenRaceLanguages.includes(lang);
                  const locked = !sel && chosenRaceLanguages.length >= languageChoice.count;
                  return (
                    <button
                      key={lang}
                      type="button"
                      disabled={locked}
                      onClick={() => toggleRacePick("chosenRaceLanguages", lang, languageChoice.count)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        fontSize: "var(--fs-subtitle)",
                        cursor: locked ? "default" : "pointer",
                        border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                        fontWeight: sel ? 700 : 400,
                      }}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {raceChoices.hasFeatChoice && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Origin Feat <SourceTag value={raceDetail.name} /></div>
              <input
                value={raceFeatSearch}
                onChange={(e) => setRaceFeatSearch(e.target.value)}
                placeholder="Search feats..."
                style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                {filteredFeats.map((feat) => {
                  const sel = chosenRaceFeatId === feat.id;
                  return (
                    <button
                      key={feat.id}
                      type="button"
                      onClick={() => selectRaceFeat(feat.id, sel)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        textAlign: "left",
                        cursor: "pointer",
                        border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : C.text,
                        fontWeight: sel ? 700 : 400,
                        fontSize: "var(--fs-subtitle)",
                        transition: "border-color 0.12s, background 0.12s",
                      }}
                    >
                      {feat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <NavButtons step={3} onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} />
    </div>
  );

  const side = raceDetail ? (
    <div style={detailBoxStyle}>
      <div style={{ fontWeight: 700, fontSize: "var(--fs-body)", color: C.accentHl, marginBottom: 10 }}>{raceDetail.name}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
        {raceDetail.abilityScoreIncrease && Object.keys(raceDetail.abilityScoreIncrease).length > 0 && (
          <div>
            <div style={statLabelStyle}>Ability Bonus</div>
            <div style={statValueStyle}>
              {Object.entries(raceDetail.abilityScoreIncrease)
                .map(([key, amount]) => `${(ABILITY_LABELS[key as keyof typeof ABILITY_LABELS] ?? key.toUpperCase()).slice(0, 3).toUpperCase()} +${amount}`)
                .join(", ")}
            </div>
          </div>
        )}
        {raceDetail.speed != null && <div><div style={statLabelStyle}>Speed</div><div style={statValueStyle}>{raceDetail.speed} ft</div></div>}
        {raceDetail.size && <div><div style={statLabelStyle}>Size</div><div style={statValueStyle}>{raceDetail.size}</div></div>}
        {derivedSenses.length > 0 && <div><div style={statLabelStyle}>Vision</div><div style={statValueStyle}>{derivedSenses.map((s) => `${titleCase(s.kind)} ${s.range}ft`).join(", ")}</div></div>}
        {derivedResistances.length > 0 && <div><div style={statLabelStyle}>Resist</div><div style={statValueStyle}>{derivedResistances.join(", ")}</div></div>}
      </div>
      {raceDetail.traits.map((t) => (
        <div key={t.name} style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 700, fontSize: "var(--fs-small)", color: C.accentHl }}>{t.name}. </span>
          <span style={{ color: "rgba(160,180,220,0.65)", fontSize: "var(--fs-small)", lineHeight: 1.5 }}>
            {t.text.replace(/Source:.*$/m, "").trim()}
          </span>
          {t.preparedSpellProgression?.length ? (
            <PreparedSpellProgressionBlock tables={t.preparedSpellProgression} compact accentColor={C.accentHl} />
          ) : null}
        </div>
      ))}
      {chosenRaceFeatId && raceFeatDetail && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontWeight: 700, color: C.accentHl, fontSize: "var(--fs-subtitle)", marginBottom: 8 }}>{raceFeatDetail.name}</div>
          {raceFeatDetail.text && (
            <div style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.75)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {raceFeatDetail.text.replace(/Source:.*$/m, "").trim()}
            </div>
          )}
        </div>
      )}
    </div>
  ) : (
    <div style={{ color: C.muted, fontSize: "var(--fs-subtitle)", padding: "12px 0" }}>Select a species to see its details.</div>
  );

  return { main, side };
}

export function renderSpeciesFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const availableRaces = ctx.races;
  const filtered = ctx.raceSearch
    ? availableRaces.filter((r) => r.name.toLowerCase().includes(ctx.raceSearch.toLowerCase()))
    : availableRaces;

  function toggleRacePick<K extends "chosenRaceSkills" | "chosenRaceLanguages" | "chosenRaceTools">(
    key: K,
    item: string,
    max: number,
  ) {
    ctx.setForm((f) => {
      const cur = f[key] as string[];
      const sel = cur.includes(item);
      return {
        ...f,
        [key]: sel ? cur.filter((x) => x !== item) : cur.length < max ? [...cur, item] : cur,
      };
    });
  }

  // Species choices (skill/tool/language/size/feat/spellcasting-ability) are read exclusively
  // from the compendium's own structured `choices` field — never inferred from trait prose at
  // runtime. A species missing `choices` data has no choices to make, not a guess.
  const raceChoices = ctx.raceDetail?.parsedChoices ?? null;
  const allowedFeatIds = new Set(ctx.bgDetail?.proficiencies?.featChoiceFrom ?? []);
  const originFeats = ctx.featSummaries.filter((f) =>
    allowedFeatIds.size > 0 ? allowedFeatIds.has(f.id) : /\borigin\b/i.test(f.name));
  const filteredFeats = ctx.raceFeatSearch
    ? originFeats.filter((f) => f.name.toLowerCase().includes(ctx.raceFeatSearch.toLowerCase()))
    : originFeats;

  return renderSpeciesStep({
    availableRaces,
    filteredRaces: filtered,
    raceSearch: ctx.raceSearch,
    setRaceSearch: ctx.setRaceSearch,
    selectedRaceId: ctx.form.raceId,
    selectRace: (id) => ctx.setField("raceId", id),
    raceDetail: ctx.raceDetail,
    raceChoices,
    chosenRaceSize: ctx.form.chosenRaceSize,
    selectRaceSize: (size) => ctx.setForm((f) => ({ ...f, chosenRaceSize: size })),
    chosenRaceSpellAbility: ctx.form.chosenRaceSpellAbility,
    selectRaceSpellAbility: (ability) => ctx.setForm((f) => ({ ...f, chosenRaceSpellAbility: ability })),
    chosenRaceSkills: ctx.form.chosenRaceSkills,
    chosenRaceTools: ctx.form.chosenRaceTools,
    chosenRaceLanguages: ctx.form.chosenRaceLanguages,
    toggleRacePick,
    chosenRaceAbilityChoices: ctx.form.chosenRaceAbilityChoices,
    toggleRaceAbilityChoice: (ability, max) => ctx.setForm((f) => {
      const cur = f.chosenRaceAbilityChoices;
      const sel = cur.includes(ability);
      return { ...f, chosenRaceAbilityChoices: sel ? cur.filter((x) => x !== ability) : cur.length < max ? [...cur, ability] : cur };
    }),
    raceAbilityMode: ctx.form.raceAbilityMode,
    setRaceAbilityMode: (mode) => ctx.setForm((f) => ({ ...f, raceAbilityMode: mode, raceAbilityBonuses: {} })),
    raceAbilityBonuses: ctx.form.raceAbilityBonuses,
    setRaceAbilityBonus: (ability, amount) => ctx.setForm((f) => {
      const next = { ...f.raceAbilityBonuses };
      if (amount == null) delete next[ability]; else next[ability] = amount;
      return { ...f, raceAbilityBonuses: next };
    }),
    allSkills: ALL_SKILLS.map((skill) => skill.name),
    allTools: ALL_TOOLS,
    allLanguages: ALL_LANGUAGES,
    raceFeatSearch: ctx.raceFeatSearch,
    setRaceFeatSearch: ctx.setRaceFeatSearch,
    filteredFeats,
    chosenRaceFeatId: ctx.form.chosenRaceFeatId,
    selectRaceFeat: (id, selected) => ctx.setForm((f) => ({
      ...f,
      chosenRaceFeatId: selected ? null : id,
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("race:"))),
    })),
    raceFeatDetail: ctx.raceFeatDetail,
    onBack: () => ctx.setStep(2),
    onNext: () => ctx.setStep(4),
  });
}
