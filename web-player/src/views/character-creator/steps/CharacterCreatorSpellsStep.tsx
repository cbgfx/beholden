import React from "react";
import { C } from "@/lib/theme";
import { ItemPicker, NavButtons, SpellPicker } from "../shared/CharacterCreatorParts";
import {
  renderChoiceChipGroup,
} from "./CharacterCreatorPanelHelpers";
import {
  headingStyle,
} from "../shared/CharacterCreatorStyles";
import {
  getCantripCount,
  getClassFeatureTable,
  getMaxSlotLevel,
  getPreparedSpellCount,
  isSpellcaster,
  tableValueAtLevel,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import { buildSpellStepChoiceState } from "@/views/character-creator/utils/CharacterCreatorSpellStepUtils";
import type { CharacterCreatorStepRenderContext, StepRenderResult } from "./CharacterCreatorStepContext";
import { resolvedScores } from "@/views/character-creator/utils/CharacterCreatorFormUtils";

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
  toggleInvocation: (id: string, action?: "add" | "remove") => void;
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
    getOptionLabel?: (value: string) => string;
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
            isLocked: (_option, isSelected) => !isSelected && entry.chosen.length >= entry.max,
            onToggle: entry.onToggle,
            getOptionLabel: entry.getOptionLabel,
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
            isLocked: (_option, isSelected) => !isSelected && entry.chosen.length >= entry.max,
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
      <NavButtons step={8} onBack={onBack} onNext={onNext} nextDisabled={nextDisabled} />
    </div>
  );
  return { main, side };
}

