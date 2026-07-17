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

interface RaceSummaryLike {
  id: string;
  name: string;
  speed?: number | null;
}

interface RaceDetailLike {
  name: string;
  speed: number | null;
  size: string | null;
  traits: Array<{ name: string; text: string; modifier: string[]; preparedSpellProgression?: PreparedSpellProgressionTable[]; effects?: unknown[] }>;
}

interface RaceChoiceSetLike {
  hasChosenSize: boolean;
  hasFeatChoice: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
  spellcastingAbilityChoice: { options: string[] } | null;
}

function SourceTag({ value }: { value: string | null | undefined }) {
  const label = String(value ?? "").trim();
  return label ? <span style={sourceTagStyle}>{label}</span> : null;
}

export function renderSpeciesStep({
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
  // Derived from the species' own trait effects, not a separately-authored vision/resistances
  // field — one fact, one home (COMPENDIUM_VALIDATION.md's schema tenets).
  const raceTraitEffects = raceDetail ? parseAppliedSpeciesTraitEffects(raceDetail) : [];
  const derivedSenses = collectSensesFromEffects(raceTraitEffects);
  const derivedResistances = collectDefensesFromEffects(raceTraitEffects).resistances;
  const nextDisabled =
    !selectedRaceId
    || missingRaceSize
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

      {raceDetail && raceChoices && (raceChoices.hasChosenSize || skillChoice || toolChoice || languageChoice || raceChoices.hasFeatChoice || spellAbilityChoice) && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
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

      <NavButtons step={2} onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} />
    </div>
  );

  const side = raceDetail ? (
    <div style={detailBoxStyle}>
      <div style={{ fontWeight: 700, fontSize: "var(--fs-body)", color: C.accentHl, marginBottom: 10 }}>{raceDetail.name}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
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
