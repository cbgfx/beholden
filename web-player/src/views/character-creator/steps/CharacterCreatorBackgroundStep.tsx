import React from "react";
import { C } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { PreparedSpellProgressionBlock } from "@/views/character/CharacterViewParts";
import { ABILITY_NAME_TO_KEY, ALL_SKILLS, ALL_TOOLS } from "../constants/CharacterCreatorConstants";
import { NavButtons } from "../shared/CharacterCreatorParts";
import { detailBoxStyle, headingStyle, inputStyle, labelStyle, profChipStyle, sourceTagStyle } from "../shared/CharacterCreatorStyles";
import { abilityNamesToKeys, parseStartingEquipmentOptions } from "../utils/CharacterCreatorUtils";

type StepResult = { main: React.ReactNode; side: React.ReactNode };

interface BackgroundSummaryLike {
  id: string;
  name: string;
}

interface BackgroundFeatSummaryLike {
  id: string;
  name: string;
}

interface BackgroundTraitLike {
  name: string;
  text: string;
  preparedSpellProgression?: PreparedSpellProgressionTable[];
}

interface BackgroundLanguagesLike {
  fixed: string[];
  choose: number;
  from: string[] | null;
}

interface BackgroundDetailLike {
  id: string;
  name: string;
  proficiency: string;
  equipment?: string;
  traits: BackgroundTraitLike[];
  proficiencies?: {
    skills: { fixed: string[]; choose: number; from: string[] | null };
    tools: { fixed: string[]; choose: number; from: string[] | null };
    languages: BackgroundLanguagesLike;
    feats: Array<{ name: string }>;
    featChoice: number;
    abilityScores?: string[];
    abilityScoreChoose?: number;
  };
}

interface BackgroundFormLike {
  bgId: string;
  chosenBgSkills: string[];
  chosenBgOriginFeatId: string | null;
  chosenBgTools: string[];
  chosenBgLanguages: string[];
  chosenBgEquipmentOption: string | null;
  chosenFeatOptions: Record<string, string[]>;
  bgAbilityMode: "split" | "even";
  bgAbilityBonuses: Record<string, number>;
}

function choiceButtonStyle(selected: boolean, locked = false): React.CSSProperties {
  return {
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: "var(--fs-subtitle)",
    cursor: locked ? "default" : "pointer",
    border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
    background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
    color: selected ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
    fontWeight: selected ? 700 : 400,
  };
}

