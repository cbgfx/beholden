import React from "react";
import { Select } from "@/ui/Select";
import { C } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { ABILITY_KEYS, ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { abilityNamesToKeys, parseSkillList } from "../utils/CharacterCreatorUtils";
import { ItemPicker, NavButtons, SpellPicker } from "../shared/CharacterCreatorParts";
import {
  collectPreparedSpellProgressionTables,
  renderChoiceChipGroup,
  renderClassFeatSingleChoicePanel,
  type Step5ClassFeatChoiceLike,
} from "./CharacterCreatorPanelHelpers";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  profChipStyle,
  sourceTagStyle,
  statLabelStyle,
  statValueStyle,
} from "../shared/CharacterCreatorStyles";
import { PreparedSpellProgressionBlock } from "@/views/character/CharacterViewParts";

interface ClassSummaryLike {
  id: string;
  name: string;
  hd: number | null;
}

interface ClassDetailLike {
  name: string;
  hd: number | null;
  numSkills: number;
  proficiency: string;
  slotsReset: string;
  armor: string;
  weapons: string;
  description: string;
  autolevels: Array<{
    level: number;
    features: Array<{ name: string; text: string; optional: boolean; preparedSpellProgression?: PreparedSpellProgressionTable[] }>;
  }>;
}

interface CampaignLike {
  id: string;
  name: string;
}

interface RaceSummaryLike {
  id: string;
  name: string;
  speed?: number | null;
}

interface RaceDetailLike {
  name: string;
  speed: number | null;
  size: string | null;
  vision: Array<{ type: string; range: number }>;
  resist: string | null;
  traits: Array<{ name: string; text: string; preparedSpellProgression?: PreparedSpellProgressionTable[] }>;
}

interface RaceChoiceSetLike {
  hasChosenSize: boolean;
  hasFeatChoice: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
}

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

function getPrimaryAbilityKeys(classDetail: ClassDetailLike | null): string[] {
  if (!classDetail) return [];
  for (const al of classDetail.autolevels) {
    if (al.level !== 1) continue;
    for (const feature of al.features) {
      const match = feature.text.match(/Primary Ability:\s*([^\n]+)/i);
      if (match) {
        return abilityNamesToKeys(match[1].split(/,|\s+and\s+|\s+or\s+/i).map((s) => s.trim()).filter(Boolean));
      }
    }
  }
  return [];
}

