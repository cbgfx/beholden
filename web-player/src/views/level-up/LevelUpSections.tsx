import React from "react";

import { titleCase } from "@/lib/format/titleCase";
import { C } from "@/lib/theme";
import { LEVEL_LABELS } from "@/views/character/CharacterSpellShared";
import { normalizeChoiceKey } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { ALL_LANGUAGES, ALL_SKILLS, ALL_TOOLS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { ChoiceBtn, Section } from "@/views/level-up/LevelUpParts";
import { LevelUpItemChoiceList } from "@/views/level-up/LevelUpItemChoiceList";
import { LevelUpSpellChoiceList } from "@/views/level-up/LevelUpSpellChoiceList";
import { cleanFeatureText } from "@/views/level-up/LevelUpHelpers";
import type {
  LevelUpFeatDetail as FeatDetail,
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellListChoiceEntry,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";

type SubclassOverview = { name: string; text: string } | null;
type FeatureLike = { name: string; text: string };
type ProgressionChoiceEntry = {
  definition: {
    key: string;
    prompt: string;
    sourceName: string;
    options: string[];
  };
  chosen: string[];
};
type ClassFeatureProficiencyChoiceEntry = {
  key: string;
  sourceLabel: string;
  category: "skill" | "tool" | "language";
  count: number;
};
type ManeuverChoiceEntry = {
  definition: {
    key: string;
    title: string;
    totalCount: number;
    sourceLabel?: string | null;
    note?: string | null;
    abilityChoice?: { key: string; options: string[] } | null;
  };
  chosen: string[];
  remainingCount: number;
  selectedAbility: string | null;
};
type PlanChoiceEntry = {
  definition: {
    key: string;
    title: string;
    totalCount: number;
    note?: string | null;
  };
  chosen: string[];
  disabledIds: string[];
  remainingCount: number;
};
type GrowthItemOption = { id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean };

export function LevelUpSubclassSection(props: {
  show: boolean;
  nextLevel: number;
  accentColor: string;
  subclass: string;
  subclassOptions: string[];
  subclassOverview: SubclassOverview;
  selectedSubclassFeatures: FeatureLike[];
  onSelectSubclass: (value: string) => void;
}) {
  if (!props.show) return null;
  return (
    <Section title={`Subclass at Level ${props.nextLevel}`} accent={props.accentColor}>
      <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
        {props.subclass.trim() ? "Subclass selected. You can change it before confirming level-up." : "Choose your subclass."}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "start" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          {props.subclassOptions.map((option) => (
            <ChoiceBtn key={option} active={props.subclass === option} onClick={() => props.onSelectSubclass(option)}>
              {option}
            </ChoiceBtn>
          ))}
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            minHeight: 120,
          }}
        >
          {props.subclassOverview ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: "#fff", marginBottom: 6 }}>
                  {props.subclass}
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                  {cleanFeatureText(props.subclassOverview.text)}
                </div>
              </div>
              {props.selectedSubclassFeatures.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: "var(--fs-tiny)",
                      color: props.accentColor,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      marginBottom: 8,
                    }}
                  >
                    Features Gained Now
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {props.selectedSubclassFeatures.map((feature) => (
                      <div key={feature.name}>
                        <div style={{ fontSize: "var(--fs-body)", color: "#fff", fontWeight: 800, marginBottom: 4 }}>
                          {feature.name}
                        </div>
                        <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                          {cleanFeatureText(feature.text)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6 }}>
              Pick a subclass to see its description and the features you gain at this level.
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

export function LevelUpChoicesSection(props: {
  show: boolean;
  nextLevel: number;
  accentColor: string;
  progressionTableChoiceEntries: ProgressionChoiceEntry[];
  classFeatureProficiencyChoices: ClassFeatureProficiencyChoiceEntry[];
  chosenFeatureChoices: Record<string, string[]>;
  existingSkillKeys: Set<string>;
  existingToolKeys: Set<string>;
  existingLanguageKeys: Set<string>;
  cantripChoiceCount: number;
  availableCantripChoices: SpellSummary[];
  displayedChosenCantrips: string[];
  globallyChosenSpellChoiceIds: Set<string>;
  lockedCantripIds: Set<string>;
  classCantrips: SpellSummary[];
  preparedSpellProgressionGrantedKeys: Set<string>;
  spellcaster: boolean;
  spellChoiceCount: number;
  usesFlexiblePreparedSpellsModel: boolean;
  prepCount: number;
  maxSpellLevel: number;
  availableSpellChoices: SpellSummary[];
  displayedChosenSpells: string[];
  lockedSpellIds: Set<string>;
  classSpells: SpellSummary[];
  invocCount: number;
  invocationChoiceCount: number;
  availableInvocationChoices: SpellSummary[];
  displayedChosenInvocations: string[];
  lockedInvocationIds: Set<string>;
  allowedInvocationIds: Set<string>;
  maneuverChoiceEntries: ManeuverChoiceEntry[];
  planChoiceEntries: PlanChoiceEntry[];
  growthOptionEntriesByKey: Record<string, GrowthItemOption[]>;
  featSpellListChoices: LevelUpSpellListChoiceEntry[];
  featResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  invocationResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  featSpellChoiceOptions: Record<string, SpellSummary[]>;
  classFeatureSpellChoiceOptions: Record<string, SpellSummary[]>;
  invocationSpellChoiceOptions: Record<string, SpellSummary[]>;
  chosenFeatOptions: Record<string, string[]>;
  normalizeSpellTrackingKey: (name: string) => string;
  toggleSelection: (
    id: string,
    chosen: string[],
    apply: (updater: string[] | ((current: string[]) => string[])) => void,
    max: number,
  ) => void;
  setChosenCantrips: React.Dispatch<React.SetStateAction<string[]>>;
  setChosenSpells: React.Dispatch<React.SetStateAction<string[]>>;
  setChosenInvocations: React.Dispatch<React.SetStateAction<string[]>>;
  setChosenFeatureChoices: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setChosenFeatOptions: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  extraFeatSpellSelectionsValid: boolean;
}) {
  if (!props.show) return null;

  const renderResolvedSpellChoice = (
    choice: LevelUpResolvedSpellChoiceEntry,
    optionsByKey: Record<string, SpellSummary[]>,
  ) => {
    const selectedIds = (props.chosenFeatOptions[choice.key] ?? []);
    const resolvedSelectedIds = selectedIds;
    return (
      <LevelUpSpellChoiceList
        key={choice.key}
        title={choice.title}
        caption={`Choose ${choice.count}`}
        spells={(optionsByKey[choice.key] ?? []).map((spell) => ({ ...spell, id: String(spell.id) }))}
        chosen={resolvedSelectedIds}
        disabledIds={Array.from(props.globallyChosenSpellChoiceIds).filter((id) => !resolvedSelectedIds.includes(id))}
        max={choice.count}
        onToggle={(id) => {
          props.setChosenFeatOptions((prev) => {
            const current = prev[choice.key] ?? [];
            const next = current.includes(id)
              ? current.filter((entry) => entry !== id)
              : current.length < choice.count
                ? [...current, id]
                : current;
            return { ...prev, [choice.key]: next };
          });
        }}
      />
    );
  };

  return (
    <Section title={`Spell And Feature Choices at Level ${props.nextLevel}`} accent={props.accentColor}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {props.progressionTableChoiceEntries.map((entry) => (
          <div key={entry.definition.key}>
            <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, marginBottom: 8 }}>
              {entry.definition.prompt}
            </div>
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 10 }}>{entry.definition.sourceName}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {entry.definition.options.map((option) => {
                const active = entry.chosen.includes(option);
                return (
                  <ChoiceBtn
                    key={option}
                    active={active}
                    onClick={() => {
                      props.setChosenFeatureChoices((prev) => ({
                        ...prev,
                        [entry.definition.key]: active ? [] : [option],
                      }));
                    }}
                  >
                    {titleCase(option)}
                  </ChoiceBtn>
                );
              })}
            </div>
          </div>
        ))}

        {props.classFeatureProficiencyChoices.map((choice) => {
          const selected = props.chosenFeatureChoices[choice.key] ?? [];
          const options =
            choice.category === "skill" ? ALL_SKILLS.map((skill) => skill.name)
            : choice.category === "tool" ? ALL_TOOLS
            : ALL_LANGUAGES;
          const existingKeys =
            choice.category === "skill" ? props.existingSkillKeys
            : choice.category === "tool" ? props.existingToolKeys
            : props.existingLanguageKeys;
          const hasNonDuplicateOption = options.some((option) => !existingKeys.has(normalizeChoiceKey(option)));
          const title =
            choice.category === "skill" ? "Bonus Proficiencies"
            : choice.category === "tool" ? "Bonus Tool Proficiencies"
            : "Bonus Languages";
          return (
            <div key={choice.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: "#fff" }}>{title}</div>
                  <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>{choice.sourceLabel}</div>
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? props.accentColor : C.muted }}>
                  {selected.length} / {choice.count}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {options.map((option) => {
                  const active = selected.includes(option);
                  const duplicate = hasNonDuplicateOption && !active && existingKeys.has(normalizeChoiceKey(option));
                  const blocked = duplicate || (!active && selected.length >= choice.count);
                  return (
                    <ChoiceBtn
                      key={option}
                      active={active}
                      onClick={() => {
                        if (blocked) return;
                        props.setChosenFeatureChoices((prev) => {
                          const current = prev[choice.key] ?? [];
                          const next = current.includes(option)
                            ? current.filter((entry) => entry !== option)
                            : current.length < choice.count
                              ? [...current, option]
                              : current;
                          return { ...prev, [choice.key]: next };
                        });
                      }}
                      accent={props.accentColor}
                    >
                      {option}
                    </ChoiceBtn>
                  );
                })}
              </div>
            </div>
          );
        })}

        {props.cantripChoiceCount > 0 ? (
          <LevelUpSpellChoiceList
            title="Cantrips"
            caption={`Choose ${props.cantripChoiceCount}`}
            spells={props.availableCantripChoices}
            chosen={props.displayedChosenCantrips}
            disabledIds={Array.from(props.globallyChosenSpellChoiceIds).filter((id) => !props.displayedChosenCantrips.includes(id))}
            max={props.cantripChoiceCount}
            onToggle={(id) =>
              props.toggleSelection(id, props.displayedChosenCantrips, (updater) => {
                props.setChosenCantrips((prev) => {
                  const unlocked = prev.filter((entry) => {
                    if (props.lockedCantripIds.has(entry)) return false;
                    const spell = props.classCantrips.find((candidate) => candidate.id === entry);
                    return spell ? !props.preparedSpellProgressionGrantedKeys.has(props.normalizeSpellTrackingKey(spell.name)) : true;
                  });
                  const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                  return [...Array.from(props.lockedCantripIds), ...nextUnlocked];
                });
              }, props.cantripChoiceCount)
            }
          />
        ) : null}

        {props.spellcaster && props.spellChoiceCount > 0 ? (
          <LevelUpSpellChoiceList
            title={props.usesFlexiblePreparedSpellsModel ? "Additional Spells" : "Prepared Spells"}
            caption={`Choose ${props.spellChoiceCount} (up to level ${props.maxSpellLevel})`}
            spells={props.availableSpellChoices}
            chosen={props.displayedChosenSpells}
            disabledIds={Array.from(props.globallyChosenSpellChoiceIds).filter((id) => !props.displayedChosenSpells.includes(id))}
            max={props.spellChoiceCount}
            onToggle={(id) =>
              props.toggleSelection(id, props.displayedChosenSpells, (updater) => {
                props.setChosenSpells((prev) => {
                  const unlocked = prev.filter((entry) => {
                    if (props.lockedSpellIds.has(entry)) return false;
                    const spell = props.classSpells.find((candidate) => candidate.id === entry);
                    return spell ? !props.preparedSpellProgressionGrantedKeys.has(props.normalizeSpellTrackingKey(spell.name)) : true;
                  });
                  const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                  return [...Array.from(props.lockedSpellIds), ...nextUnlocked];
                });
              }, props.spellChoiceCount)
            }
          />
        ) : null}

        {props.spellcaster && props.prepCount > 0 && props.usesFlexiblePreparedSpellsModel && props.spellChoiceCount === 0 ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, marginBottom: 6 }}>Prepared Spells</div>
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6 }}>
              Your preparation capacity at level {props.nextLevel} is {props.prepCount} spell{props.prepCount === 1 ? "" : "s"} of up to level {props.maxSpellLevel}.
              Manage the actual prepared circles from the character sheet; level-up does not force you to rebuild that list.
            </div>
          </div>
        ) : null}

        {props.invocCount > 0 && props.invocationChoiceCount > 0 ? (
          <LevelUpSpellChoiceList
            title="Eldritch Invocations"
            caption={`Choose ${props.invocationChoiceCount}`}
            spells={props.availableInvocationChoices}
            chosen={props.displayedChosenInvocations}
            disabledIds={Array.from(props.globallyChosenSpellChoiceIds).filter((id) => !props.displayedChosenInvocations.includes(id))}
            max={props.invocationChoiceCount}
            onToggle={(id) =>
              props.toggleSelection(id, props.displayedChosenInvocations, (updater) => {
                props.setChosenInvocations((prev) => {
                  const unlocked = prev.filter((entry) => !props.lockedInvocationIds.has(entry));
                  const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                  return [...Array.from(props.lockedInvocationIds), ...nextUnlocked];
                });
              }, props.invocationChoiceCount)
            }
            isAllowed={(invocation) => props.allowedInvocationIds.has(invocation.id)}
          />
        ) : null}

        {props.maneuverChoiceEntries.map((entry) => (
          <div key={entry.definition.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <LevelUpSpellChoiceList
              title={entry.definition.title}
              caption={`Choose ${entry.remainingCount} new`}
              spells={(props.growthOptionEntriesByKey[entry.definition.key] ?? []).map((spell) => ({ ...spell, id: String(spell.id), level: null }))}
              chosen={entry.chosen}
              max={entry.definition.totalCount}
              onToggle={(id) => {
                props.setChosenFeatureChoices((prev) => {
                  const current = prev[entry.definition.key] ?? [];
                  const next = current.includes(id)
                    ? current.filter((value) => value !== id)
                    : current.length < entry.definition.totalCount
                      ? [...current, id]
                      : current;
                  return { ...prev, [entry.definition.key]: next };
                });
              }}
            />
            {entry.definition.abilityChoice ? (
              <div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 8 }}>
                  Choose the ability used for maneuver save DCs from {entry.definition.sourceLabel}.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {entry.definition.abilityChoice.options.map((option) => {
                    const active = entry.selectedAbility === option;
                    return (
                      <ChoiceBtn
                        key={option}
                        active={active}
                        onClick={() => {
                          props.setChosenFeatureChoices((prev) => ({
                            ...prev,
                            [entry.definition.abilityChoice!.key]: active ? [] : [option],
                          }));
                        }}
                      >
                        {(ABILITY_LABELS as Record<string, string>)[option]}
                      </ChoiceBtn>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {entry.definition.note ? <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>{entry.definition.note}</div> : null}
          </div>
        ))}

        {props.planChoiceEntries.map((entry) => (
          <div key={entry.definition.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <LevelUpItemChoiceList
              title={entry.definition.title}
              caption={`Choose ${entry.remainingCount} new`}
              items={props.growthOptionEntriesByKey[entry.definition.key] ?? []}
              chosen={entry.chosen}
              disabledIds={entry.disabledIds}
              max={entry.definition.totalCount}
              onToggle={(id) => {
                props.setChosenFeatureChoices((prev) => {
                  const current = prev[entry.definition.key] ?? [];
                  const next = current.includes(id)
                    ? current.filter((value) => value !== id)
                    : current.length < entry.definition.totalCount
                      ? [...current, id]
                      : current;
                  return { ...prev, [entry.definition.key]: next };
                });
              }}
            />
            {entry.definition.note ? <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>{entry.definition.note}</div> : null}
          </div>
        ))}

        {props.featSpellListChoices.map((choice) => {
          const selected = props.chosenFeatOptions[choice.key] ?? [];
          return (
            <div key={choice.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: "#fff" }}>{choice.title}</div>
                <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? props.accentColor : C.muted }}>
                  {selected.length} / {choice.count}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {choice.options.map((option) => {
                  const active = selected.includes(option);
                  const blocked = !active && selected.length >= choice.count;
                  return (
                    <ChoiceBtn
                      key={option}
                      active={active}
                      onClick={() => {
                        if (blocked) return;
                        props.setChosenFeatOptions((prev) => {
                          const current = prev[choice.key] ?? [];
                          const next = current.includes(option)
                            ? current.filter((entry) => entry !== option)
                            : current.length < choice.count
                              ? [...current, option]
                              : current;
                          return { ...prev, [choice.key]: next };
                        });
                      }}
                      accent={props.accentColor}
                    >
                      {option}
                    </ChoiceBtn>
                  );
                })}
              </div>
              {choice.note ? <div style={{ marginTop: 8, fontSize: "var(--fs-small)", color: C.muted }}>{choice.note}</div> : null}
            </div>
          );
        })}

        {props.featResolvedSpellChoices.map((choice) => renderResolvedSpellChoice(choice, props.featSpellChoiceOptions))}
        {props.classFeatureResolvedSpellChoices.map((choice) => renderResolvedSpellChoice(choice, props.classFeatureSpellChoiceOptions))}
        {props.invocationResolvedSpellChoices.map((choice) => renderResolvedSpellChoice(choice, props.invocationSpellChoiceOptions))}

        {(props.featResolvedSpellChoices.some((choice) => (props.featSpellChoiceOptions[choice.key] ?? []).length === 0)
          || props.classFeatureResolvedSpellChoices.some((choice) => (props.classFeatureSpellChoiceOptions[choice.key] ?? []).length === 0)
          || props.invocationResolvedSpellChoices.some((choice) => (props.invocationSpellChoiceOptions[choice.key] ?? []).length === 0)) ? (
          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
            {props.featResolvedSpellChoices.some((choice) => choice.linkedTo && (props.chosenFeatOptions[choice.linkedTo] ?? []).length === 0)
              ? "Choose the spell list first."
              : "No eligible spell options found."}
          </div>
        ) : null}

        {!props.extraFeatSpellSelectionsValid ? (
          <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
            Some spell choices are incomplete.
          </div>
        ) : null}
      </div>
    </Section>
  );
}

export function LevelUpFeaturesSection(props: {
  nextLevel: number;
  accentColor: string;
  newFeatures: FeatureLike[];
  expandedFeatures: string[];
  onToggleFeature: (key: string) => void;
}) {
  if (props.newFeatures.length === 0) return null;
  return (
    <Section title={`New Features at Level ${props.nextLevel}`} accent={props.accentColor}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {props.newFeatures.map((feature) => {
          const key = feature.name;
          const expanded = props.expandedFeatures.includes(key);
          return (
            <div
              key={key}
              style={{
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => props.onToggleFeature(key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: C.text,
                  fontWeight: 700,
                  fontSize: "var(--fs-subtitle)",
                  textAlign: "left",
                }}
              >
                <span>{feature.name}</span>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{expanded ? "▲" : "▼"}</span>
              </button>
              {expanded ? (
                <div
                  style={{
                    padding: "0 12px 12px",
                    fontSize: "var(--fs-small)",
                    color: C.muted,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {feature.text}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

export function LevelUpSpellSlotsSection(props: {
  nextLevel: number;
  accentColor: string;
  newSlots: number[] | null;
}) {
  if (!props.newSlots || !props.newSlots.some((s, i) => i > 0 && s > 0)) return null;
  return (
    <Section title={`Spell Slots at Level ${props.nextLevel}`} accent={props.accentColor}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {props.newSlots.map((count, i) => {
          if (count === 0) return null;
          return (
            <div
              key={i}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{LEVEL_LABELS[i] ?? `L${i}`}</div>
              <div style={{ fontWeight: 800, fontSize: "var(--fs-body)", color: props.accentColor }}>{count}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
