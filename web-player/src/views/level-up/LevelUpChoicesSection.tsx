import React from "react";
import { titleCase } from "@/lib/format/titleCase";
import { C } from "@/lib/theme";
import { normalizeChoiceKey } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { ALL_LANGUAGES, ALL_SKILLS, ALL_TOOLS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { ChoiceBtn, Section } from "@/views/level-up/LevelUpParts";
import { LevelUpItemChoiceList } from "@/views/level-up/LevelUpItemChoiceList";
import { LevelUpSpellChoiceList } from "@/views/level-up/LevelUpSpellChoiceList";
import type {
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellListChoiceEntry,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";

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
  category: "skill" | "tool" | "language" | "saving_throw" | "selection";
  count: number;
  options?: string[];
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

export function LevelUpChoicesSection(props: {
  show: boolean;
  nextLevel: number;
  accentColor: string;
  progressionTableChoiceEntries: ProgressionChoiceEntry[];
  classChoiceGroups: Array<{ key: string; name: string; options: Array<{ id: string; name: string }> }>;
  classFeatureProficiencyChoices: ClassFeatureProficiencyChoiceEntry[];
  chosenFeatureChoices: Record<string, string[]>;
  existingSkillKeys: Set<string>;
  existingToolKeys: Set<string>;
  existingLanguageKeys: Set<string>;
  existingSaveKeys: Set<string>;
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
  lockedInvocationSelectionIds: string[];
  allowedInvocationIds: Set<string>;
  maneuverChoiceEntries: ManeuverChoiceEntry[];
  planChoiceEntries: PlanChoiceEntry[];
  growthOptionEntriesByKey: Record<string, GrowthItemOption[]>;
  featSpellListChoices: LevelUpSpellListChoiceEntry[];
  featResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  invocationResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  invocationFeatChoices: import("./LevelUpTypes").InvocationFeatChoiceEntry[];
  invocationGrantedFeatChoices: ReturnType<typeof import("@/views/shared/useInvocationGrantedFeatChoices").useInvocationGrantedFeatChoices>;
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
        {props.classChoiceGroups.map((group) => {
          const selected = props.chosenFeatureChoices[group.key]?.[0] ?? "";
          return (
            <div key={group.key}>
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, marginBottom: 8 }}>{group.name}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {group.options.map((option) => (
                  <ChoiceBtn
                    key={option.id}
                    active={selected === option.id}
                    onClick={() => props.setChosenFeatureChoices((current) => ({ ...current, [group.key]: selected === option.id ? [] : [option.id] }))}
                  >
                    {option.name}
                  </ChoiceBtn>
                ))}
              </div>
            </div>
          );
        })}
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
          const options = choice.options?.length ? choice.options
            : choice.category === "skill" ? ALL_SKILLS.map((skill) => skill.name)
            : choice.category === "tool" ? ALL_TOOLS
            : choice.category === "saving_throw" ? Object.keys(ABILITY_LABELS)
            : ALL_LANGUAGES;
          const existingKeys =
            choice.category === "skill" ? props.existingSkillKeys
            : choice.category === "tool" ? props.existingToolKeys
            : choice.category === "saving_throw" ? props.existingSaveKeys
            : choice.category === "selection" ? new Set<string>()
            : props.existingLanguageKeys;
          const hasNonDuplicateOption = options.some((option) => !existingKeys.has(normalizeChoiceKey(option)));
          const title =
            choice.category === "skill" ? "Bonus Proficiencies"
            : choice.category === "tool" ? "Bonus Tool Proficiencies"
            : choice.category === "saving_throw" ? "Saving Throw Proficiency"
            : choice.category === "selection" ? choice.sourceLabel
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
            onToggle={(id, action) => props.setChosenInvocations(() => {
              const unlocked = props.displayedChosenInvocations;
              if (action === "add" && unlocked.length < props.invocationChoiceCount) return [...props.lockedInvocationSelectionIds, ...unlocked, id];
              if (action === "remove") {
                const index = unlocked.lastIndexOf(id);
                return index < 0 ? [...props.lockedInvocationSelectionIds, ...unlocked] : [...props.lockedInvocationSelectionIds, ...unlocked.filter((_, candidate) => candidate !== index)];
              }
              return [...props.lockedInvocationSelectionIds, ...unlocked];
            })}
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

        {props.invocationFeatChoices.map((choice) => {
          const selected = props.chosenFeatOptions[choice.key] ?? [];
          return (
            <div key={choice.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: "#fff" }}>{choice.title} <span style={{ color: C.muted }}>({choice.sourceLabel})</span></div>
                <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? props.accentColor : C.muted }}>{selected.length} / {choice.count}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {choice.options.map((option) => {
                  const active = selected.includes(option.id);
                  const blocked = !active && selected.length >= choice.count;
                  return <ChoiceBtn key={option.id} active={active} onClick={() => {
                    if (blocked) return;
                    props.setChosenFeatOptions((prev) => {
                      const current = prev[choice.key] ?? [];
                      const next = current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id];
                      return { ...prev, [choice.key]: next };
                    });
                  }}>{option.name}</ChoiceBtn>;
                })}
              </div>
              {choice.options.length === 0 ? <div style={{ marginTop: 8, fontSize: "var(--fs-small)", color: C.muted }}>No eligible Origin Feats found.</div> : null}
            </div>
          );
        })}

        {props.invocationGrantedFeatChoices.groups.map((choice) => {
          const selected = props.chosenFeatOptions[choice.key] ?? [];
          return (
            <div key={choice.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: "#fff" }}>{choice.title} <span style={{ color: C.muted }}>({choice.sourceLabel})</span></div>
                <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? props.accentColor : C.muted }}>{selected.length} / {choice.count}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {choice.options.map((option) => <ChoiceBtn key={option} active={selected.includes(option)} onClick={() => {
                  props.setChosenFeatOptions((prev) => {
                    const current = prev[choice.key] ?? [];
                    const next = current.includes(option) ? current.filter((value) => value !== option) : current.length < choice.count ? [...current, option] : current;
                    return { ...prev, [choice.key]: next };
                  });
                }}>{option}</ChoiceBtn>)}
              </div>
              {choice.note ? <div style={{ marginTop: 8, fontSize: "var(--fs-small)", color: C.muted }}>{choice.note}</div> : null}
            </div>
          );
        })}

        {props.invocationGrantedFeatChoices.spellChoices.map((choice) => renderResolvedSpellChoice(
          choice as LevelUpResolvedSpellChoiceEntry,
          props.invocationGrantedFeatChoices.spellOptions as Record<string, SpellSummary[]>,
        ))}

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