export function renderSpellsFromContext(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const cantripCount = ctx.classDetail ? getCantripCount(ctx.classDetail, ctx.form.level, ctx.form.subclass) : 0;
  const maxSlotLvl = ctx.classDetail ? getMaxSlotLevel(ctx.classDetail, ctx.form.level, ctx.form.subclass) : 0;
  const isCaster = ctx.classDetail ? isSpellcaster(ctx.classDetail, ctx.form.level, ctx.form.subclass) : false;
  const invocTable = ctx.classDetail ? getClassFeatureTable(ctx.classDetail, "Invocation", 1, ctx.form.subclass) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, ctx.form.level) : 0;
  const creatorScores = resolvedScores(ctx.form, ctx.selectedFeatAbilityBonuses);
  const spellAbility = String(ctx.classDetail?.spellAbility ?? "").toLowerCase();
  const prepCount = ctx.classDetail ? getPreparedSpellCount(ctx.classDetail, ctx.form.level, ctx.form.subclass, creatorScores[spellAbility]) : 0;
  const {
    extraSpellListChoices,
    extraSpellChoices,
    maneuverSpellChoices,
    planItemChoices,
    maneuverAbilityChoices,
    progressionTableChoices,
    missingExtraSpellSelections,
    } = buildSpellStepChoiceState({
      form: ctx.form,
      setForm: ctx.setForm,
      step6SpellListChoices: ctx.step6SpellListChoices,
      step6ResolvedSpellChoices: ctx.step6ResolvedSpellChoices,
      growthChoiceDefinitions: ctx.growthChoiceDefinitions,
      preparedSpellProgressionChoiceDefinitions: ctx.preparedSpellProgressionChoiceDefinitions,
      growthOptionEntriesByKey: ctx.growthOptionEntriesByKey as Record<string, import("@/views/character-creator/utils/CharacterCreatorTypes").ItemSummary[]>,
    featSpellChoiceOptions: ctx.featSpellChoiceOptions,
    getGrowthChoiceSelectedAbility: ctx.getGrowthChoiceSelectedAbility,
  });

  const featSpellcastingAbilityChoices = ctx.selectedFeatSpellcastingAbilityChoices.map((entry) => ({
    ...entry,
    onToggle: (value: string) =>
      ctx.setForm((prev) => {
        const current = prev.chosenFeatOptions[entry.key] ?? [];
        const next = current.includes(value)
          ? current.filter((selected) => selected !== value)
          : current.length < entry.max
            ? [...current, value]
            : current;
        return {
          ...prev,
          chosenFeatOptions: {
            ...prev.chosenFeatOptions,
            [entry.key]: next,
          },
        };
      }),
  }));
  const missingSpellcastingAbilitySelections = featSpellcastingAbilityChoices.some((entry) => entry.chosen.length < entry.max);
  const invocationFeatChoices = ctx.invocationFeatChoices
    .map((choice) => ({
      key: choice.key,
      title: choice.title,
      sourceLabel: choice.sourceLabel,
      options: choice.options.map((option) => option.id),
      chosen: ctx.form.chosenFeatOptions[choice.key] ?? [],
      max: choice.count,
      emptyMsg: "No eligible Origin Feats found.",
      getOptionLabel: (id: string) => choice.options.find((option) => option.id === id)?.name ?? id,
      onToggle: (id: string) => ctx.setForm((prev) => {
        const current = prev.chosenFeatOptions[choice.key] ?? [];
        const next = current.includes(id)
          ? current.filter((selected) => selected !== id)
          : current.length < choice.count ? [...current, id] : current;
        return { ...prev, chosenFeatOptions: { ...prev.chosenFeatOptions, [choice.key]: next } };
      }),
    }));
  const missingInvocationFeatSelections = invocationFeatChoices.some((entry) => entry.chosen.length < entry.max);
  const nestedInvocationFeatGroups = ctx.invocationGrantedFeatChoices.groups.map((choice) => ({
    key: choice.key, title: choice.title, sourceLabel: choice.sourceLabel, options: choice.options,
    chosen: ctx.form.chosenFeatOptions[choice.key] ?? [], max: choice.count, note: choice.note,
    onToggle: (value: string) => ctx.setForm((prev) => {
      const current = prev.chosenFeatOptions[choice.key] ?? [];
      const next = current.includes(value) ? current.filter((selected) => selected !== value) : current.length < choice.count ? [...current, value] : current;
      return { ...prev, chosenFeatOptions: { ...prev.chosenFeatOptions, [choice.key]: next } };
    }),
  }));
  const nestedInvocationFeatSpells = ctx.invocationGrantedFeatChoices.spellChoices.map((choice) => ({
    key: choice.key, title: choice.title, sourceLabel: choice.sourceLabel,
    spells: (ctx.invocationGrantedFeatChoices.spellOptions[choice.key] ?? []).map((spell) => ({ ...spell, level: (spell as { level?: number | null }).level ?? null })),
    chosen: ctx.form.chosenFeatOptions[choice.key] ?? [], max: choice.count, note: choice.note,
    emptyMsg: choice.linkedTo && (ctx.form.chosenFeatOptions[choice.linkedTo] ?? []).length === 0 ? "Choose the spell list first." : "No eligible spells found.",
    onToggle: (id: string) => ctx.setForm((prev) => {
      const current = prev.chosenFeatOptions[choice.key] ?? [];
      const next = current.includes(id) ? current.filter((selected) => selected !== id) : current.length < choice.count ? [...current, id] : current;
      return { ...prev, chosenFeatOptions: { ...prev.chosenFeatOptions, [choice.key]: next } };
    }),
  }));

  function toggleSpell(id: string, listKey: "chosenCantrips" | "chosenSpells" | "chosenInvocations", max: number) {
    ctx.setForm((f) => {
      const current = f[listKey];
      const next = current.includes(id) ? current.filter((x) => x !== id) : current.length < max ? [...current, id] : current;
      return { ...f, [listKey]: next };
    });
  }

  return renderSpellsStep({
    isCaster,
    cantripCount,
    classCantrips: ctx.classCantrips,
    chosenCantrips: ctx.form.chosenCantrips,
    toggleCantrip: (id) => toggleSpell(id, "chosenCantrips", cantripCount),
    invocCount,
    classInvocations: ctx.classInvocations.filter((inv) => ctx.eligibleInvocationIds.has(inv.id)),
    chosenInvocations: ctx.form.chosenInvocations,
    toggleInvocation: (id, action) => ctx.setForm((form) => {
      const current = form.chosenInvocations;
      const talent = ctx.classInvocations.find((entry) => entry.id === id);
      if (action === "add" && talent?.repeatable && current.length < invocCount) return { ...form, chosenInvocations: [...current, id] };
      if (action === "remove") {
        const index = current.lastIndexOf(id);
        return index < 0 ? form : { ...form, chosenInvocations: current.filter((_, candidate) => candidate !== index) };
      }
      return form;
    }),
    invocationAllowed: (inv) => ctx.eligibleInvocationIds.has(inv.id),
    prepCount,
    maxSlotLevel: maxSlotLvl,
    classSpells: ctx.classSpells,
    chosenSpells: ctx.form.chosenSpells,
    toggleSpell: (id) => toggleSpell(id, "chosenSpells", prepCount),
    extraSpellListChoices,
    extraSpellChoices: [...extraSpellChoices, ...nestedInvocationFeatSpells, ...maneuverSpellChoices],
    extraChoiceGroups: [...featSpellcastingAbilityChoices, ...invocationFeatChoices, ...nestedInvocationFeatGroups, ...maneuverAbilityChoices, ...progressionTableChoices],
    extraItemChoices: planItemChoices,
    onBack: () => ctx.setStep(7),
    onNext: () => ctx.setStep(9),
    nextDisabled: missingExtraSpellSelections || missingSpellcastingAbilitySelections || missingInvocationFeatSelections || !ctx.invocationGrantedFeatChoices.valid,
    side: ctx.sideSummary,
  });
}