export function renderClassStep({
  classes,
  classSearch,
  setClassSearch,
  form,
  onSelectClass,
  onNext,
  classDetail,
  abilityLabels,
}: {
  classes: ClassSummaryLike[];
  classSearch: string;
  setClassSearch: (value: string) => void;
  form: { classId: string };
  onSelectClass: (id: string) => void;
  onNext: () => void;
  classDetail: ClassDetailLike | null;
  abilityLabels: Record<string, string>;
}): { main: React.ReactNode; side: React.ReactNode } {
  const classPreparedSpellProgression = classDetail
    ? collectPreparedSpellProgressionTables(
        classDetail.autolevels.flatMap((autolevel) =>
          autolevel.features.filter((feature) => !feature.optional)
        )
      )
    : [];
  const filtered = classSearch
    ? classes.filter((c) => c.name.toLowerCase().includes(classSearch.toLowerCase()))
    : classes;

  const main = (
    <div>
      <h2 style={headingStyle}>Choose a Class</h2>

      {classes.length === 0 ? (
        <p style={{ color: C.muted }}>No classes found. Ask your DM to upload a class compendium XML.</p>
      ) : (
        <>
          <input
            value={classSearch}
            onChange={(e) => setClassSearch(e.target.value)}
            placeholder="Search classes…"
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
            {filtered.length === 0 && <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>}
            {filtered.map((c) => {
              const sel = form.classId === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => onSelectClass(c.id)}
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
                  {c.name}
                  {c.hd && <span style={{ color: "rgba(160,180,220,0.5)", fontSize: "var(--fs-small)", marginLeft: 6 }}>d{c.hd}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      <NavButtons step={1} onBack={() => {}} onNext={onNext} nextDisabled={!form.classId} />
    </div>
  );

  const side = classDetail ? (
    <div style={detailBoxStyle}>
      <div style={{ fontWeight: 700, fontSize: "var(--fs-body)", color: C.accentHl, marginBottom: 12 }}>{classDetail.name}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        {classDetail.hd && (
          <div>
            <div style={statLabelStyle}>Hit Die</div>
            <div style={statValueStyle}>d{classDetail.hd}</div>
          </div>
        )}
        {(() => {
          const keys = getPrimaryAbilityKeys(classDetail);
          return keys.length > 0 ? (
            <div>
              <div style={statLabelStyle}>Primary</div>
              <div style={statValueStyle}>{keys.map((k) => abilityLabels[k]).join(" / ")}</div>
            </div>
          ) : null;
        })()}
        {classDetail.slotsReset && (
          <div>
            <div style={statLabelStyle}>Spell Reset</div>
            <div style={statValueStyle}>
              {classDetail.slotsReset === "L" ? "Long Rest" : classDetail.slotsReset === "S" ? "Short Rest" : classDetail.slotsReset}
            </div>
          </div>
        )}
      </div>
      {classDetail.armor && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Armor </span>
          <span style={{ fontSize: "var(--fs-small)" }}>{classDetail.armor}</span>
        </div>
      )}
      {classDetail.weapons && (
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Weapons </span>
          <span style={{ fontSize: "var(--fs-small)" }}>{classDetail.weapons}</span>
        </div>
      )}
      {classDetail.numSkills > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Skills </span>
          <span style={{ fontSize: "var(--fs-small)" }}>Choose {classDetail.numSkills} from: {parseSkillList(classDetail.proficiency).join(", ")}</span>
        </div>
      )}
      {classDetail.description && (
        <div style={{ color: "rgba(160,180,220,0.65)", fontSize: "var(--fs-small)", lineHeight: 1.6, marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
          {classDetail.description.slice(0, 500)}
          {classDetail.description.length > 500 ? "…" : ""}
        </div>
      )}
      {classPreparedSpellProgression.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 700, marginBottom: 8 }}>Prepared Spell Progression</div>
          <PreparedSpellProgressionBlock tables={classPreparedSpellProgression} compact accentColor={C.accentHl} />
        </div>
      )}
    </div>
  ) : (
    <div style={{ color: C.muted, fontSize: "var(--fs-subtitle)", padding: "12px 0" }}>Select a class to see its details.</div>
  );

  return { main, side };
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
  const missingRaceSize = Boolean(raceChoices?.hasChosenSize && !chosenRaceSize);
  const missingRaceSkills = Boolean(skillChoice && chosenRaceSkills.length < skillChoice.count);
  const missingRaceTools = Boolean(toolChoice && chosenRaceTools.length < toolChoice.count);
  const missingRaceLanguages = Boolean(languageChoice && chosenRaceLanguages.length < languageChoice.count);
  const missingRaceFeat = Boolean(raceChoices?.hasFeatChoice && !chosenRaceFeatId);
  const nextDisabled =
    !selectedRaceId
    || missingRaceSize
    || missingRaceSkills
    || missingRaceTools
    || missingRaceLanguages
    || missingRaceFeat;

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

      {raceDetail && raceChoices && (raceChoices.hasChosenSize || skillChoice || toolChoice || languageChoice || raceChoices.hasFeatChoice) && (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {raceChoices.hasChosenSize && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 8 }}>Size <span style={sourceTagStyle}>{raceDetail.name}</span></div>
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
                <div style={{ ...labelStyle, margin: 0 }}>Skill Proficiency <span style={sourceTagStyle}>{raceDetail.name}</span></div>
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
                <div style={{ ...labelStyle, margin: 0 }}>Tool Proficiency <span style={sourceTagStyle}>{raceDetail.name}</span></div>
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
                <div style={{ ...labelStyle, margin: 0 }}>Language <span style={sourceTagStyle}>{raceDetail.name}</span></div>
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
              <div style={{ ...labelStyle, marginBottom: 8 }}>Origin Feat <span style={sourceTagStyle}>{raceDetail.name}</span></div>
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
        {raceDetail.vision.length > 0 && <div><div style={statLabelStyle}>Vision</div><div style={statValueStyle}>{raceDetail.vision.map((v) => `${v.type} ${v.range}ft`).join(", ")}</div></div>}
        {raceDetail.resist && <div><div style={statLabelStyle}>Resist</div><div style={statValueStyle}>{raceDetail.resist}</div></div>}
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

export function renderIdentityStep({
  form,
  setField,
  portraitInputRef,
  portraitPreview,
  setPortraitFile,
  setPortraitPreview,
  onBack,
  onNext,
  side,
}: {
  form: Record<string, unknown> & { [key: string]: unknown };
  setField: (key: string, value: string) => void;
  portraitInputRef: React.RefObject<HTMLInputElement | null>;
  portraitPreview: string | null;
  setPortraitFile: (file: File | null) => void;
  setPortraitPreview: (value: string | null) => void;
  onBack: () => void;
  onNext: () => void;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  const colors = [C.accentHl, C.green, C.accent, C.red, C.colorMagic, C.colorOrange, "#e879f9", "#94a3b8"];
  const ALIGNMENTS = [
    "", "Lawful Good", "Neutral Good", "Chaotic Good",
    "Lawful Neutral", "True Neutral", "Chaotic Neutral",
    "Lawful Evil", "Neutral Evil", "Chaotic Evil",
  ];
  const detailFields: Array<{ key: string; label: string; placeholder: string }> = [
    { key: "hair", label: "Hair", placeholder: "Black, braided" },
    { key: "skin", label: "Skin", placeholder: "Tan, scarred" },
    { key: "heightText", label: "Height", placeholder: "6'2\"" },
    { key: "age", label: "Age", placeholder: "32" },
    { key: "weight", label: "Weight", placeholder: "190 lb" },
    { key: "gender", label: "Gender", placeholder: "Female" },
  ];

  function handlePortraitChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPortraitFile(file);
    const url = URL.createObjectURL(file);
    setPortraitPreview(url);
  }

  const main = (
    <div>
      <h2 style={headingStyle}>Character Identity</h2>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <input ref={portraitInputRef as React.RefObject<HTMLInputElement>} type="file" accept="image/*" onChange={handlePortraitChange} style={{ display: "none" }} />
          <div
            onClick={() => portraitInputRef.current?.click()}
            style={{
              width: 110,
              height: 110,
              borderRadius: 12,
              cursor: "pointer",
              border: `2px dashed ${portraitPreview ? C.accentHl : "rgba(255,255,255,0.25)"}`,
              background: portraitPreview ? "#000" : "rgba(255,255,255,0.04)",
              overflow: "hidden",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Click to set portrait"
          >
            {portraitPreview ? (
              <img src={portraitPreview} alt="Portrait" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ opacity: 0.3 }}>Portrait</div>
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0)",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 6,
              }}
            >
              <span style={{ fontSize: "var(--fs-tiny)", color: "rgba(255,255,255,0.55)", background: "rgba(0,0,0,0.55)", padding: "2px 6px", borderRadius: 4 }}>
                {portraitPreview ? "Change" : "Add photo"}
              </span>
            </div>
          </div>
          {portraitPreview && (
            <button type="button" onClick={() => { setPortraitFile(null); setPortraitPreview(null); }} style={{ fontSize: "var(--fs-small)", color: C.muted, background: "none", border: "none", cursor: "pointer" }}>
              Remove
            </button>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minWidth: 220 }}>
          <div>
            <label style={labelStyle}>Character Name *</label>
            <input
              value={String(form.characterName ?? "")}
              onChange={(e) => setField("characterName", e.target.value)}
              placeholder="Thraxil the Destroyer"
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div>
              <label style={labelStyle}>Alignment</label>
              <Select
                value={String(form.alignment ?? "")}
                onChange={(e) => setField("alignment", e.target.value)}
                style={{ width: "100%" }}
              >
                {ALIGNMENTS.map((a) => (
                  <option key={a} value={a}>{a || "— select —"}</option>
                ))}
              </Select>
            </div>
            {detailFields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input
                  value={String(form[key] ?? "")}
                  onChange={(e) => setField(key, e.target.value)}
                  placeholder={placeholder}
                  style={{ ...inputStyle, width: "100%" }}
                />
              </div>
            ))}
          </div>
          <div>
            <label style={labelStyle}>Color</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setField("color", c)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: c,
                    border: `3px solid ${form.color === c ? C.text : "transparent"}`,
                    cursor: "pointer",
                    padding: 0,
                    boxShadow: form.color === c ? `0 0 0 1px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <NavButtons step={9} onBack={onBack} onNext={onNext} nextDisabled={!String(form.characterName ?? "").trim()} />
    </div>
  );

  return { main, side };
}

export function renderCampaignsStep({
  campaigns,
  selectedCampaignIds,
  toggleCampaign,
  error,
  busy,
  isEditing,
  onBack,
  onSubmit,
  side,
}: {
  campaigns: CampaignLike[];
  selectedCampaignIds: string[];
  toggleCampaign: (id: string, checked: boolean) => void;
  error: string | null;
  busy: boolean;
  isEditing: boolean;
  onBack: () => void;
  onSubmit: () => void;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  const main = (
    <div>
      <h2 style={headingStyle}>Assign to Campaigns</h2>
      <p style={{ color: C.muted, marginBottom: 16 }}>Optional - you can assign later from your home page.</p>
      {campaigns.length === 0 && <p style={{ color: C.muted }}>You're not a member of any campaigns yet.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {campaigns.map((campaign) => {
          const checked = selectedCampaignIds.includes(campaign.id);
          return (
            <label
              key={campaign.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 15px",
                borderRadius: 8,
                cursor: "pointer",
                border: `2px solid ${checked ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                background: checked ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggleCampaign(campaign.id, e.target.checked)}
                style={{ accentColor: C.accentHl, width: 16, height: 16 }}
              />
              <span style={{ fontWeight: 600 }}>{campaign.name}</span>
            </label>
          );
        })}
      </div>

      {error && <div style={{ color: C.red, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
        <button type="button" onClick={onBack} style={{ padding: "9px 22px", borderRadius: 8, fontWeight: 700, cursor: "pointer", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: C.text, fontSize: "var(--fs-medium)" }}>
          ← Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          style={{
            padding: "9px 22px",
            borderRadius: 8,
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
            border: "none",
            background: busy ? "rgba(255,255,255,0.06)" : C.accentHl,
            color: busy ? "rgba(160,180,220,0.40)" : C.textDark,
            fontSize: "var(--fs-medium)",
          }}
        >
          {busy ? "Saving…" : isEditing ? "Save Changes ✓" : "Create Character ✓"}
        </button>
      </div>
    </div>
  );

  return { main, side };
}

