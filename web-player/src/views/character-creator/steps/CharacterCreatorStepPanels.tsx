import React from "react";
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
  smallBtnStyle,
  sourceTagStyle,
  statLabelStyle, statValueStyle,
} from "../shared/CharacterCreatorStyles";
import { Select } from "@/ui/Select";
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
                  {r.speed && <span style={{ color: "rgba(160,180,220,0.5)", fontSize: "var(--fs-small)", marginLeft: 6 }}>{r.speed}ft</span>}
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

export function renderSpellsStep<T extends { id: string; name: string; level: number | null; text?: string | null }>({
  isCaster,
  cantripCount,
  classCantrips,
  chosenCantrips,
  toggleCantrip,
  invocCount,
  classInvocations,
  chosenInvocations,
  toggleInvocation,
  invocationAllowed,
  prepCount,
  maxSlotLevel,
  classSpells,
  chosenSpells,
  toggleSpell,
  extraSpellListChoices,
  extraSpellChoices,
  extraChoiceGroups = [],
  extraItemChoices = [],
  onBack,
  onNext,
  nextDisabled = false,
  side,
}: {
  isCaster: boolean;
  cantripCount: number;
  classCantrips: T[];
  chosenCantrips: string[];
  toggleCantrip: (id: string) => void;
  invocCount: number;
  classInvocations: T[];
  chosenInvocations: string[];
  toggleInvocation: (id: string) => void;
  invocationAllowed: (spell: T) => boolean;
  prepCount: number;
  maxSlotLevel: number;
  classSpells: T[];
  chosenSpells: string[];
  toggleSpell: (id: string) => void;
  extraSpellListChoices: Array<{
    key: string;
    title: string;
    sourceLabel?: string | null;
    options: string[];
    chosen: string[];
    max: number;
    note?: string | null;
    emptyMsg?: string;
    onToggle: (value: string) => void;
  }>;
  extraSpellChoices: Array<{
    key: string;
    title: string;
    sourceLabel?: string | null;
    spells: T[];
    chosen: string[];
    chosenNames?: string[];
    max: number;
    note?: string | null;
    emptyMsg: string;
    onToggle: (id: string) => void;
  }>;
  extraChoiceGroups?: Array<{
    key: string;
    title: string;
    sourceLabel?: string | null;
    options: string[];
    chosen: string[];
    max: number;
    note?: string | null;
    emptyMsg?: string;
    onToggle: (value: string) => void;
  }>;
  extraItemChoices?: Array<{
    key: string;
    title: string;
    sourceLabel?: string | null;
    items: Array<{ id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>;
    chosen: string[];
    disabledIds?: string[];
    max: number;
    note?: string | null;
    emptyMsg: string;
    onToggle: (id: string) => void;
  }>;
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  side: React.ReactNode;
}): { main: React.ReactNode; side: React.ReactNode } {
  const normalizeSpellId = (value: unknown) => String(value ?? "");
  const normalizeSpellName = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const hasAnything = isCaster || invocCount > 0 || extraSpellListChoices.length > 0 || extraSpellChoices.length > 0 || extraChoiceGroups.length > 0 || extraItemChoices.length > 0;
  const chosenCantripIds = new Set(chosenCantrips.map(normalizeSpellId));
  const chosenPreparedSpellIds = new Set(chosenSpells.map(normalizeSpellId));
  const selectedClassCantrips = classCantrips.filter((spell) => chosenCantripIds.has(normalizeSpellId(spell.id)));
  const selectedClassSpells = classSpells.filter((spell) => chosenPreparedSpellIds.has(normalizeSpellId(spell.id)));
  const allChosenSpellIds = new Set<string>([
    ...selectedClassCantrips.map((spell) => normalizeSpellId(spell.id)),
    ...selectedClassSpells.map((spell) => normalizeSpellId(spell.id)),
    ...extraSpellChoices.flatMap((entry) => entry.chosen.map(normalizeSpellId)),
  ]);
  const allChosenSpellNames = new Set<string>([
    ...selectedClassCantrips.map((spell) => normalizeSpellName(spell.name)),
    ...selectedClassSpells.map((spell) => normalizeSpellName(spell.name)),
    ...extraSpellChoices.flatMap((entry) => (entry.chosenNames ?? []).map(normalizeSpellName)),
  ]);
  const main = (
    <div>
      <h2 style={headingStyle}>Spells</h2>
      {isCaster && cantripCount > 0 && (
        <SpellPicker
          title="Cantrips"
          spells={classCantrips}
          chosen={chosenCantrips}
          disabledIds={Array.from(allChosenSpellIds).filter((id) => !chosenCantripIds.has(id))}
          disabledNames={Array.from(allChosenSpellNames).filter(
            (name) => !selectedClassCantrips.some((spell) => normalizeSpellName(spell.name) === name)
          )}
          max={cantripCount}
          emptyMsg="No cantrips found in compendium for this class."
          onToggle={toggleCantrip}
        />
      )}
      {invocCount > 0 && classInvocations.length > 0 && (
        <SpellPicker
          title="Eldritch Invocations"
          chosen={chosenInvocations}
          spells={classInvocations}
          max={invocCount}
          emptyMsg="No invocations available at this level."
          onToggle={toggleInvocation}
          isAllowed={invocationAllowed}
        />
      )}
      {isCaster && prepCount > 0 && maxSlotLevel > 0 && (
        <SpellPicker
          title={`Prepared Spells (up to level ${maxSlotLevel})`}
          spells={classSpells.filter((s) => s.level != null && s.level <= maxSlotLevel)}
          chosen={chosenSpells}
          disabledIds={Array.from(allChosenSpellIds).filter((id) => !chosenPreparedSpellIds.has(id))}
          disabledNames={Array.from(allChosenSpellNames).filter(
            (name) => !selectedClassSpells.some((spell) => normalizeSpellName(spell.name) === name)
          )}
          max={prepCount}
          emptyMsg="No spells found in compendium for this class."
          onToggle={toggleSpell}
        />
      )}
      {extraSpellListChoices.map((entry) => (
        <div key={entry.key}>
          {renderChoiceChipGroup({
            title: entry.title,
            sourceLabel: entry.sourceLabel,
            selectedCount: entry.chosen.length,
            maxCount: entry.max,
            options: entry.options,
            isSelected: (option) => entry.chosen.includes(option),
            isLocked: (option, isSelected) => !isSelected && entry.chosen.length >= entry.max,
            onToggle: entry.onToggle,
            note: entry.note,
          })}
          {entry.options.length === 0 && (
            <div style={{ marginTop: -16, marginBottom: 16, fontSize: "var(--fs-small)", color: C.muted }}>
              {entry.emptyMsg ?? "No eligible options found."}
            </div>
          )}
        </div>
      ))}
      {extraSpellChoices.map((entry) => (
        <div key={entry.key}>
          <SpellPicker
            title={entry.title}
            sourceLabel={entry.sourceLabel}
            spells={entry.spells}
            chosen={entry.chosen}
            disabledIds={Array.from(allChosenSpellIds).filter(
              (id) => !entry.chosen.map(normalizeSpellId).includes(id)
            )}
            disabledNames={Array.from(allChosenSpellNames).filter(
              (name) => !(entry.chosenNames ?? []).map(normalizeSpellName).includes(name)
            )}
            max={entry.max}
            emptyMsg={entry.emptyMsg}
            onToggle={entry.onToggle}
          />
          {entry.note && (
            <div style={{ marginTop: -16, marginBottom: 16, fontSize: "var(--fs-small)", color: C.muted }}>
              {entry.note}
            </div>
          )}
        </div>
      ))}
      {extraChoiceGroups.map((entry) => (
        <div key={entry.key}>
          {renderChoiceChipGroup({
            title: entry.title,
            sourceLabel: entry.sourceLabel,
            selectedCount: entry.chosen.length,
            maxCount: entry.max,
            options: entry.options,
            isSelected: (option) => entry.chosen.includes(option),
            isLocked: (option, isSelected) => !isSelected && entry.chosen.length >= entry.max,
            onToggle: entry.onToggle,
            note: entry.note,
          })}
          {entry.options.length === 0 && (
            <div style={{ marginTop: -16, marginBottom: 16, fontSize: "var(--fs-small)", color: C.muted }}>
              {entry.emptyMsg ?? "No eligible options found."}
            </div>
          )}
        </div>
      ))}
      {extraItemChoices.map((entry) => (
        <div key={entry.key}>
          <ItemPicker
            title={entry.title}
            sourceLabel={entry.sourceLabel}
            items={entry.items}
            chosen={entry.chosen}
            disabledIds={entry.disabledIds}
            max={entry.max}
            emptyMsg={entry.emptyMsg}
            onToggle={entry.onToggle}
          />
          {entry.note && (
            <div style={{ marginTop: -16, marginBottom: 16, fontSize: "var(--fs-small)", color: C.muted }}>
              {entry.note}
            </div>
          )}
        </div>
      ))}
      {!hasAnything && <p style={{ color: C.muted, fontSize: "var(--fs-medium)" }}>This class has no spellcasting choices at this level.</p>}
      <NavButtons step={6} onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} />
    </div>
  );
  return { main, side };
}

