import React from "react";
import { Select } from "@/ui/Select";
import { C } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { ABILITY_KEYS, ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { abilityNamesToKeys, parseSkillList } from "../utils/CharacterCreatorUtils";
import { NavButtons } from "../shared/CharacterCreatorParts";
import {
  collectPreparedSpellProgressionTables,
} from "./CharacterCreatorPanelHelpers";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  profChipStyle,
  sourceTagStyle,
  statLabelStyle, statValueStyle,
} from "../shared/CharacterCreatorStyles";
import { PreparedSpellProgressionBlock } from "@/views/character/CharacterViewParts";

interface OptionalGroupLike {
  level: number;
  features: Array<{ name: string; text: string; preparedSpellProgression?: PreparedSpellProgressionTable[] }>;
}

interface FeatureGrantBadge {
  label: string;
  color: string;
}

interface TaggedItemLike {
  name: string;
  source: string;
}

type StepNumber = number;

export function renderLevelStep({
  level,
  setLevel,
  subclass,
  setSubclass,
  showSubclass,
  subclassList,
  optGroups,
  chosenOptionals,
  toggleOptional,
  parseFeatureGrants,
  classEquipmentText,
  classEquipmentOptions,
  chosenClassEquipmentOption,
  chooseClassEquipmentOption,
  className,
  features,
  levelUpFeatChoices,
  levelUpScores,
  toggleLevelUpChoiceMode,
  toggleLevelUpAsiPoint,
  chooseLevelUpFeat,
  levelUpFeatConflict,
  onBack,
  onNext,
}: {
  level: number;
  setLevel: (level: number) => void;
  subclass: string;
  setSubclass: (value: string) => void;
  showSubclass: boolean | null;
  subclassList: string[];
  optGroups: OptionalGroupLike[];
  chosenOptionals: string[];
  toggleOptional: (name: string, exclusive: boolean, groupFeatures: string[]) => void;
  parseFeatureGrants: (text: string) => { armor: string[]; weapons: string[]; tools: string[]; skills: string[]; languages: string[] };
  classEquipmentText: string;
  classEquipmentOptions: Array<{ id: string }>;
  chosenClassEquipmentOption: string | null;
  chooseClassEquipmentOption: (id: string) => void;
  className: string | null;
  features: Array<{ level: number; name: string; text: string; preparedSpellProgression?: PreparedSpellProgressionTable[] }>;
  levelUpFeatChoices: Array<{
    level: number;
    mode: "asi" | "feat" | null;
    selectedFeatId: string | null;
    options: Array<{ id: string; name: string }>;
    asiBonuses: Record<string, number>;
  }>;
  levelUpScores: Record<number, Record<string, number>>;
  toggleLevelUpChoiceMode: (level: number, mode: "asi" | "feat") => void;
  toggleLevelUpAsiPoint: (level: number, ability: string) => void;
  chooseLevelUpFeat: (level: number, featId: string) => void;
  levelUpFeatConflict: boolean;
  onBack: () => void;
  onNext: () => void;
}): { main: React.ReactNode; side: React.ReactNode } {
  const main = (
    <div>
      <h2 style={headingStyle}>Choose Level</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
        <label style={{ color: C.muted, fontWeight: 600 }}>Level</label>
        <input
          type="number"
          min={1}
          max={20}
          value={level}
          onChange={(e) => setLevel(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
          style={{ ...inputStyle, width: 80 }}
        />
      </div>

      {showSubclass && (
        <div style={{ marginBottom: 20 }}>
          <label style={{ ...labelStyle }}>Subclass</label>
          <Select value={subclass} onChange={(e) => setSubclass(e.target.value)} style={{ width: 280 }}>
            <option value="">— Choose subclass —</option>
            {subclassList.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      )}

      {optGroups.map((grp) => {
        const names = grp.features.map((f) => f.name);
        const isPickOne = grp.features.length <= 4;
        return (
          <div key={grp.level} style={{ marginBottom: 20 }}>
            <div style={{ ...labelStyle, marginBottom: 8 }}>
              Level {grp.level} — {isPickOne ? "Choose one" : "Choose any"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {grp.features.map((f) => {
                const chosen = chosenOptionals.includes(f.name);
                const grants = parseFeatureGrants(f.text);
                const grantBadges: FeatureGrantBadge[] = [
                  ...grants.armor.map((n) => ({ label: n, color: C.colorMagic })),
                  ...grants.weapons.map((n) => ({ label: n, color: C.colorPinkRed })),
                  ...grants.tools.map((n) => ({ label: n, color: C.colorOrange })),
                  ...grants.skills.map((n) => ({ label: n, color: "#34d399" })),
                  ...grants.languages.map((n) => ({ label: `${n} (lang)`, color: C.colorRitual })),
                ];
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => toggleOptional(f.name, isPickOne, names)}
                    style={{
                      textAlign: "left",
                      padding: "11px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: `2px solid ${chosen ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: chosen ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      transition: "border-color 0.12s, background 0.12s",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: chosen ? C.accentHl : C.text }}>{f.name}</div>
                    {f.text && (
                      <div style={{ color: "rgba(160,180,220,0.65)", fontSize: "var(--fs-small)", marginTop: 3, lineHeight: 1.45 }}>
                        {f.text.replace(/Source:.*$/m, "").trim().slice(0, 140)}
                        {f.text.length > 140 ? "…" : ""}
                      </div>
                    )}
                    {grantBadges.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                        {grantBadges.map((b, i) => (
                          <span key={`${b.label}:${b.color}:${i}`} style={{ fontSize: "var(--fs-small)", fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: b.color + "22", border: `1px solid ${b.color}66`, color: b.color, letterSpacing: "0.02em" }}>
                            {b.label}
                          </span>
                        ))}
                      </div>
                    )}
                    {f.preparedSpellProgression?.length ? (
                      <PreparedSpellProgressionBlock tables={f.preparedSpellProgression} compact accentColor={chosen ? C.accentHl : C.colorMagic} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {levelUpFeatChoices.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Level-Up Feats</div>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 10 }}>
            Choose feats for each Ability Score Improvement level included in this starting level.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {levelUpFeatChoices.map((choice) => (
              <div key={choice.level}>
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.accentHl, marginBottom: 6 }}>Level {choice.level}</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => toggleLevelUpChoiceMode(choice.level, "asi")}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: `1px solid ${choice.mode === "asi" ? C.accentHl : "rgba(255,255,255,0.14)"}`,
                      background: choice.mode === "asi" ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: choice.mode === "asi" ? C.accentHl : "rgba(160,180,220,0.7)",
                      fontWeight: choice.mode === "asi" ? 700 : 500,
                      fontSize: "var(--fs-small)",
                    }}
                  >
                    Ability Score Improvement
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLevelUpChoiceMode(choice.level, "feat")}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: `1px solid ${choice.mode === "feat" ? C.accentHl : "rgba(255,255,255,0.14)"}`,
                      background: choice.mode === "feat" ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: choice.mode === "feat" ? C.accentHl : "rgba(160,180,220,0.7)",
                      fontWeight: choice.mode === "feat" ? 700 : 500,
                      fontSize: "var(--fs-small)",
                    }}
                  >
                    Level-Up Feat
                  </button>
                </div>
                <Select
                  value={choice.selectedFeatId ?? ""}
                  onChange={(e) => chooseLevelUpFeat(choice.level, e.target.value)}
                  disabled={choice.mode !== "feat"}
                  style={{ width: "100%", maxWidth: 380, opacity: choice.mode === "feat" ? 1 : 0.55 }}
                >
                  <option value="">- Choose feat -</option>
                  {choice.options.map((feat) => (
                    <option key={feat.id} value={feat.id}>{feat.name}</option>
                  ))}
                </Select>
                {choice.mode === "asi" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
                    {ABILITY_KEYS.map((ability) => {
                      const current = levelUpScores[choice.level]?.[ability] ?? 10;
                      const bonus = choice.asiBonuses[ability] ?? 0;
                      const totalAssigned = Object.values(choice.asiBonuses).reduce((sum, value) => sum + value, 0);
                      const capped = current >= 20;
                      const blocked = bonus === 0 && (totalAssigned >= 2 || capped);
                      return (
                        <button
                          key={`${choice.level}:${ability}`}
                          type="button"
                          disabled={blocked}
                          onClick={() => toggleLevelUpAsiPoint(choice.level, ability)}
                          style={{
                            padding: "10px 8px",
                            borderRadius: 8,
                            textAlign: "center",
                            cursor: blocked ? "default" : "pointer",
                            border: `1px solid ${bonus > 0 ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                            background: bonus > 0 ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                            color: blocked && bonus === 0 ? "rgba(160,180,220,0.4)" : C.text,
                          }}
                        >
                          <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 3 }}>{ABILITY_LABELS[ability]}</div>
                          <div style={{ fontWeight: 800, fontSize: "var(--fs-medium)" }}>
                            {Math.min(20, current + bonus)}
                            {bonus > 0 ? <span style={{ fontSize: "var(--fs-small)", color: C.accentHl }}> +{bonus}</span> : null}
                          </div>
                          <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{capped && bonus === 0 ? "MAX" : bonus > 0 ? "Click to remove" : "Click to add"}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          {levelUpFeatConflict && (
            <div style={{ color: C.red, fontSize: "var(--fs-small)", marginTop: 10 }}>
              A non-repeatable feat has been selected more than once.
            </div>
          )}
        </div>
      )}

      {classEquipmentText && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>
            Class Starting Equipment {className && <span style={sourceTagStyle}>{className}</span>}
          </div>
          {classEquipmentOptions.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              {classEquipmentOptions.map((option) => {
                const selected = chosenClassEquipmentOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => chooseClassEquipmentOption(option.id)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 20,
                      cursor: "pointer",
                      fontSize: "var(--fs-small)",
                      fontWeight: 600,
                      border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.15)"}`,
                      background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.04)",
                      color: selected ? C.accentHl : C.muted,
                    }}
                  >
                    Option {option.id}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.6 }}>{classEquipmentText}</div>
          {chosenClassEquipmentOption && classEquipmentOptions.length > 0 && (
            <div style={{ color: C.accentHl, fontSize: "var(--fs-small)", marginTop: 8 }}>
              Inventory will start with class option {chosenClassEquipmentOption}.
            </div>
          )}
        </div>
      )}

      <NavButtons
        step={5}
        onBack={onBack}
        onNext={onNext}
        nextDisabled={
          (classEquipmentOptions.length > 0 && !chosenClassEquipmentOption)
          || levelUpFeatChoices.some((choice) => (
            !choice.mode
            || (choice.mode === "feat" && !choice.selectedFeatId)
            || (choice.mode === "asi" && Object.values(choice.asiBonuses).reduce((sum, value) => sum + value, 0) !== 2)
          ))
          || levelUpFeatConflict
        }
      />
    </div>
  );

  const side = (
    <div style={{ ...detailBoxStyle, maxHeight: 600, overflowY: "auto" }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: "var(--fs-subtitle)", color: C.accentHl }}>Class Features — Level {level}</div>
      {features.length === 0 && <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>No features yet. Select a class first.</div>}
      {features.map((f, i) => (
        <div key={`${f.level}:${f.name}`} style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-small)", color: C.accentHl }}>Lv{f.level} · {f.name}</div>
          <div style={{ color: "rgba(160,180,220,0.65)", fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
            {f.text.replace(/Source:.*$/m, "").trim()}
          </div>
          {f.preparedSpellProgression?.length ? (
            <PreparedSpellProgressionBlock tables={f.preparedSpellProgression} compact accentColor={C.accentHl} />
          ) : null}
        </div>
      ))}
    </div>
  );
  return { main, side };
}