export function renderBackgroundStep<TForm extends BackgroundFormLike>(args: {
  availableBackgrounds: BackgroundSummaryLike[];
  filteredBackgrounds: BackgroundSummaryLike[];
  bgSearch: string;
  setBgSearch: (value: string) => void;
  form: TForm;
  setForm: React.Dispatch<React.SetStateAction<TForm>>;
  selectBackground: (id: string) => void;
  bgDetail: BackgroundDetailLike | null;
  bgOriginFeatSearch: string;
  setBgOriginFeatSearch: (value: string) => void;
  filteredBgFeats: BackgroundFeatSummaryLike[];
  equipmentOptions: Array<{ id: string }>;
  onBack: () => void;
  onNext: () => void;
  step: number;
}): StepResult {
  const {
    availableBackgrounds,
    filteredBackgrounds,
    bgSearch,
    setBgSearch,
    form,
    setForm,
    selectBackground,
    bgDetail,
    bgOriginFeatSearch,
    setBgOriginFeatSearch,
    filteredBgFeats,
    equipmentOptions,
    onBack,
    onNext,
    step,
  } = args;
  const bgAbilityKeys = bgDetail?.proficiencies?.abilityScores ? abilityNamesToKeys(bgDetail.proficiencies.abilityScores) : [];
  const bgAbilityEvenTarget = bgDetail?.proficiencies?.abilityScoreChoose
    ? Math.min(bgAbilityKeys.length, Math.max(1, bgDetail.proficiencies.abilityScoreChoose))
    : bgAbilityKeys.length;
  const bgAbilityBonusCount = Object.keys(form.bgAbilityBonuses).length;
  const bgAbilityValid = bgAbilityKeys.length === 0
    || (form.bgAbilityMode === "split" ? bgAbilityBonusCount === 2 : bgAbilityBonusCount === bgAbilityEvenTarget);

  const bgChoicesMain = bgDetail
    ? (() => {
        const prof = bgDetail.proficiencies;
        const tools = prof?.tools ?? { fixed: [], choose: 0, from: null };
        const equipOptions = parseStartingEquipmentOptions(bgDetail.equipment);

        function toggleBgChoice(item: string, key: "chosenBgTools" | "chosenBgLanguages", max: number) {
          setForm((prev) => {
            const current = prev[key];
            const next = current.includes(item)
              ? current.filter((value) => value !== item)
              : current.length < max
                ? [...current, item]
                : current;
            return { ...prev, [key]: next };
          });
        }

        return (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            {prof && prof.skills.choose > 0 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Skill Proficiencies </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                  <span style={{ marginLeft: 8, fontSize: "var(--fs-small)", color: form.chosenBgSkills.length >= prof.skills.choose ? C.accentHl : C.muted }}>
                    {form.chosenBgSkills.length} / {prof.skills.choose}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(prof.skills.from ?? ALL_SKILLS.map((skill) => skill.name)).map((skill) => {
                    const selected = form.chosenBgSkills.includes(skill);
                    const locked = !selected && form.chosenBgSkills.length >= prof.skills.choose;
                    return (
                      <button
                        key={skill}
                        type="button"
                        disabled={locked}
                        onClick={() =>
                          setForm((prev) => {
                            const current = prev.chosenBgSkills;
                            const next = current.includes(skill)
                              ? current.filter((value) => value !== skill)
                              : current.length < prof.skills.choose
                                ? [...current, skill]
                                : current;
                            return { ...prev, chosenBgSkills: next };
                          })
                        }
                        style={choiceButtonStyle(selected, locked)}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {prof && prof.feats.length > 0 && prof.featChoice === 0 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Feat </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {prof.feats.map((feat) => (
                    <span key={feat.name} style={profChipStyle}>{feat.name}</span>
                  ))}
                </div>
              </div>
            )}

            {prof && prof.featChoice > 0 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Origin Feat </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                </div>
                <input
                  type="text"
                  value={bgOriginFeatSearch}
                  onChange={(e) => setBgOriginFeatSearch(e.target.value)}
                  placeholder="Search origin feats..."
                  style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                  {filteredBgFeats.map((feat) => {
                    const selected = form.chosenBgOriginFeatId === feat.id;
                    return (
                      <button
                        key={feat.id}
                        type="button"
                        onClick={() => setForm((prev) => ({
                          ...prev,
                          chosenBgOriginFeatId: selected ? null : feat.id,
                          chosenFeatOptions: Object.fromEntries(
                            Object.entries((prev as typeof prev & { chosenFeatOptions?: Record<string, string[]> }).chosenFeatOptions ?? {})
                              .filter(([key]) => !key.startsWith("bg:"))
                          ),
                        }))}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          fontSize: "var(--fs-subtitle)",
                          cursor: "pointer",
                          border: `2px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: selected ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                          color: selected ? C.accentHl : C.text,
                          fontWeight: selected ? 700 : 400,
                        }}
                      >
                        {feat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(tools.fixed.length > 0 || tools.choose > 0) && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Tools </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                </div>
                {tools.fixed.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: tools.choose > 0 ? 8 : 0 }}>
                    {tools.fixed.map((tool) => (
                      <span key={tool} style={profChipStyle}>{tool}</span>
                    ))}
                  </div>
                )}
                {tools.choose > 0 && (
                  <>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 6 }}>
                      Choose {tools.choose} ({form.chosenBgTools.length}/{tools.choose})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(tools.from ?? ALL_TOOLS).map((tool) => {
                        const selected = form.chosenBgTools.includes(tool);
                        const locked = !selected && form.chosenBgTools.length >= tools.choose;
                        return (
                          <button
                            key={tool}
                            type="button"
                            disabled={locked}
                            onClick={() => toggleBgChoice(tool, "chosenBgTools", tools.choose)}
                            style={choiceButtonStyle(selected, locked)}
                          >
                            {tool}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {prof?.abilityScores && prof.abilityScores.length > 0 && (() => {
              const abilityKeys = abilityNamesToKeys(prof.abilityScores);
              const evenTarget = prof.abilityScoreChoose
                ? Math.min(abilityKeys.length, Math.max(1, prof.abilityScoreChoose))
                : abilityKeys.length;
              const bonuses = form.bgAbilityBonuses;
              const mode = form.bgAbilityMode;

              function setMode(nextMode: "split" | "even") {
                setForm((prev) => ({ ...prev, bgAbilityMode: nextMode, bgAbilityBonuses: {} }));
              }

              function handleSplitClick(key: string) {
                setForm((prev) => {
                  const current = { ...prev.bgAbilityBonuses };
                  if (current[key]) {
                    delete current[key];
                    return { ...prev, bgAbilityBonuses: current };
                  }
                  if (Object.keys(current).length >= 2) return prev;
                  current[key] = Object.values(current).includes(2) ? 1 : 2;
                  return { ...prev, bgAbilityBonuses: current };
                });
              }

              function handleEvenClick(key: string) {
                setForm((prev) => {
                  const current = { ...prev.bgAbilityBonuses };
                  if (current[key]) delete current[key];
                  else if (Object.keys(current).length < evenTarget) current[key] = 1;
                  return { ...prev, bgAbilityBonuses: current };
                });
              }

              const splitDone = Object.keys(bonuses).length === 2;
              const evenDone = Object.keys(bonuses).length === evenTarget;

              return (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Ability Scores </span>
                    <span style={sourceTagStyle}>{bgDetail.name}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    {(["split", "even"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setMode(option)}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 20,
                          cursor: "pointer",
                          fontSize: "var(--fs-small)",
                          fontWeight: 600,
                          border: `1px solid ${mode === option ? C.colorMagic : "rgba(255,255,255,0.15)"}`,
                          background: mode === option ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                          color: mode === option ? C.colorMagic : C.muted,
                        }}
                      >
                        {option === "split" ? "+2 / +1" : (evenTarget < abilityKeys.length ? `+1 x${evenTarget}` : "+1 each")}
                      </button>
                    ))}
                  </div>
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 8 }}>
                    {mode === "split"
                      ? splitDone
                        ? "All bonuses assigned"
                        : !Object.values(bonuses).includes(2)
                          ? "Click to assign +2"
                          : "Click another for +1"
                      : evenDone
                        ? "All bonuses assigned"
                        : `Click abilities to assign +1 (${Object.keys(bonuses).length}/${evenTarget})`}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {prof.abilityScores.map((abilityName) => {
                      const key = ABILITY_NAME_TO_KEY[abilityName.toLowerCase()] ?? "";
                      const bonus = key ? bonuses[key] : undefined;
                      const isSelected = bonus != null;
                      const canSelect = mode === "split"
                        ? !isSelected && Object.keys(bonuses).length < 2
                        : !isSelected && Object.keys(bonuses).length < evenTarget;
                      return (
                        <button
                          key={abilityName}
                          type="button"
                          onClick={() => key && (mode === "split" ? handleSplitClick(key) : handleEvenClick(key))}
                          style={{
                            padding: "6px 16px",
                            borderRadius: 6,
                            cursor: canSelect || isSelected ? "pointer" : "default",
                            border: `1px solid ${isSelected ? C.colorMagic : canSelect ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.12)"}`,
                            background: isSelected ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.055)",
                            color: isSelected ? C.colorMagic : canSelect ? "rgba(167,139,250,0.7)" : C.muted,
                            fontSize: "var(--fs-subtitle)",
                            fontWeight: isSelected ? 700 : 400,
                            opacity: !canSelect && !isSelected ? 0.45 : 1,
                          }}
                        >
                          {abilityName}
                          {isSelected && <span style={{ marginLeft: 5, fontWeight: 800 }}>{bonus! > 0 ? `+${bonus}` : bonus}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {bgDetail.equipment && equipOptions.length > 0 && (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Starting Equipment </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {equipOptions.map((option) => {
                    const selected = form.chosenBgEquipmentOption === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, chosenBgEquipmentOption: option.id }))}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: "var(--fs-subtitle)",
                          fontWeight: selected ? 700 : 400,
                          border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                          color: selected ? C.accentHl : C.text,
                        }}
                      >
                        Option {option.id}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {equipOptions.map((option) => {
                    const selected = form.chosenBgEquipmentOption === option.id;
                    return (
                      <div
                        key={`bg-eq-${option.id}`}
                        style={{
                          borderRadius: 8,
                          border: `1px solid ${selected ? `${C.accentHl}66` : "rgba(255,255,255,0.12)"}`,
                          background: selected ? "rgba(56,182,255,0.10)" : "rgba(255,255,255,0.03)",
                          padding: "8px 10px",
                        }}
                      >
                        <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: selected ? C.accentHl : C.text, marginBottom: 4 }}>
                          Option {option.id}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {option.entries.map((entry, index) => (
                            <div key={`bg-eq-${option.id}-${index}`} style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.45 }}>
                              {entry}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {form.chosenBgEquipmentOption && (
                  <div style={{ color: C.accentHl, fontSize: "var(--fs-small)", marginTop: 8 }}>
                    Inventory will start with option {form.chosenBgEquipmentOption}.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()
    : null;

  const side = bgDetail
    ? (() => {
        const prof = bgDetail.proficiencies;
        const skills = prof?.skills ?? { fixed: bgDetail.proficiency.split(/[,;]/).map((value) => value.trim()).filter(Boolean), choose: 0, from: null };
        const languages = prof?.languages ?? { fixed: [], choose: 0, from: null };
        const flavorTraits = bgDetail.traits.filter((trait) => !/tool|language|starting equipment/i.test(trait.name)).slice(0, 2);

        return (
          <div style={detailBoxStyle}>
            <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", marginBottom: 10, color: C.accentHl }}>{bgDetail.name}</div>

            {(skills.fixed.length > 0 || skills.choose > 0) && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Skills </span>
                <span style={sourceTagStyle}>{bgDetail.name}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  {skills.fixed.map((skill) => <span key={skill} style={profChipStyle}>{skill}</span>)}
                  {skills.choose > 0 && (
                    <span style={{ ...profChipStyle, fontStyle: "italic", opacity: 0.7 }}>
                      Choose {skills.choose} skill{skills.choose > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

            {languages.fixed.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Languages </span>
                <span style={sourceTagStyle}>{bgDetail.name}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  {languages.fixed.map((language) => <span key={language} style={profChipStyle}>{language}</span>)}
                </div>
              </div>
            )}

            {((prof?.feats && prof.feats.length > 0) || (prof?.featChoice ?? 0) > 0) && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Feat </span>
                <span style={sourceTagStyle}>{bgDetail.name}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  {prof?.feats.map((feat) => (
                    <span
                      key={feat.name}
                      style={{ ...profChipStyle, background: "rgba(56,182,255,0.15)", border: "1px solid rgba(56,182,255,0.4)", color: C.accentHl }}
                    >
                      {feat.name}
                    </span>
                  ))}
                  {(prof?.featChoice ?? 0) > 0 && (
                    <span style={{ ...profChipStyle, fontStyle: "italic", opacity: 0.7 }}>Choose 1 origin feat</span>
                  )}
                </div>
              </div>
            )}

            {bgDetail.equipment && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Equipment </span>
                {parseStartingEquipmentOptions(bgDetail.equipment).length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 5 }}>
                    {parseStartingEquipmentOptions(bgDetail.equipment).map((option) => (
                      <div key={`bg-side-eq-${option.id}`} style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", padding: "6px 8px" }}>
                        <div style={{ color: C.text, fontSize: "var(--fs-small)", fontWeight: 700, marginBottom: 3 }}>Option {option.id}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {option.entries.map((entry, index) => (
                            <div key={`bg-side-eq-${option.id}-${index}`} style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
                              {entry}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 4, lineHeight: 1.6 }}>
                    {bgDetail.equipment.slice(0, 300)}{bgDetail.equipment.length > 300 ? "..." : ""}
                  </div>
                )}
              </div>
            )}

            {flavorTraits.map((trait) => (
              <div key={trait.name} style={{ marginBottom: 6, fontSize: "var(--fs-small)" }}>
                <span style={{ fontWeight: 700, color: C.accentHl }}>{trait.name}. </span>
                <span style={{ color: "rgba(160,180,220,0.65)" }}>{trait.text.replace(/Source:.*$/m, "").trim()}</span>
                {trait.preparedSpellProgression?.length ? (
                  <PreparedSpellProgressionBlock tables={trait.preparedSpellProgression} compact accentColor={C.accentHl} />
                ) : null}
              </div>
            ))}
          </div>
        );
      })()
    : (
      <div style={{ color: C.muted, fontSize: "var(--fs-subtitle)", padding: "12px 0" }}>Select a background to see its details.</div>
    );

  const main = (
    <div>
      <h2 style={headingStyle}>Choose a Background</h2>
      {availableBackgrounds.length === 0 ? (
        <p style={{ color: C.muted }}>No backgrounds found in compendium.</p>
      ) : (
        <>
          <input
            value={bgSearch}
            onChange={(e) => setBgSearch(e.target.value)}
            placeholder="Search backgrounds..."
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
            {filteredBackgrounds.length === 0 && (
              <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>
            )}
            {filteredBackgrounds.map((background) => {
              const selected = form.bgId === background.id;
              return (
                <button
                  type="button"
                  key={background.id}
                  onClick={() => selectBackground(background.id)}
                  style={{
                    padding: "10px 13px",
                    borderRadius: 8,
                    textAlign: "left",
                    border: `2px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                    background: selected ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                    color: selected ? C.accentHl : C.text,
                    cursor: "pointer",
                    fontWeight: selected ? 700 : 500,
                    fontSize: "var(--fs-subtitle)",
                    transition: "border-color 0.12s, background 0.12s",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {background.name}
                </button>
              );
            })}
          </div>
        </>
      )}
      {bgChoicesMain}
      <NavButtons
        step={step}
        onBack={onBack}
        onNext={onNext}
        nextDisabled={!form.bgId || bgDetail?.id !== form.bgId || !bgAbilityValid || (equipmentOptions.length > 0 && !form.chosenBgEquipmentOption)}
      />
    </div>
  );

  return { main, side };
}
