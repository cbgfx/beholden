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
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";

export function buildCharacterRuntimeActions(args: {
  char: Character;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  classDetail: ClassRestDetail | null;
  raceDetail: RaceFeatureDetail | null;
  currentCharacterData: CharacterData;
  classResourcesWithSpellCasts: ResourceCounter[];
  hitDiceMax: number;
  hitDiceCurrent: number;
  inventory: CharacterData["inventory"];
  effectiveHpMax: number;
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
    raceDetail,
    currentCharacterData,
    classResourcesWithSpellCasts,
    hitDiceMax,
    hitDiceCurrent,
    inventory,
    effectiveHpMax,
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
    const updated: CharacterData = { ...currentCharacterData, xp: value };
    await saveCharacterData(updated);
    setXpPopupOpen(false);
  };

  const saveHitDiceCurrent = async (nextValue: number) => {
    const next = Math.max(0, Math.min(hitDiceMax, Math.floor(nextValue)));
    await saveCharacterData({ ...currentCharacterData, hitDiceCurrent: next });
  };

  const saveResources = async (nextResources: ResourceCounter[]) => {
    await saveCharacterData({ ...currentCharacterData, resources: nextResources });
  };

  const saveUsedSpellSlots = async (next: Record<string, number>) => {
    await saveCharacterData({ ...currentCharacterData, usedSpellSlots: next });
  };

  const savePreparedSpells = async (next: string[]) => {
    const unique = Array.from(new Set(next));
    const forced = unique.filter((entry) => forcedPreparedSpellKeys.has(entry));
    const userChosen = unique.filter((entry) => !forcedPreparedSpellKeys.has(entry));
    const limitedUserChosen = preparedSpellLimit > 0 ? userChosen.slice(0, preparedSpellLimit) : userChosen;
    const limited = [...forced, ...limitedUserChosen];
    await saveCharacterData({ ...currentCharacterData, preparedSpells: limited });
  };

  const baseProficiencies = currentCharacterData.proficiencies ?? {
    skills: [],
    expertise: [],
    saves: [],
    armor: [],
    weapons: [],
    tools: [],
    languages: [],
    spells: [],
    invocations: [],
    maneuvers: [],
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
      { name: spellName, source: classDetail?.name ?? char.className ?? "Manual", ...(spell.id ? { id: String(spell.id) } : {}) },
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
      ...currentCharacterData,
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
      ...currentCharacterData,
      preparedSpells: nextPrepared,
      proficiencies: { ...baseProficiencies, spells: nextSpells },
    });
  };

  const handleItemChargeChange = async (itemId: string, charges: number) => {
    const nextInventory = (inventory ?? []).map((item) => item.id === itemId ? { ...item, charges } : item);
    await saveCharacterData({ ...currentCharacterData, inventory: nextInventory });
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
    const slotsReset = classDetail?.slotsReset ?? "L";
    if (/S/i.test(slotsReset)) {
      await saveCharacterData({ ...currentCharacterData, resources: nextResources, usedSpellSlots: {} });
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
    const recoveredHitDice = hitDiceMax > 0 ? Math.max(1, Math.floor(hitDiceMax / 2)) : 0;
    const nextHitDice = Math.max(0, Math.min(hitDiceMax, hitDiceCurrent + recoveredHitDice));
    const slotsReset = classDetail?.slotsReset ?? "L";
    const nextUsedSpellSlots = /S/i.test(slotsReset) ? (currentCharacterData.usedSpellSlots ?? {}) : {};
    const nextInventory = (inventory ?? []).map((item) => ((item.chargesMax ?? 0) > 0 ? { ...item, charges: item.chargesMax } : item));

    await putMyCharacter(char.id, {
      hpCurrent: effectiveHpMax,
      characterData: {
        ...currentCharacterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    });

    const nextDeathSaves = { success: 0, fail: 0 };
    await patchMyCharacter(char.id, "deathSaves", nextDeathSaves);

    const hasResourceful = raceDetail?.traits?.some((trait) => /^resourceful$/i.test(trait.name)) ?? false;
    if (hasResourceful && !(overrides.inspiration ?? false)) {
      await patchMyCharacter(char.id, "inspiration", { inspiration: true });
    }

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: effectiveHpMax,
      deathSaves: nextDeathSaves,
      overrides: hasResourceful ? { ...prev.overrides!, inspiration: true } : prev.overrides,
      characterData: {
        ...prev.characterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    } : prev);
  };

  const handleFullRest = async () => {
    const nextResources = classResourcesWithSpellCasts.map((resource) => ({
      ...resource,
      current: resource.max,
    }));
    const nextHitDice = hitDiceMax;
    const nextUsedSpellSlots: Record<string, number> = {};
    const nextInventory = (inventory ?? []).map((item) => ((item.chargesMax ?? 0) > 0 ? { ...item, charges: item.chargesMax } : item));
    const nextDeathSaves = { success: 0, fail: 0 };
    const nextOverrides = {
      tempHp: 0,
      acBonus: Math.floor(Number(overrides.acBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(overrides.hpMaxBonus ?? 0) || 0),
    };
    const hasResourceful = raceDetail?.traits?.some((trait) => /^resourceful$/i.test(trait.name)) ?? false;
    const nextInspiration = hasResourceful ? true : (overrides.inspiration ?? false);

    await putMyCharacter(char.id, {
      hpCurrent: effectiveHpMax,
      characterData: {
        ...currentCharacterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    });
    await Promise.all([
      patchMyCharacter(char.id, "deathSaves", nextDeathSaves),
      patchMyCharacter(char.id, "overrides", nextOverrides),
      nextInspiration !== (overrides.inspiration ?? false)
        ? patchMyCharacter(char.id, "inspiration", { inspiration: nextInspiration })
        : Promise.resolve(null),
    ]);

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: effectiveHpMax,
      deathSaves: nextDeathSaves,
      overrides: { ...(prev.overrides ?? {}), ...nextOverrides, inspiration: nextInspiration },
      characterData: {
        ...prev.characterData,
        hitDiceCurrent: nextHitDice,
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

  const toggleCondition = async (key: string) => {
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
    const next = has ? current.filter((condition) => condition.key !== key) : [...current, { key }];
    setCondSaving(true);
    try {
      let nextCharacterData = currentCharacterData;
      if (key === "rage" && !has) {
        if (!/barbarian/i.test(String(char.className ?? ""))) return;
        const rageResource = classResourcesWithSpellCasts.find((resource) => /^rage$/i.test(resource.name) || resource.key === "rage");
        if (!rageResource || rageResource.current <= 0) return;
        const nextResources = classResourcesWithSpellCasts.map((resource) =>
          resource.key !== rageResource.key ? resource : { ...resource, current: Math.max(0, resource.current - 1) },
        );
        nextCharacterData = { ...currentCharacterData, resources: nextResources };
        await saveCharacterData(nextCharacterData);
      }
      await patchMyCharacter(char.id, "conditions", { conditions: next });
      setChar((prev) => prev ? { ...prev, conditions: next, characterData: { ...(prev.characterData ?? {}), ...nextCharacterData } } : prev);
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
    saveUsedSpellSlots,
    savePreparedSpells,
    addTrackedSpell,
    removeTrackedSpell,
    handleItemChargeChange,
    changeResourceCurrent,
    handleShortRest,
    handleLongRest,
    handleFullRest,
    handleToggleInspiration,
    saveDeathSaves,
    revertPolymorph,
    applyPolymorphSelf,
    toggleCondition,
  };
}
