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
  profChipStyle,
  sourceTagStyle,
  statLabelStyle, statValueStyle,
} from "../shared/CharacterCreatorStyles";

export { renderCampaignsStep, renderClassStep, renderIdentityStep, renderSpeciesStep } from "./CharacterCreatorPanelCoreSteps";

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

export { renderLevelStep } from "./CharacterCreatorPanelLevelStep";

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
