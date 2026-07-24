import type React from "react";
import { api } from "@/services/api";
import { patchMyCharacter, putMyCharacter } from "@/views/character/characterApi";
import {
  shouldResetOnRest,
  parseLeadingNumberLoose,
  type Character,
  type SheetOverrides,
  type PolymorphConditionData,
  type ClassRestDetail,
  type RaceFeatureDetail,
} from "@/views/character/CharacterViewHelpers";
import type { CharacterData, ConditionInstance, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import { toggleConditionInstance } from "@/views/character/CharacterConditions";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
import { getLongRestOverrides, getLongRestRecovery } from "@/views/character/CharacterRestRecovery";
import { recoverItemCharges } from "@/views/character/CharacterInventory";
import { parseFeatureEffects } from "@/domain/character/parseFeatureEffects";
import type { MulticlassSpellSlotState } from "@/domain/character/multiclassSpellcasting";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";

export function scopePreparedSpellsByClass(args: {
  preparedSpellKeys: string[];
  classStates: Array<{ classEntryId: string; preparedLimit: number }>;
  trackedSpells: Array<{ name: string; classEntryId?: string | null }>;
  existing?: Record<string, { preparedSpells?: string[]; [key: string]: unknown }>;
}) {
  const result = { ...(args.existing ?? {}) };
  const ownerByKey = new Map(args.trackedSpells
    .filter((spell) => spell.classEntryId)
    .map((spell) => [normalizeSpellTrackingKey(spell.name), spell.classEntryId!]));
  const fallbackClassId = args.classStates.find((state) => state.preparedLimit > 0)?.classEntryId
    ?? args.classStates[0]?.classEntryId;
  for (const state of args.classStates) {
    const selected = args.preparedSpellKeys.filter((key) => {
      const owner = ownerByKey.get(key);
      return owner === state.classEntryId || (!owner && state.classEntryId === fallbackClassId);
    });
    result[state.classEntryId] = {
      ...(result[state.classEntryId] ?? {}),
      preparedSpells: state.preparedLimit > 0 ? selected.slice(0, state.preparedLimit) : selected,
    };
  }
  return result;
}

/** True when a species trait grants the well-known "heroic_inspiration" resource (e.g. Human's
 * Resourceful) — read from the trait's own structured effects, never from its name. */
function hasHeroicInspirationGrant(raceDetail: RaceFeatureDetail | null): boolean {
  return (raceDetail?.traits ?? []).some((trait) => {
    if (!trait.effects?.length) return false;
    const parsed = parseFeatureEffects({
      source: { id: `combat-actions:${trait.name}`, kind: "species", name: trait.name, text: trait.text },
      text: trait.text,
      traitEffects: trait.effects,
    });
    return parsed.effects.some((effect) => effect.type === "resource_grant" && effect.resourceKey === "heroic_inspiration");
  });
}

export function buildCharacterRuntimeActions(args: {
  char: Character;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  classDetail: ClassRestDetail | null;
  spellSlotState?: MulticlassSpellSlotState;
  classSpellcastingStates?: Array<{ classEntryId: string; preparedLimit: number; preparedSpells: string[] }>;
  raceDetail: RaceFeatureDetail | null;
  currentCharacterData: CharacterData;
  classResourcesWithSpellCasts: ResourceCounter[];
  hitDiceMax: number;
  hitDicePools?: Array<{ dieSize: number; max: number; current: number }>;
  inventory: CharacterData["inventory"];
  effectiveHpMaxWithoutOverrides: number;
  overrides: SheetOverrides;
  polymorphCondition: PolymorphConditionData | null;
  saveCharacterData: (updatedData: CharacterData) => Promise<Character | null>;
  setXpPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setCondSaving: React.Dispatch<React.SetStateAction<boolean>>;
  fetchChar: () => Promise<void>;
  setPolymorphApplyingId: React.Dispatch<React.SetStateAction<string | null>>;
  setPolymorphDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  preparedSpellLimit: number;
  usesFlexiblePreparedList: boolean;
  preparedSpells: string[];
  forcedPreparedSpellKeys: Set<string>;
  normalizeSpellTrackingKey: (name: string) => string;
}) {
  const {
    char,
    setChar,
    classDetail,
    spellSlotState,
    classSpellcastingStates = [],
    raceDetail,
    currentCharacterData,
    classResourcesWithSpellCasts,
    hitDiceMax,
    hitDicePools = [],
    inventory,
    effectiveHpMaxWithoutOverrides,
    overrides,
    polymorphCondition,
    saveCharacterData,
    setXpPopupOpen,
    setDsSaving,
    setCondSaving,
    fetchChar,
    setPolymorphApplyingId,
    setPolymorphDrawerOpen,
    preparedSpellLimit,
    usesFlexiblePreparedList,
    preparedSpells,
    forcedPreparedSpellKeys,
    normalizeSpellTrackingKey,
  } = args;

  const saveXp = async (value: number) => {
    await saveCharacterData({ xp: value });
    setXpPopupOpen(false);
  };

  const saveHitDiceCurrent = async (nextValue: number) => {
    const next = Math.max(0, Math.min(hitDiceMax, Math.floor(nextValue)));
    await saveCharacterData({ hitDiceCurrent: next });
  };
  const saveHitDicePoolCurrent = async (dieSize: number, nextValue: number) => {
    const pool = hitDicePools.find((entry) => entry.dieSize === dieSize);
    if (!pool) return;
    const current = Math.max(0, Math.min(pool.max, Math.floor(nextValue)));
    const hitDiceCurrentBySize = Object.fromEntries(hitDicePools.map((entry) => [String(entry.dieSize), entry.dieSize === dieSize ? current : entry.current]));
    await saveCharacterData({ hitDiceCurrentBySize, hitDiceCurrent: Object.values(hitDiceCurrentBySize).reduce((sum, value) => sum + value, 0) });
  };

  const saveResources = async (nextResources: ResourceCounter[]) => {
    await saveCharacterData({ resources: nextResources });
  };

  const saveUsedSpellSlots = async (next: Record<string, number>) => {
    await saveCharacterData({ usedSpellSlots: next });
  };

  const savePreparedSpells = async (next: string[]) => {
    const unique = Array.from(new Set(next));
    const forced = unique.filter((entry) => forcedPreparedSpellKeys.has(entry));
    const userChosen = unique.filter((entry) => !forcedPreparedSpellKeys.has(entry));
    const limitedUserChosen = preparedSpellLimit > 0 ? userChosen.slice(0, preparedSpellLimit) : userChosen;
    const limited = [...forced, ...limitedUserChosen];
    const classSpellSelections = scopePreparedSpellsByClass({
      preparedSpellKeys: limited,
      classStates: classSpellcastingStates,
      trackedSpells: currentCharacterData.proficiencies?.spells ?? [],
      existing: currentCharacterData.classSpellSelections,
    });
    await saveCharacterData({ preparedSpells: limited, classSpellSelections });
  };

  const baseProficiencies = currentCharacterData.proficiencies ?? {
    skills: [],
    expertise: [],
    saves: [],
    armor: [],
    weapons: [],
    weaponMasteries: [],
    tools: [],
    languages: [],
    spells: [],
    invocations: [],
    maneuvers: [],
    metamagic: [],
    plans: [],
  };
  const normalizeSpellName = (name: string) => name.replace(/\s*\[[^\]]+\]\s*$/u, "").trim().toLowerCase();

  const addTrackedSpell = async (spell: { name: string; id?: string; level?: number | null }) => {
    const spellName = String(spell.name ?? "").trim();
    if (!spellName) return;
    const normalized = normalizeSpellName(spellName);
    const existing = Array.isArray(currentCharacterData.proficiencies?.spells) ? currentCharacterData.proficiencies.spells : [];
    if (existing.some((entry) => normalizeSpellName(entry.name) === normalized)) return;
    const nextSpells = [
      ...existing,
      { name: spellName, source: classDetail?.name ?? char.className ?? "Manual", classEntryId: classSpellcastingStates[0]?.classEntryId ?? null, sourceKey: classSpellcastingStates[0] ? `class:${classSpellcastingStates[0].classEntryId}` : null, ...(spell.id ? { id: String(spell.id) } : {}) },
    ].sort((a, b) => a.name.localeCompare(b.name));
    const nextPreparedSpells = (() => {
      if (!usesFlexiblePreparedList || !spell.level || spell.level <= 0) return currentCharacterData.preparedSpells;
      const currentPrepared = Array.isArray(currentCharacterData.preparedSpells) ? currentCharacterData.preparedSpells : [];
      const normalizedKey = normalizeSpellTrackingKey(spellName);
      if (!normalizedKey || currentPrepared.includes(normalizedKey) || forcedPreparedSpellKeys.has(normalizedKey)) return currentPrepared;
      const userPreparedCount = currentPrepared.filter((entry) => !forcedPreparedSpellKeys.has(entry)).length;
      if (preparedSpellLimit > 0 && userPreparedCount >= preparedSpellLimit) return currentPrepared;
      return [...currentPrepared, normalizedKey];
    })();
    await saveCharacterData({
      preparedSpells: nextPreparedSpells,
      proficiencies: { ...baseProficiencies, spells: nextSpells },
    });
  };

  const removeTrackedSpell = async (spellName: string) => {
    const normalized = normalizeSpellName(spellName);
    const existing = Array.isArray(currentCharacterData.proficiencies?.spells) ? currentCharacterData.proficiencies.spells : [];
    const nextSpells = existing.filter((entry) => normalizeSpellName(entry.name) !== normalized);
    const nextPrepared = preparedSpells.filter((key) => key !== normalized.replace(/[^a-z0-9]/g, ""));
    await saveCharacterData({
      preparedSpells: nextPrepared,
      proficiencies: { ...baseProficiencies, spells: nextSpells },
    });
  };

  const handleItemChargeChange = async (itemId: string, charges: number) => {
    const nextInventory = (inventory ?? []).map((item) => item.id === itemId ? { ...item, charges } : item);
    await saveCharacterData({ inventory: nextInventory });
  };

  const changeResourceCurrent = async (key: string, delta: number) => {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      resource.key !== key
        ? resource
        : { ...resource, current: Math.max(0, Math.min(resource.max, resource.current + delta)) },
    );
    await saveResources(nextResources);
  };

  const handleShortRest = async () => {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      shouldResetOnRest(resource.reset, "short")
        ? {
            ...resource,
            current: resource.restoreAmount === "one"
              ? Math.min(resource.max, resource.current + 1)
              : resource.max,
          }
        : resource,
    );
    const pactPrefixes = (spellSlotState?.pactPools ?? []).map((pool) => `${pool.key}:`);
    if (pactPrefixes.length > 0 || /S/i.test(classDetail?.slotsReset ?? "L")) {
      const usedSpellSlots = Object.fromEntries(Object.entries(currentCharacterData.usedSpellSlots ?? {})
        .filter(([key]) => !pactPrefixes.some((prefix) => key.startsWith(prefix))));
      await saveCharacterData({ resources: nextResources, usedSpellSlots });
    } else {
      await saveResources(nextResources);
    }
  };

  const handleLongRest = async () => {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      shouldResetOnRest(resource.reset, "long")
        ? { ...resource, current: resource.max }
        : resource,
    );
    const recovery = getLongRestRecovery(hitDiceMax, currentCharacterData.exhaustion ?? 0);
    let hitDiceToRestore = Math.max(0, recovery.hitDiceCurrent - hitDicePools.reduce((sum, pool) => sum + pool.current, 0));
    const recoveredHitDiceBySize = Object.fromEntries(hitDicePools.map((pool) => {
      const restored = Math.min(pool.max - pool.current, hitDiceToRestore);
      hitDiceToRestore -= restored;
      return [String(pool.dieSize), pool.current + restored];
    }));
    const nextUsedSpellSlots = {};
    const nextInventory = (inventory ?? []).map((item) => recoverItemCharges(item));
    const hasResourceful = hasHeroicInspirationGrant(raceDetail);
    const nextOverrides = getLongRestOverrides(Boolean(overrides.inspiration), hasResourceful);

    await putMyCharacter(char.id, {
      hpCurrent: effectiveHpMaxWithoutOverrides,
      characterData: {
        hitDiceCurrent: recovery.hitDiceCurrent,
        hitDiceCurrentBySize: recoveredHitDiceBySize,
        exhaustion: recovery.exhaustion,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    });

    const nextDeathSaves = { success: 0, fail: 0 };
    await patchMyCharacter(char.id, "deathSaves", nextDeathSaves);
    await patchMyCharacter(char.id, "overrides", nextOverrides);

    if (hasResourceful && !(overrides.inspiration ?? false)) {
      await patchMyCharacter(char.id, "inspiration", { inspiration: true });
    }

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: effectiveHpMaxWithoutOverrides,
      deathSaves: nextDeathSaves,
      overrides: nextOverrides,
      characterData: {
        ...prev.characterData,
        hitDiceCurrent: recovery.hitDiceCurrent,
        hitDiceCurrentBySize: recoveredHitDiceBySize,
        exhaustion: recovery.exhaustion,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
        sheetOverrides: nextOverrides,
      },
    } : prev);
  };

  const handleToggleInspiration = async () => {
    const next = !(overrides.inspiration ?? false);
    await patchMyCharacter(char.id, "inspiration", { inspiration: next });
    setChar((prev) => prev ? { ...prev, overrides: { ...prev.overrides!, inspiration: next } } : prev);
  };

  const saveDeathSaves = async (next: { success: number; fail: number }) => {
    setDsSaving(true);
    try {
      await patchMyCharacter(char.id, "deathSaves", next);
      setChar((prev) => prev ? { ...prev, deathSaves: next } : prev);
    } catch (error) {
      console.error("Death saves update failed:", error);
    } finally {
      setDsSaving(false);
    }
  };

  const commitPolymorphResolution = async (params: {
    hpCurrent: number;
    overrides: SheetOverrides;
    conditions: ConditionInstance[];
  }) => {
    const { hpCurrent, overrides: nextOverrides, conditions: nextConditions } = params;
    await Promise.all([
      putMyCharacter(char.id, { hpCurrent }),
      patchMyCharacter(char.id, "overrides", nextOverrides),
      patchMyCharacter(char.id, "conditions", { conditions: nextConditions }),
    ]);
    setChar((prev) => prev ? {
      ...prev,
      hpCurrent,
      overrides: { ...(prev.overrides ?? {}), ...nextOverrides },
      conditions: nextConditions,
      characterData: {
        ...(prev.characterData ?? {}),
        sheetOverrides: nextOverrides,
      },
    } : prev);
  };

  const revertPolymorph = async (applyOverflowDamage = 0) => {
    if (!polymorphCondition) return;
    const originalHp = typeof polymorphCondition.originalHpCurrent === "number"
      ? polymorphCondition.originalHpCurrent
      : 0;
    const nextOverrides: SheetOverrides = {
      tempHp: Math.max(0, Number(overrides.tempHp ?? 0) || 0),
      acBonus: Math.floor(Number(polymorphCondition.originalAcBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(polymorphCondition.originalHpMaxBonus ?? 0) || 0),
      inspiration: overrides.inspiration,
    };
    const nextConditions = (char.conditions ?? []).filter((condition) => condition.key !== "polymorphed");
    await commitPolymorphResolution({
      hpCurrent: Math.max(0, originalHp - Math.max(0, applyOverflowDamage)),
      overrides: nextOverrides,
      conditions: nextConditions,
    });
  };

  const applyPolymorphSelf = async (row: CompendiumMonsterRow) => {
    setPolymorphApplyingId(row.id);
    try {
      const detail = await api<any>(`/api/compendium/monsters/${encodeURIComponent(row.id)}`);
      const ac = parseLeadingNumberLoose(detail?.ac);
      const hp = parseLeadingNumberLoose(detail?.hp);
      if (!Number.isFinite(ac) || !Number.isFinite(hp) || ac <= 0 || hp <= 0) {
        throw new Error("Selected form is missing usable AC or HP.");
      }
      const nextOverrides: SheetOverrides = {
        tempHp: Math.max(0, Number(overrides.tempHp ?? 0) || 0),
        acBonus: Math.round(ac) - char.ac,
        hpMaxBonus: Math.round(hp) - char.hpMax,
        inspiration: overrides.inspiration,
      };
      const nextConditions: ConditionInstance[] = [
        ...(char.conditions ?? []).filter((condition) => condition.key !== "polymorphed"),
        {
          key: "polymorphed",
          polymorphName: row.name,
          polymorphMonsterId: row.id,
          originalAcBonus: Math.floor(Number(overrides.acBonus ?? 0) || 0),
          originalHpMaxBonus: Math.floor(Number(overrides.hpMaxBonus ?? 0) || 0),
          originalHpCurrent: char.hpCurrent,
        },
      ];
      await commitPolymorphResolution({
        hpCurrent: Math.round(hp),
        overrides: nextOverrides,
        conditions: nextConditions,
      });
      setPolymorphDrawerOpen(false);
    } finally {
      setPolymorphApplyingId(null);
    }
  };

  const toggleCondition = async (key: string, condition?: ConditionInstance) => {
    if (key === "polymorphed") {
      setCondSaving(true);
      try {
        await revertPolymorph(0);
      } catch (error) {
        fetchChar();
        console.error("Polymorph revert failed:", error);
      } finally {
        setCondSaving(false);
      }
      return;
    }
    const current = char.conditions ?? [];
    const has = current.some((condition) => condition.key === key);
    const next = toggleConditionInstance(current, key, condition);
    setCondSaving(true);
    try {
      let characterPatch: CharacterData = {};
      if (key === "rage" && !has) {
        // No class-name check needed: only a character whose class actually grants a Rage
        // resource (via the compendium's per-level resources table — see collectClassResources)
        // will ever have one here, regardless of what their class is named.
        const rageResource = classResourcesWithSpellCasts.find((resource) => /^rage$/i.test(resource.name) || resource.key === "rage");
        if (!rageResource || rageResource.current <= 0) return;
        const nextResources = classResourcesWithSpellCasts.map((resource) =>
          resource.key !== rageResource.key ? resource : { ...resource, current: Math.max(0, resource.current - 1) },
        );
        characterPatch = { resources: nextResources };
        await saveCharacterData(characterPatch);
      }
      await patchMyCharacter(char.id, "conditions", { conditions: next });
      setChar((prev) => prev ? { ...prev, conditions: next, characterData: { ...(prev.characterData ?? {}), ...characterPatch } } : prev);
    } catch (error) {
      fetchChar();
      console.error("Condition update failed:", error);
    } finally {
      setCondSaving(false);
    }
  };

  return {
    saveXp,
    saveHitDiceCurrent,
    saveResources,
    saveHitDicePoolCurrent,
    saveUsedSpellSlots,
    savePreparedSpells,
    addTrackedSpell,
    removeTrackedSpell,
    handleItemChargeChange,
    changeResourceCurrent,
    handleShortRest,
    handleLongRest,
    handleToggleInspiration,
    saveDeathSaves,
    revertPolymorph,
    applyPolymorphSelf,
    toggleCondition,
  };
}
