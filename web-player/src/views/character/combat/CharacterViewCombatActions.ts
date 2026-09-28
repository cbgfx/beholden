import { countOrdinaryPreparations } from "@beholden/shared/domain/progressionRequirements";
import type React from "react";
import { api } from "@/services/api";
import { patchMyCharacter, putMyCharacter } from "@/views/character/state/characterApi";
import { conditionsAfterRest } from "@beholden/shared/domain/conditions";
import {
  shouldResetOnRest,
  parseLeadingNumberLoose,
  type Character,
  type SheetOverrides,
  type PolymorphConditionData,
  type ClassRestDetail,
  type RaceFeatureDetail,
} from "@/views/character/CharacterViewHelpers";
import type { CharacterData, ConditionInstance, ResourceCounter, TaggedItem } from "@/views/character/CharacterSheetTypes";
import { toggleConditionInstance } from "@/views/character/combat/CharacterConditions";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
import { getLongRestOverrides, getLongRestRecovery } from "@/views/character/combat/CharacterRestRecovery";
import { resolvePolymorphRevert } from "@beholden/shared/domain/actors";
import { recoverItemCharges } from "@/views/character/inventory/CharacterInventory";
import { parseFeatureEffects } from "@/domain/character/parseFeatureEffects";
import type { MulticlassSpellSlotState } from "@/domain/character/multiclassSpellcasting";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import { hitDiceSpentWithCurrent, type HitDicePool } from "@beholden/shared/domain/hitDice";
import { withPreparedSpellKeys } from "@beholden/shared/domain/spellPreparation";

/**
 * Which of the requested prepared keys stay prepared: each class keeps its always-prepared spells
 * and at most its own limit of the rest. A spell with no class counts toward the first class that
 * prepares. With no spellcasting classes resolved, the keys pass through unlimited.
 */
export function keepPreparedWithinClassLimits(args: {
  preparedSpellKeys: string[];
  classStates: Array<{ classEntryId: string; preparedLimit: number }>;
  trackedSpells: Array<{ name: string; classEntryId?: string | null }>;
  forcedPreparedKeys?: ReadonlySet<string>;
}): string[] {
  const requested = Array.from(new Set(args.preparedSpellKeys));
  if (args.classStates.length === 0) return requested;
  const ownerByKey = new Map(args.trackedSpells
    .filter((spell) => spell.classEntryId)
    .map((spell) => [normalizeSpellTrackingKey(spell.name), spell.classEntryId!]));
  const fallbackClassId = args.classStates.find((state) => state.preparedLimit > 0)?.classEntryId
    ?? args.classStates[0]?.classEntryId;
  const kept: string[] = [];
  for (const state of args.classStates) {
    const selected = requested.filter((key) => {
      const owner = ownerByKey.get(key);
      return owner === state.classEntryId || (!owner && state.classEntryId === fallbackClassId);
    });
    const forced = selected.filter((key) => args.forcedPreparedKeys?.has(key));
    const ordinary = selected.filter((key) => !args.forcedPreparedKeys?.has(key));
    kept.push(...(state.preparedLimit > 0 ? [...forced, ...ordinary.slice(0, state.preparedLimit)] : selected));
  }
  return Array.from(new Set(kept));
}

/**
 * The stored hit dice after setting the total left. Only a character with one die size has a single
 * total to set; with several sizes each pool is set on its own, and with none nothing is stored.
 */