export function renderAbilityScoresStep({
  form,
  setAbilityMethod,
  setStandardAssign,
  setPointBuyScore,
  setManualScore,
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
  setAbilityMethod: (method: "standard" | "pointbuy" | "manual") => void;
  setStandardAssign: (key: string, idx: number) => void;
  setPointBuyScore: (key: string, score: number) => void;
  setManualScore: (key: string, score: number) => void;
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
        {isPrimary && <span style={{ fontSize: "var(--fs-tiny)", color: C.colorGold, opacity: 0.75 }}>★ Primary</span>}
        {bonus != null && (
          <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "rgba(167,139,250,0.18)", border: "1px solid rgba(167,139,250,0.4)", color: C.colorMagic }}>
            +{bonus} {backgroundName ?? "bg"}
          </span>
        )}
      </div>
    );
  }

  const main = (
    <div>
      <h2 style={headingStyle}>Ability Scores</h2>
      {hasBgBonuses && (
        <div style={{ ...detailBoxStyle, marginBottom: 16, padding: "10px 14px" }}>
          <span style={{ fontSize: "var(--fs-small)", color: C.colorMagic }}>
            Background bonuses applied: {Object.entries(bgBonuses).map(([k, v]) => `${abilityLabels[k]} +${v}`).join(", ")}
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {(["standard", "pointbuy", "manual"] as const).map((m) => (
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
            {m === "standard" ? "Standard Array" : m === "pointbuy" ? "Point Buy" : "Manual"}
          </button>
        ))}
      </div>

      {form.abilityMethod === "standard" && (
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
                    {totalVal != null ? <>{baseVal !== totalVal && <span style={{ color: C.colorMagic, marginRight: 4 }}>{totalVal}</span>}{`mod ${abilityMod(totalVal) >= 0 ? "+" : ""}${abilityMod(totalVal)}`}</> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {form.abilityMethod === "pointbuy" && (
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
      )}

      {form.abilityMethod === "manual" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {abilityKeys.map((k) => {
            const score = form.manualScores[k] ?? 10;
            const total = score + (bgBonuses[k] ?? 0);
            return (
              <div key={k} style={{ padding: "8px", borderRadius: 8, border: `1px solid ${primaryKeys.includes(k) ? "rgba(251,191,36,0.3)" : "transparent"}`, background: primaryKeys.includes(k) ? "rgba(251,191,36,0.05)" : "transparent" }}>
                <AbilityLabel k={k} />
                <input type="number" value={score} onChange={(e) => setManualScore(k, Number(e.target.value) || 10)} style={{ ...inputStyle, width: "100%" }} />
                <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 2 }}>{bgBonuses[k] ? <span style={{ color: C.colorMagic }}>{total} · </span> : null}mod {abilityMod(total) >= 0 ? "+" : ""}{abilityMod(total)}</div>
              </div>
            );
          })}
        </div>
      )}

      <NavButtons step={4} onBack={onBack} onNext={onNext} />
    </div>
  );
  return { main, side };
}

export function renderDerivedStatsStep({
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
  const main = (
    <div>
      <h2 style={headingStyle}>Combat Stats</h2>
      <p style={{ color: C.muted, marginBottom: 16 }}>Auto-calculated from your choices — HP Max can be overridden.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div>
          <label style={labelStyle}>HP Max</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>d{hd} + {conMod >= 0 ? "+" : ""}{conMod} CON × lvl {level}</div>
          <input type="number" value={hpMax} onChange={(e) => setField("hpMax", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div>
          <label style={labelStyle}>Armor Class</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>10 + {dexMod >= 0 ? "+" : ""}{dexMod} DEX (base)</div>
          <div style={{ ...inputStyle, width: "100%", opacity: 0.6, cursor: "default" }}>{ac}</div>
        </div>
        <div>
          <label style={labelStyle}>Speed (ft)</label>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginBottom: 4 }}>From species ({raceSpeed} ft)</div>
          <div style={{ ...inputStyle, width: "100%", opacity: 0.6, cursor: "default" }}>{speed}</div>
        </div>
      </div>
      {sections.length > 0 && (
        <div style={{ ...detailBoxStyle, marginTop: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: "var(--fs-subtitle)" }}>Your Proficiencies</div>
          {sections.map((s) => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>{s.label}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                {s.items.map((item, i) => (
                  <span key={`${s.label}:${item.name}:${item.source}:${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={profChipStyle}>{item.name}</span>
                    <span style={sourceTagStyle}>{item.source}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <NavButtons step={8} onBack={onBack} onNext={onNext} />
    </div>
  );
  return { main, side };
}