export function hitDicePatchForTotal(
  nextValue: number,
  hitDicePools: HitDicePool[],
): Pick<CharacterData, "hitDiceSpent"> | null {
  const solePool = hitDicePools.length === 1 ? hitDicePools[0]! : null;
  return solePool ? { hitDiceSpent: hitDiceSpentWithCurrent(hitDicePools, solePool.dieSize, nextValue) } : null;
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
  hitDicePools?: Array<{ dieSize: number; max: number; current: number }>;
  inventory: CharacterData["inventory"];
  inventoryRev?: string;
  spellStateRev?: string;
  effectiveHpMaxWithoutOverrides: number;
  effectiveHpMax: number;
  overrides: SheetOverrides;
  polymorphCondition: PolymorphConditionData | null;
  saveCharacterData: (updatedData: CharacterData, opts?: { expectedInventoryRev?: string; expectedSpellStateRev?: string }) => Promise<Character | null>;
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
  /** null when not currently in a tracked encounter (no reaction to mark) -- distinct from
   * `false`, meaning in combat with the reaction still available. */
  reactionUsed: boolean | null;
  toggleReaction: (() => Promise<void>) | null;
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
    hitDicePools = [],
    inventory,
    inventoryRev,
    spellStateRev,
    effectiveHpMaxWithoutOverrides,
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
    reactionUsed,
    toggleReaction,
  } = args;

  const saveXp = async (value: number) => {
    await saveCharacterData({ xp: value });
    setXpPopupOpen(false);
  };

  const saveHitDiceCurrent = async (nextValue: number) => {
    const patch = hitDicePatchForTotal(nextValue, hitDicePools);
    if (patch) await saveCharacterData(patch);
  };
  const saveHitDicePoolCurrent = async (dieSize: number, nextValue: number) => {
    if (!hitDicePools.some((entry) => entry.dieSize === dieSize)) return;
    await saveCharacterData({ hitDiceSpent: hitDiceSpentWithCurrent(hitDicePools, dieSize, nextValue) });
  };

  const saveResources = async (nextResources: ResourceCounter[]) => {
    await saveCharacterData({ resources: nextResources });
  };

  const saveUsedSpellSlots = async (next: Record<string, number>) => {
    try {
      await saveCharacterData({ usedSpellSlots: next }, { expectedSpellStateRev: spellStateRev });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "stale-spell-state") await fetchChar();
      throw error;
    }
  };

  // The spell list to store with exactly these spells prepared, within each class's limit.
  // Preparation is a flag on each spell's own entry (shared/domain/spellPreparation), so the
  // spell list is the only thing ever written: removing a spell removes its preparation with it.
  const spellsPrepared = (keys: string[], spells: TaggedItem[]): TaggedItem[] => {
    const kept = keepPreparedWithinClassLimits({
      preparedSpellKeys: keys,
      classStates: classSpellcastingStates,
      trackedSpells: spells,
      forcedPreparedKeys: forcedPreparedSpellKeys,
    });
    const forced = kept.filter((entry) => forcedPreparedSpellKeys.has(entry));
    const ordinary = kept.filter((entry) => !forcedPreparedSpellKeys.has(entry));
    const limited = classSpellcastingStates.length === 0 && preparedSpellLimit > 0
      ? [...forced, ...ordinary.slice(0, preparedSpellLimit)]
      : kept;
    return withPreparedSpellKeys(spells, limited);
  };

  const savePreparedSpells = async (next: string[]) => {
    const spells = spellsPrepared(next, currentCharacterData.proficiencies?.spells ?? []);
    try {
      await saveCharacterData({ proficiencies: { ...baseProficiencies, spells } }, { expectedSpellStateRev: spellStateRev });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === "stale-spell-state") await fetchChar();
      throw error;
    }
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
    infusions: [],
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
    // A flexible preparer's new leveled spell is prepared straight away when there is room, in its
    // class's own list. Counted from the class lists the sheet shows, not the top-level mirror.
    const autoPreparedKey = (() => {
      if (!usesFlexiblePreparedList || !spell.level || spell.level <= 0) return null;
      const normalizedKey = normalizeSpellTrackingKey(spellName);
      if (!normalizedKey || preparedSpells.includes(normalizedKey) || forcedPreparedSpellKeys.has(normalizedKey)) return null;
      const userPreparedCount = countOrdinaryPreparations(preparedSpells, forcedPreparedSpellKeys);
      if (preparedSpellLimit > 0 && userPreparedCount >= preparedSpellLimit) return null;
      return normalizedKey;
    })();
    await saveCharacterData({
      proficiencies: {
        ...baseProficiencies,
        spells: autoPreparedKey ? spellsPrepared([...preparedSpells, autoPreparedKey], nextSpells) : nextSpells,
      },
    }, { expectedSpellStateRev: spellStateRev });
  };

  const removeTrackedSpell = async (spellName: string) => {
    const normalized = normalizeSpellName(spellName);
    const existing = Array.isArray(currentCharacterData.proficiencies?.spells) ? currentCharacterData.proficiencies.spells : [];
    // Its prepared flag goes with its entry: nothing else to update.
    const nextSpells = existing.filter((entry) => normalizeSpellName(entry.name) !== normalized);
    await saveCharacterData({
      proficiencies: { ...baseProficiencies, spells: nextSpells },
    }, { expectedSpellStateRev: spellStateRev });
  };

  const handleItemChargeChange = async (itemId: string, charges: number) => {
    const nextInventory = (inventory ?? []).map((item) => item.id === itemId ? { ...item, charges } : item);
    try {
      await saveCharacterData({ inventory: nextInventory }, { expectedInventoryRev: inventoryRev });
    } catch (error) {
      if (["stale-inventory", "stale-spell-state"].includes((error as { code?: string } | null)?.code ?? "")) await fetchChar();
      throw error;
    }
  };

  const changeResourceCurrent = async (key: string, delta: number) => {
    const resource = classResourcesWithSpellCasts.find((entry) => entry.key === key);
    const nextResources = classResourcesWithSpellCasts.map((entry) =>
      entry.key !== key
        ? entry
        : { ...entry, current: Math.max(0, Math.min(entry.max, entry.current + delta)) },
    );
    await saveResources(nextResources);
    // Spending a Rage charge starts raging -- the reverse of what toggleCondition("rage")
    // already does (turning the condition on there spends a charge). Only the spend direction
    // auto-applies: giving a charge back doesn't mean "stop raging" (rage ends by choice or
    // turn-based rules, not by a refund), so ending it stays a manual condition toggle. The
    // `resource.current > 0` check keeps clicking "-" on an already-empty counter (clamped,
    // nothing actually spent) from applying the condition anyway.
    // A class-scoped resource key (e.g. "class:class_c_barbarian:rage") is the norm, not the
    // exception -- collectClassResources prefixes it with the owning class entry's id whenever
    // one is known, so matching the raw key against "rage" would silently never fire for a real
    // character. Match on name instead, same as toggleCondition("rage") already does below.
    const isRageResource = resource != null && (/^rage$/i.test(resource.name) || resource.key === "rage");
    if (isRageResource && delta < 0 && (resource?.current ?? 0) > 0 && !(char.conditions ?? []).some((condition) => condition.key === "rage")) {
      const nextConditions = toggleConditionInstance(char.conditions ?? [], "rage");
      try {
        await patchMyCharacter(char.id, "conditions", { conditions: nextConditions, previousConditions: char.conditions ?? [] });
        setChar((prev) => prev ? { ...prev, conditions: nextConditions } : prev);
      } catch (error) {
        fetchChar();
        console.error("Condition update failed:", error);
      }
    }
    // Any resource typed `actionType: "reaction"` (Warding Flare, Cosmic Omen, Glorious Defense,
    // ...) spends the Reaction itself -- spending a use of it in a tracked encounter marks the
    // Reaction spent too. `reactionUsed` is null outside combat (nothing to mark); `toggleReaction`
    // flips whatever the current value is, so only call it when the Reaction is still available --
    // calling it while already used would incorrectly free it back up.
    if (resource?.actionType === "reaction" && delta < 0 && (resource.current ?? 0) > 0 && reactionUsed === false && toggleReaction) {
      await toggleReaction();
    }
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
      await saveCharacterData({ resources: nextResources, usedSpellSlots }, { expectedSpellStateRev: spellStateRev });
    } else {
      await saveResources(nextResources);
    }

    // An hour outlasts anything measured in rounds, and nobody holds concentration through a rest.
    const nextConditions = conditionsAfterRest(char.conditions ?? [], "short");
    if (nextConditions.length !== (char.conditions ?? []).length) {
      await patchMyCharacter(char.id, "conditions", { conditions: nextConditions, previousConditions: char.conditions ?? [] });
      setChar((prev) => prev ? { ...prev, conditions: nextConditions } : prev);
    }
  };

  const handleLongRest = async () => {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      shouldResetOnRest(resource.reset, "long")
        ? { ...resource, current: resource.max }
        : resource,
    );
    // Every hit die comes back (the 2024 rule, used for every character): nothing spent.
    const recovery = getLongRestRecovery(currentCharacterData.exhaustion ?? 0);
    const nextUsedSpellSlots = {};
    const nextInventory = (inventory ?? []).map((item) => recoverItemCharges(item));
    const hasResourceful = hasHeroicInspirationGrant(raceDetail);

    // Polymorph isn't a duration a rest runs out: the condition holds the AC and HP maximum the
    // form replaced, so reverting means putting those back before the overrides are recomputed.
    // Dropping it with the other conditions would leave the character wearing the form's numbers.
    const revert = resolvePolymorphRevert({ overrides, conditions: char.conditions });
    const nextOverrides = getLongRestOverrides(
      Boolean(overrides.inspiration),
      hasResourceful,
      (revert?.overrides ?? overrides) as SheetOverrides,
    );
    const restedHpMax = revert
      // Back in their own body, so the true maximum plus whatever bonus outlived the rest.
      ? effectiveHpMaxWithoutOverrides + Math.max(0, Number(nextOverrides.hpMaxBonus ?? 0) || 0)
      : nextOverrides.permanent?.hpMaxBonus || nextOverrides.permanent?.abilityScores
        ? effectiveHpMax
        : effectiveHpMaxWithoutOverrides;
    const nextConditions = conditionsAfterRest(
      (revert?.conditions ?? char.conditions ?? []) as ConditionInstance[],
      "long",
    );

    let restedCharacter: Character;
    try {
      restedCharacter = await putMyCharacter(char.id, {
      hpCurrent: restedHpMax,
      expectedInventoryRev: inventoryRev,
      expectedSpellStateRev: spellStateRev,
      characterData: {
        hitDiceSpent: {},
        exhaustion: recovery.exhaustion,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
        concentrationSpell: null,
      },
      }) as Character;
    } catch (error) {
      if (["stale-inventory", "stale-spell-state"].includes((error as { code?: string } | null)?.code ?? "")) await fetchChar();
      throw error;
    }

    const nextDeathSaves = { success: 0, fail: 0 };
    await patchMyCharacter(char.id, "deathSaves", nextDeathSaves);
    await patchMyCharacter(char.id, "overrides", nextOverrides);
    if (nextConditions.length !== (char.conditions ?? []).length) {
      await patchMyCharacter(char.id, "conditions", { conditions: nextConditions, previousConditions: char.conditions ?? [] });
    }

    if (hasResourceful && !(overrides.inspiration ?? false)) {
      await patchMyCharacter(char.id, "inspiration", { inspiration: true });
    }

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: restedHpMax,
      inventoryRev: restedCharacter.inventoryRev ?? prev.inventoryRev,
      spellStateRev: restedCharacter.spellStateRev ?? prev.spellStateRev,
      deathSaves: nextDeathSaves,
      overrides: nextOverrides,
      conditions: nextConditions,
      characterData: {
        ...prev.characterData,
        hitDiceSpent: {},
        exhaustion: recovery.exhaustion,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
        concentrationSpell: null,
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
      patchMyCharacter(char.id, "conditions", { conditions: nextConditions, previousConditions: char.conditions ?? [] }),
    ]);
    setChar((prev) => prev ? {
      ...prev,
      hpCurrent,
      overrides: { ...(prev.overrides ?? {}), ...nextOverrides },
      conditions: nextConditions,
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
      const updated = await patchMyCharacter<{ spellStateRev?: string }>(char.id, "conditions", { conditions: next, previousConditions: current });
      setChar((prev) => prev ? {
        ...prev,
        conditions: next,
        spellStateRev: updated.spellStateRev ?? prev.spellStateRev,
        characterData: { ...(prev.characterData ?? {}), ...characterPatch },
      } : prev);
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
