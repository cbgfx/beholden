import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { rollDiceExpr } from "@/lib/dice";
import { collectSpellChoicesFromEffects, parseFeatureEffects } from "@/domain/character/parseFeatureEffects";
import { buildPreparedSpellProgressionChoiceDefinitions, buildPreparedSpellProgressionGrants } from "@/domain/character/characterFeatures";
import { abilityMod, formatModifier, normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import {
  getCantripCount,
  getClassExpertiseChoices,
  getClassFeatureTable,
  getFeatChoiceOptions,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSlotLevelTriggeredSpellChoices,
  getSpellcastingClassName,
  getSubclassLevel,
  getSubclassList,
  featureMatchesSubclass,
  isSubclassChoiceFeature,
  isSpellcaster,
  tableValueAtLevel,
  normalizeChoiceKey,
  usesFlexiblePreparedSpells,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  buildGrowthChoiceItemOptions,
  getGrowthChoiceDefinitions,
  getGrowthChoiceSelectedAbility,
  sanitizeGrowthChoiceSelections,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  buildResolvedSpellChoiceEntry,
  buildSpellListChoiceEntry,
  loadSpellChoiceOptions,
  resolveSelectedSpellOptionEntries,
  sanitizeSpellChoiceSelections,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import type {
  AsiMode,
  HpChoice,
  LevelUpCharacter as Character,
  LevelUpClassDetail as ClassDetail,
  LevelUpFeatDetail as FeatDetail,
  LevelUpFeatSummary as FeatSummary,
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellListChoiceEntry,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";
import { BackBtn, ChoiceBtn, ExpertiseSelectionSection, FeatSelectionSection, Section, Wrap } from "@/views/level-up/LevelUpParts";
import { LevelUpSpellChoiceList } from "@/views/level-up/LevelUpSpellChoiceList";
import { LevelUpItemChoiceList } from "@/views/level-up/LevelUpItemChoiceList";
import { buildLevelUpPayload, deriveAllowedInvocationIds, deriveFeatAbilityBonuses, deriveHpGain, deriveLevelUpValidation, derivePreviewScores } from "@/views/level-up/LevelUpUtils";
import { cleanFeatureText, hasKeys, mergeAutoLevels, reconcileSelectedSpellIds, sameSelectionMap, sameSpellChoiceOptionMap, stripRulesetSuffix } from "@/views/level-up/LevelUpHelpers";
import { LEVEL_LABELS } from "@/views/character/CharacterSpellShared";
import { ABILITY_KEYS, ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { isToughFeat } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { ItemSummary } from "@/views/character-creator/utils/CharacterCreatorTypes";
import { titleCase } from "@/lib/format/titleCase";

function normalizeCompendiumClassLookupName(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function LevelUpView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [char, setChar] = useState<Character | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // HP
  const [hpChoice, setHpChoice] = useState<HpChoice>(null);
  const [rolledHp, setRolledHp] = useState<number | null>(null);
  const [manualHp, setManualHp] = useState<string>("");

  // ASI
  const [asiMode, setAsiMode] = useState<AsiMode>(null);
  const [asiStats, setAsiStats] = useState<Record<string, number>>({});

  // Feature expand
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [subclass, setSubclass] = useState<string>("");
  const [chosenCantrips, setChosenCantrips] = useState<string[]>([]);
  const [chosenSpells, setChosenSpells] = useState<string[]>([]);
  const [chosenInvocations, setChosenInvocations] = useState<string[]>([]);
  const [chosenExpertise, setChosenExpertise] = useState<Record<string, string[]>>({});
  const [featSummaries, setFeatSummaries] = useState<FeatSummary[]>([]);
  const [featSearch, setFeatSearch] = useState("");
  const [chosenFeatId, setChosenFeatId] = useState<string>("");
  const [chosenFeatDetail, setChosenFeatDetail] = useState<FeatDetail | null>(null);
  const [chosenFeatOptions, setChosenFeatOptions] = useState<Record<string, string[]>>({});
  const [chosenFeatureChoices, setChosenFeatureChoices] = useState<Record<string, string[]>>({});
  const [featSpellChoiceOptions, setFeatSpellChoiceOptions] = useState<Record<string, SpellSummary[]>>({});
  const [classFeatureSpellChoiceOptions, setClassFeatureSpellChoiceOptions] = useState<Record<string, SpellSummary[]>>({});
  const [invocationSpellChoiceOptions, setInvocationSpellChoiceOptions] = useState<Record<string, SpellSummary[]>>({});
  const [growthOptionEntriesByKey, setGrowthOptionEntriesByKey] = useState<Record<string, Array<{ id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>>>({});
  const [classCantrips, setClassCantrips] = useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = useState<SpellSummary[]>([]);
  const [items, setItems] = useState<ItemSummary[]>([]);
  const nextLevel = (char?.level ?? 0) + 1;
  const mergedAutolevels = React.useMemo(() => mergeAutoLevels(classDetail), [classDetail]);

  // -------------------------------------------------------------------------
  // Load character + class
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then((c) => {
        setChar(c);
        setSubclass(String(c.characterData?.subclass ?? ""));
        setChosenCantrips(c.characterData?.chosenCantrips ?? []);
        setChosenSpells(c.characterData?.chosenSpells ?? []);
        setChosenInvocations(c.characterData?.chosenInvocations ?? []);
        setChosenFeatureChoices((c.characterData?.chosenFeatureChoices ?? {}) as Record<string, string[]>);
        const existingFeatOptions = (c.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>;
        setChosenExpertise(
          Object.fromEntries(
            Object.entries(existingFeatOptions).filter(([key]) => key.startsWith("classexpertise:"))
          )
        );
        const classId = c.characterData?.classId;
        if (classId) {
          return api<ClassDetail>(`/api/compendium/classes/${classId}`);
        }
        if (c.className) {
          return api<Array<{ id: string; name: string }>>(`/api/compendium/classes`)
            .then((classes) => {
              const target = normalizeCompendiumClassLookupName(c.className);
              const match = classes.find((entry) => normalizeCompendiumClassLookupName(entry.name) === target);
              return match ? api<ClassDetail>(`/api/compendium/classes/${match.id}`) : null;
            });
        }
        return null;
      })
      .then((cd) => { if (cd) setClassDetail(cd); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!classDetail) {
      setClassCantrips([]);
      setClassSpells([]);
      setClassInvocations([]);
      return;
    }
    const spellcastingClassName = getSpellcastingClassName(classDetail, nextLevel, subclass) ?? classDetail.name;
    const name = encodeURIComponent(spellcastingClassName);
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=200`).then(setClassCantrips).catch(() => setClassCantrips([]));
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=300`).then(setClassSpells).catch(() => setClassSpells([]));
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=200").then(setClassInvocations).catch(() => setClassInvocations([]));
    } else {
      setClassInvocations([]);
    }
  }, [classDetail, nextLevel, subclass]);

  useEffect(() => {
    api<FeatSummary[]>("/api/compendium/feats").then(setFeatSummaries).catch(() => setFeatSummaries([]));
  }, []);

  useEffect(() => {
    api<ItemSummary[]>("/api/compendium/items").then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    if (!chosenFeatId) {
      setChosenFeatDetail(null);
      return;
    }
    api<FeatDetail>(`/api/compendium/feats/${encodeURIComponent(chosenFeatId)}`)
      .then((feat) => setChosenFeatDetail(feat))
      .catch(() => setChosenFeatDetail(null));
  }, [chosenFeatId]);

  const hd = classDetail?.hd ?? 8;
  const conScore = char?.conScore ?? 10;
  const conMod = abilityMod(conScore);
  const hpAverage = Math.floor(hd / 2) + 1 + conMod;
  const hpRollMax = hd + conMod;

  const autoLevel = React.useMemo(
    () => mergedAutolevels.find((al) => al.level === nextLevel) ?? null,
    [mergedAutolevels, nextLevel]
  );
  const hasAsiFeature = Boolean(
    autoLevel?.features?.some((feature) => /ability score improvement/i.test(feature.name))
  );
  const usesFlexiblePreparedSpellsModel = usesFlexiblePreparedSpells(classDetail);
  const newFeatures = React.useMemo(
    () => autoLevel?.features.filter((f) =>
      !f.optional
      || (
        Boolean(subclass)
        && /\(([^()]+)\)\s*$/.test(f.name)
        && new RegExp(`\\(${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i").test(f.name)
      )
    ) ?? [],
    [autoLevel, subclass]
  );
  const isAsiLevel = Boolean(autoLevel?.scoreImprovement ?? hasAsiFeature);
  const newSlots = autoLevel?.slots ?? null;
  const subclassLevel = classDetail ? getSubclassLevel(classDetail) : null;
  const subclassOptions = classDetail ? getSubclassList(classDetail) : [];
  const showSubclassChoice = Boolean(subclassLevel && nextLevel === subclassLevel && subclassOptions.length > 0);
  const needsSubclassChoice = Boolean(subclassLevel && nextLevel >= subclassLevel && subclassOptions.length > 0 && !subclass.trim());
  const subclassOverview = React.useMemo(() => {
    if (!classDetail || !subclass.trim()) return null;
    const className = stripRulesetSuffix(classDetail.name);
    const subclassPattern = new RegExp(`^${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Subclass:\\s+${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    for (const autolevel of mergedAutolevels) {
      const feature = autolevel.features.find((entry) => subclassPattern.test(entry.name));
      if (feature) return feature;
    }
    return null;
  }, [classDetail, mergedAutolevels, subclass]);
  const selectedSubclassFeatures = React.useMemo(() => {
    if (!autoLevel || !subclass.trim()) return [];
    const subclassSuffix = new RegExp(`\\(${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i");
    return autoLevel.features.filter((feature) => subclassSuffix.test(feature.name));
  }, [autoLevel, subclass]);
  const cantripCount = classDetail ? getCantripCount(classDetail, nextLevel, subclass) : 0;
  const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", nextLevel, subclass) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, nextLevel) : 0;
  const prepCount = classDetail ? getPreparedSpellCount(classDetail, nextLevel, subclass) : 0;
  const maxSpellLevel = classDetail ? getMaxSlotLevel(classDetail, nextLevel, subclass) : 0;
  const spellcaster = classDetail ? isSpellcaster(classDetail, nextLevel, subclass) : false;
  const expertiseChoices = React.useMemo(
    () => (classDetail ? getClassExpertiseChoices(classDetail, nextLevel).filter((choice) => choice.key.startsWith(`classexpertise:${nextLevel}:`)) : []),
    [classDetail, nextLevel]
  );
  const _cp = char?.characterData?.proficiencies;
  const _arr = (v: unknown) => Array.isArray(v) ? v : [];
  const charProficiencies: ProficiencyMap = {
    skills: _arr(_cp?.skills), expertise: _arr(_cp?.expertise), saves: _arr(_cp?.saves),
    tools: _arr(_cp?.tools), languages: _arr(_cp?.languages), armor: _arr(_cp?.armor),
    weapons: _arr(_cp?.weapons), spells: _arr(_cp?.spells), invocations: _arr(_cp?.invocations),
    masteries: _arr(_cp?.masteries), maneuvers: _arr(_cp?.maneuvers), plans: _arr(_cp?.plans),
  };
  const proficientSkills = Array.isArray(charProficiencies?.skills)
    ? charProficiencies.skills
      .map((entry) => typeof entry === "string" ? entry : entry?.name)
      .filter((entry): entry is string => Boolean(entry))
    : [];
  const existingExpertise = Array.isArray(charProficiencies?.expertise)
    ? charProficiencies.expertise
      .map((entry) => typeof entry === "string" ? entry : entry?.name)
      .filter((entry): entry is string => Boolean(entry))
    : [];
  const existingClassSpellNames = React.useMemo(
    () => Array.isArray(char?.characterData?.proficiencies?.spells)
      ? char.characterData.proficiencies.spells
        .filter((entry) => entry.source === (classDetail?.name ?? char.className))
        .map((entry) => entry.name)
      : [],
    [char?.characterData?.proficiencies?.spells, char?.className, classDetail?.name]
  );
  const existingClassInvocationNames = React.useMemo(
    () => Array.isArray(char?.characterData?.proficiencies?.invocations)
      ? char.characterData.proficiencies.invocations
        .filter((entry) => entry.source === (classDetail?.name ?? char.className))
        .map((entry) => entry.name)
      : [],
    [char?.characterData?.proficiencies?.invocations, char?.className, classDetail?.name]
  );
  const featChoiceEntries = React.useMemo(
    () => (chosenFeatDetail?.parsed.choices ?? []).filter((choice) => choice.type !== "damage_type"),
    [chosenFeatDetail]
  );
  const featSourceLabel = chosenFeatDetail ? `${chosenFeatDetail.name} (Level ${nextLevel})` : "";
  const featSpellListChoices = React.useMemo<LevelUpSpellListChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell_list")
        .map((choice) => {
          const entry = buildSpellListChoiceEntry({
            key: `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`,
            choice: { ...choice, options: getFeatChoiceOptions(choice) },
            level: nextLevel,
            sourceLabel: featSourceLabel,
          });
          return {
            ...entry,
            title: "Spell List",
            note: entry.options.length === 1
              ? (choice.note ?? "Spell list fixed by this feat.")
              : choice.note,
          };
        });
    },
    [chosenFeatDetail, featChoiceEntries, featSourceLabel, nextLevel]
  );
  const featResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell")
        .map((choice) => {
          const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
          const linkedChoiceKey = choice.linkedTo ? `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.linkedTo}` : null;
          return {
            ...buildResolvedSpellChoiceEntry({
              key,
              choice,
              level: nextLevel,
              sourceLabel: chosenFeatDetail.name,
              chosenOptions: chosenFeatOptions,
              linkedChoiceKey,
            }),
          };
        });
    },
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const parsedNewFeatureEffects = React.useMemo(
    () => newFeatures.map((feature, index) =>
      parseFeatureEffects({
        source: {
          id: `levelup:${nextLevel}:${index}:${feature.name}`,
          kind: /\(/.test(feature.name) ? "subclass" : "class",
          name: feature.name,
          text: feature.text,
          level: nextLevel,
        },
        text: feature.text,
      })
    ),
    [newFeatures, nextLevel]
  );
  const slotLevelTriggeredSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () =>
      getSlotLevelTriggeredSpellChoices(
        classDetail,
        Math.max(0, nextLevel - 1),
        nextLevel,
        subclass || char?.characterData?.subclass || null,
      ).map((choice) => ({
        key: `levelupslotgrowth:${nextLevel}:${choice.key}`,
        title: choice.title,
        sourceLabel: choice.sourceLabel,
        count: choice.count,
        level: choice.level,
        note: choice.note ?? null,
        linkedTo: null,
        listNames: choice.listNames,
        schools: choice.schools,
        ritualOnly: false,
      })),
    [char?.characterData?.subclass, classDetail, nextLevel, subclass]
  );
  const classFeatureResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => [
      ...collectSpellChoicesFromEffects(parsedNewFeatureEffects)
        .filter((choice) => !/^(level\s+\d+:\s+)?(spellcasting|pact magic)\b/i.test(choice.source.name))
        .map((choice) => ({
          key: `levelupclassfeature:${nextLevel}:${choice.id}`,
          title: choice.source.name,
          sourceLabel: choice.source.name,
          count: choice.count.kind === "fixed" ? choice.count.value : 0,
          level: choice.level,
          note: choice.note ?? null,
          linkedTo: null,
          listNames: choice.spellLists,
          schools: choice.schools,
          ritualOnly: false,
        })),
      ...slotLevelTriggeredSpellChoices,
    ],
    [nextLevel, parsedNewFeatureEffects, slotLevelTriggeredSpellChoices]
  );
  const growthChoiceDefinitions = React.useMemo(
    () => getGrowthChoiceDefinitions({
      classId: String(char?.characterData?.classId ?? ""),
      className: classDetail?.name ?? char?.className ?? null,
      classDetail,
      level: nextLevel,
      selectedSubclass: subclass || char?.characterData?.subclass || null,
    }),
    [char?.characterData?.classId, char?.characterData?.subclass, char?.className, classDetail, nextLevel, subclass]
  );
  const appliedPreparedSpellProgressionFeatures = React.useMemo(
    () =>
      (classDetail?.autolevels ?? [])
        .filter((autolevel) => autolevel.level != null && autolevel.level <= nextLevel)
        .flatMap((autolevel) =>
          (autolevel.features ?? [])
            .filter((feature) =>
              featureMatchesSubclass(feature, subclass || char?.characterData?.subclass || null)
              && !isSubclassChoiceFeature(feature)
            )
            .map((feature) => ({
              id: `class:${String(char?.characterData?.classId ?? "")}:${String(feature.name ?? "").trim()}`,
              name: String(feature.name ?? "").trim(),
              text: String(feature.text ?? ""),
              preparedSpellProgression: feature.preparedSpellProgression,
            }))
        ),
    [char?.characterData?.classId, char?.characterData?.subclass, classDetail?.autolevels, nextLevel, subclass]
  );
  const preparedSpellProgressionChoiceDefinitions = React.useMemo(
    () => buildPreparedSpellProgressionChoiceDefinitions(appliedPreparedSpellProgressionFeatures),
    [appliedPreparedSpellProgressionFeatures]
  );
  const preparedSpellProgressionGrantedKeys = React.useMemo(
    () => new Set(
      buildPreparedSpellProgressionGrants(
        appliedPreparedSpellProgressionFeatures,
        nextLevel,
        chosenFeatureChoices,
      ).map((entry) => normalizeSpellTrackingKey(entry.spellName))
    ),
    [appliedPreparedSpellProgressionFeatures, chosenFeatureChoices, nextLevel]
  );
  const selectedInvocationEffects = React.useMemo(
    () => classInvocations
      .filter((invocation) => chosenInvocations.includes(invocation.id) && String(invocation.text ?? "").trim())
      .map((invocation) => parseFeatureEffects({
        source: {
          id: `levelupinvocation:${nextLevel}:${invocation.id}`,
          kind: "invocation",
          name: invocation.name,
          parentName: classDetail?.name ?? char?.className ?? null,
          text: invocation.text ?? "",
        },
        text: invocation.text ?? "",
      })),
    [char?.className, chosenInvocations, classDetail?.name, classInvocations, nextLevel]
  );
  const invocationResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => collectSpellChoicesFromEffects(selectedInvocationEffects).flatMap((choice) => {
      if (choice.count.kind !== "fixed") return [];
      return [{
        key: `invocation:${choice.id}`,
        title: choice.source.name,
        sourceLabel: choice.source.name,
        count: choice.count.value,
        level: choice.level,
        note: choice.note ?? choice.summary ?? null,
        linkedTo: null,
        listNames: choice.spellLists,
        schools: choice.schools,
        ritualOnly: /\britual tag\b/i.test(choice.note ?? ""),
      }];
    }),
    [selectedInvocationEffects]
  );
  const allowedInvocationIds = React.useMemo(
    () => deriveAllowedInvocationIds({ classCantrips, classInvocations, chosenCantrips, chosenInvocations, nextLevel }),
    [chosenCantrips, chosenInvocations, classCantrips, classInvocations, nextLevel]
  );

  useEffect(() => {
    setChosenCantrips((prev) => {
      const next = reconcileSelectedSpellIds(prev, classCantrips, existingClassSpellNames).slice(0, cantripCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classCantrips, cantripCount, existingClassSpellNames]);

  useEffect(() => {
    if (maxSpellLevel === 0) return;
    setChosenSpells((prev) => {
      const next = reconcileSelectedSpellIds(prev, classSpells, existingClassSpellNames)
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel;
        })
        .slice(0, prepCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classSpells, existingClassSpellNames, maxSpellLevel, prepCount]);

  useEffect(() => {
    setChosenInvocations((prev) => {
      const next = reconcileSelectedSpellIds(prev, classInvocations, existingClassInvocationNames)
        .filter((id) => allowedInvocationIds.has(id))
        .slice(0, invocCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [allowedInvocationIds, classInvocations, existingClassInvocationNames, invocCount]);

  useEffect(() => {
    if (expertiseChoices.length === 0) return;
    setChosenExpertise((prev) => {
      let changed = false;
      const next: Record<string, string[]> = { ...prev };
      const taken = new Set(existingExpertise.map((name) => normalizeChoiceKey(name)));
      const proficientSkillKeys = new Set(proficientSkills.map((skill) => normalizeChoiceKey(skill)));
      const existingExpertiseEntries = Array.isArray(char?.characterData?.proficiencies?.expertise)
        ? char.characterData.proficiencies.expertise
        : [];
      for (const choice of expertiseChoices) {
        const options = (choice.options ?? proficientSkills).filter((skill) => proficientSkillKeys.has(normalizeChoiceKey(skill)));
        const current = prev[choice.key] ?? [];
        const seededCurrent = current.length > 0
          ? current
          : existingExpertiseEntries
            .filter((entry) => typeof entry !== "string" && entry?.source === choice.source)
            .map((entry) => entry.name)
            .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
            .slice(0, choice.count);
        const filtered = current
          .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
          .filter((skill) => !taken.has(normalizeChoiceKey(skill)))
          .slice(0, choice.count);
        const finalSelection = filtered.length > 0 ? filtered : seededCurrent;
        finalSelection.forEach((skill) => taken.add(normalizeChoiceKey(skill)));
        if (finalSelection.length === 0) delete next[choice.key];
        else next[choice.key] = finalSelection;
        if (finalSelection.length !== current.length || finalSelection.some((skill, index) => skill !== current[index])) changed = true;
      }
      return changed ? next : prev;
    });
  }, [char?.characterData?.proficiencies?.expertise, expertiseChoices, proficientSkills, existingExpertise]);

  useEffect(() => {
    if (!chosenFeatDetail) {
      setChosenFeatOptions((prev) => hasKeys(prev) ? {} : prev);
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
  }, [chosenFeatDetail]);

  useEffect(() => {
    if (!chosenFeatDetail) {
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    let alive = true;
    if (featResolvedSpellChoices.length === 0) {
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(featResolvedSpellChoices, (query) => api<SpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setFeatSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [chosenFeatDetail, featResolvedSpellChoices]);

  useEffect(() => {
    let alive = true;
    if (classFeatureResolvedSpellChoices.length === 0) {
      setClassFeatureSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(classFeatureResolvedSpellChoices, (query) => api<SpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setClassFeatureSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setClassFeatureSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [classFeatureResolvedSpellChoices]);

  useEffect(() => {
    let alive = true;
    if (invocationResolvedSpellChoices.length === 0) {
      setInvocationSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(invocationResolvedSpellChoices, (query) => api<SpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setInvocationSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setInvocationSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [invocationResolvedSpellChoices]);

  useEffect(() => {
    const spellBackedDefinitions = growthChoiceDefinitions.filter((definition) => definition.spellChoice);
    let alive = true;
    if (growthChoiceDefinitions.length === 0) {
      setGrowthOptionEntriesByKey((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    const itemBacked = Object.fromEntries(
      growthChoiceDefinitions
        .filter((definition) => definition.category === "plan")
        .map((definition) => [definition.key, buildGrowthChoiceItemOptions(definition, items)])
    );
    if (spellBackedDefinitions.length === 0) {
      setGrowthOptionEntriesByKey((prev) => sameSpellChoiceOptionMap(prev, itemBacked) ? prev : itemBacked);
      return;
    }
    loadSpellChoiceOptions(spellBackedDefinitions.map((definition) => definition.spellChoice!).filter(Boolean), (query) => api<SpellSummary[]>(query)).then((optionsByKey) => {
      const next = { ...optionsByKey, ...itemBacked };
      if (alive) setGrowthOptionEntriesByKey((prev) => sameSpellChoiceOptionMap(prev, next) ? prev : next);
    }).catch(() => {
      if (alive) setGrowthOptionEntriesByKey((prev) => sameSpellChoiceOptionMap(prev, itemBacked) ? prev : itemBacked);
    });
    return () => { alive = false; };
  }, [growthChoiceDefinitions, items]);

  const featChoiceOptionsByKey = React.useMemo(() => {
    const entries: Array<[string, string[]]> = [];
    for (const choice of featChoiceEntries) {
      const key = `levelupfeat:${nextLevel}:${chosenFeatDetail?.id ?? ""}:${choice.id}`;
      if (choice.type === "spell") {
        const spellOptions = featSpellChoiceOptions[key] ?? [];
        const resolved = spellOptions.length > 0
          ? spellOptions.map((spell) => spell.name)
          : getFeatChoiceOptions(choice);
        entries.push([key, resolved]);
      } else {
        entries.push([key, getFeatChoiceOptions(choice)]);
      }
    }
    return Object.fromEntries(entries);
  }, [chosenFeatDetail?.id, featChoiceEntries, featSpellChoiceOptions, nextLevel]);

  useEffect(() => {
    if (!chosenFeatDetail) return;
    setChosenFeatOptions((prev) => {
      const next = { ...prev };
      for (const choice of chosenFeatDetail.parsed.choices) {
        const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
        if (choice.type === "spell" || choice.type === "spell_list") continue;
        const options = featChoiceOptionsByKey[key] ?? [];
        const filtered = (prev[key] ?? [])
          .filter((value) => options.includes(value))
          .slice(0, choice.count);
        if (filtered.length === 0) delete next[key];
        else next[key] = filtered;
      }
      const sanitized = sanitizeSpellChoiceSelections({
        currentSelections: next,
        spellListChoices: featSpellListChoices,
        resolvedSpellChoices: featResolvedSpellChoices,
        spellOptionsByKey: featSpellChoiceOptions,
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [chosenFeatDetail, featChoiceEntries, featChoiceOptionsByKey, featResolvedSpellChoices, featSpellChoiceOptions, featSpellListChoices, nextLevel]);

  useEffect(() => {
    setChosenFeatOptions((prev) => {
      const sanitized = sanitizeSpellChoiceSelections({
        currentSelections: prev,
        spellListChoices: [],
        resolvedSpellChoices: [...classFeatureResolvedSpellChoices, ...invocationResolvedSpellChoices],
        spellOptionsByKey: {
          ...classFeatureSpellChoiceOptions,
          ...invocationSpellChoiceOptions,
        },
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [classFeatureResolvedSpellChoices, classFeatureSpellChoiceOptions, invocationResolvedSpellChoices, invocationSpellChoiceOptions]);

  useEffect(() => {
    setChosenFeatureChoices((prev) => {
      const sanitized = sanitizeGrowthChoiceSelections({
        definitions: growthChoiceDefinitions,
        currentSelections: prev,
        optionEntriesByKey: growthOptionEntriesByKey,
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [growthChoiceDefinitions, growthOptionEntriesByKey]);

  useEffect(() => {
    setChosenFeatureChoices((prev) => {
      const next = { ...prev };
      const validKeys = new Set(preparedSpellProgressionChoiceDefinitions.map((definition) => definition.key));
      for (const definition of preparedSpellProgressionChoiceDefinitions) {
        const filtered = (next[definition.key] ?? [])
          .filter((value) => definition.options.includes(value))
          .slice(0, 1);
        if (filtered.length > 0) next[definition.key] = filtered;
        else delete next[definition.key];
      }
      for (const key of Object.keys(next)) {
        if (key.includes(":prepared-spell-progression:") && !validKeys.has(key)) delete next[key];
      }
      return sameSelectionMap(prev, next) ? prev : next;
    });
  }, [preparedSpellProgressionChoiceDefinitions]);

  const hpGain = deriveHpGain(hpChoice, hpAverage, rolledHp, manualHp);
  const featAbilityBonuses = React.useMemo(
    () => deriveFeatAbilityBonuses({ chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel }),
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const featHpBonus = asiMode === "feat" && isToughFeat(chosenFeatDetail?.name) ? nextLevel * 2 : 0;

  // Current scores + ASI deltas
  const baseScores: Record<string, number> = {
    str: char?.strScore ?? 10, dex: char?.dexScore ?? 10, con: char?.conScore ?? 10,
    int: char?.intScore ?? 10, wis: char?.wisScore ?? 10, cha: char?.chaScore ?? 10,
  };
  const previewScores = React.useMemo(
    () => derivePreviewScores({ baseScores, asiStats, asiMode, featAbilityBonuses }),
    [baseScores, asiStats, asiMode, featAbilityBonuses]
  );
  const lockedCantripSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenCantrips ?? [], classCantrips, existingClassSpellNames)
        .filter((id) => {
          const spell = classCantrips.find((entry) => entry.id === id);
          return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : false;
        })
        .slice(0, cantripCount),
    [char?.characterData?.chosenCantrips, cantripCount, classCantrips, existingClassSpellNames, preparedSpellProgressionGrantedKeys]
  );
  const lockedCantripIds = React.useMemo(
    () => new Set(lockedCantripSelectionIds),
    [lockedCantripSelectionIds]
  );
  const lockedSpellSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenSpells ?? [], classSpells, existingClassSpellNames)
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell)
            && spellLevel > 0
            && spellLevel <= maxSpellLevel
            && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name));
        })
        .slice(0, prepCount),
    [char?.characterData?.chosenSpells, classSpells, existingClassSpellNames, maxSpellLevel, prepCount, preparedSpellProgressionGrantedKeys]
  );
  const lockedSpellIds = React.useMemo(
    () => new Set(lockedSpellSelectionIds),
    [lockedSpellSelectionIds]
  );
  const lockedInvocationSelectionIds = React.useMemo(
    () =>
      reconcileSelectedSpellIds(char?.characterData?.chosenInvocations ?? [], classInvocations, existingClassInvocationNames)
        .filter((id) => allowedInvocationIds.has(id))
        .slice(0, invocCount),
    [allowedInvocationIds, char?.characterData?.chosenInvocations, classInvocations, existingClassInvocationNames, invocCount]
  );
  const lockedInvocationIds = React.useMemo(
    () => new Set(lockedInvocationSelectionIds),
    [lockedInvocationSelectionIds]
  );
  const maneuverChoiceEntries = React.useMemo(
    () => growthChoiceDefinitions
      .filter((definition) => definition.category === "maneuver")
      .map((definition) => {
        const existingCount = Array.isArray(char?.characterData?.chosenFeatureChoices?.[definition.key])
          ? (char?.characterData?.chosenFeatureChoices?.[definition.key] ?? []).length
          : 0;
        const chosenEntries = resolveSelectedSpellOptionEntries(
          chosenFeatureChoices[definition.key] ?? [],
          growthOptionEntriesByKey[definition.key] ?? []
        );
        return {
          definition,
          remainingCount: Math.max(0, definition.totalCount - existingCount),
          chosen: chosenEntries.map((spell) => String(spell.id)),
          chosenEntries,
          selectedAbility: getGrowthChoiceSelectedAbility(chosenFeatureChoices, definition),
        };
      })
      .filter((entry) => entry.remainingCount > 0 || entry.chosen.length > 0 || entry.definition.abilityChoice),
    [char?.characterData?.chosenFeatureChoices, chosenFeatureChoices, growthChoiceDefinitions, growthOptionEntriesByKey]
  );
  const planChoiceEntries = React.useMemo(
    () => growthChoiceDefinitions
      .filter((definition) => definition.category === "plan")
      .map((definition) => {
        const existingCount = Array.isArray(char?.characterData?.chosenFeatureChoices?.[definition.key])
          ? (char?.characterData?.chosenFeatureChoices?.[definition.key] ?? []).length
          : 0;
        return {
          definition,
          remainingCount: Math.max(0, definition.totalCount - existingCount),
          chosen: (chosenFeatureChoices[definition.key] ?? []).map(String),
          disabledIds: growthChoiceDefinitions
            .filter((other) => other.category === "plan" && other.key !== definition.key)
            .flatMap((other) => [
              ...(((char?.characterData?.chosenFeatureChoices?.[other.key] ?? []) as string[]).map(String)),
              ...((chosenFeatureChoices[other.key] ?? []).map(String)),
            ]),
        };
      })
      .filter((entry) => entry.remainingCount > 0 || entry.chosen.length > 0),
    [char?.characterData?.chosenFeatureChoices, chosenFeatureChoices, growthChoiceDefinitions]
  );
  const progressionTableChoiceEntries = React.useMemo(
    () => preparedSpellProgressionChoiceDefinitions.map((definition) => ({
      definition,
      chosen: chosenFeatureChoices[definition.key] ?? [],
    })),
    [chosenFeatureChoices, preparedSpellProgressionChoiceDefinitions]
  );
  const extraFeatSpellSelectionsValid = React.useMemo(
    () =>
      featSpellListChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && featResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && classFeatureResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && invocationResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && maneuverChoiceEntries.every((entry) => entry.chosen.length === entry.definition.totalCount)
      && planChoiceEntries.every((entry) => entry.chosen.length === entry.definition.totalCount)
      && maneuverChoiceEntries.every((entry) => !entry.definition.abilityChoice || entry.selectedAbility !== null)
      && progressionTableChoiceEntries.every((entry) => entry.chosen.length === 1),
    [chosenFeatOptions, classFeatureResolvedSpellChoices, featResolvedSpellChoices, featSpellListChoices, invocationResolvedSpellChoices, maneuverChoiceEntries, planChoiceEntries, progressionTableChoiceEntries]
  );

  const cantripChoiceCount = Math.max(0, cantripCount - lockedCantripIds.size);
  const spellChoiceCount = Math.max(0, prepCount - lockedSpellIds.size);
  const invocationChoiceCount = Math.max(0, invocCount - lockedInvocationIds.size);
  const displayedChosenCantrips = chosenCantrips.filter((id) => {
    if (lockedCantripIds.has(id)) return false;
    const spell = classCantrips.find((entry) => entry.id === id);
    return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : true;
  });
  const displayedChosenSpells = chosenSpells.filter((id) => {
    if (lockedSpellIds.has(id)) return false;
    const spell = classSpells.find((entry) => entry.id === id);
    return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : true;
  });
  const displayedChosenInvocations = chosenInvocations.filter((id) => !lockedInvocationIds.has(id));
  const effectiveChosenCantrips = React.useMemo(
    () => [...lockedCantripSelectionIds, ...displayedChosenCantrips],
    [displayedChosenCantrips, lockedCantripSelectionIds]
  );
  const effectiveChosenSpells = React.useMemo(
    () => [...lockedSpellSelectionIds, ...displayedChosenSpells],
    [displayedChosenSpells, lockedSpellSelectionIds]
  );
  const effectiveChosenInvocations = React.useMemo(
    () => [...lockedInvocationSelectionIds, ...displayedChosenInvocations],
    [displayedChosenInvocations, lockedInvocationSelectionIds]
  );

  const { filteredFeatSummaries, featPrereqsMet, featRepeatableValid, asiTotal, canConfirm } = React.useMemo(
    () =>
      deriveLevelUpValidation({
        isAsiLevel,
        asiMode,
        asiStats,
        needsSubclassChoice,
        subclass,
        cantripCount,
        chosenCantrips: effectiveChosenCantrips,
        spellcaster,
        prepCount,
        chosenSpells: effectiveChosenSpells,
        invocCount,
        chosenInvocations: effectiveChosenInvocations,
        expertiseChoices,
        chosenExpertise,
        chosenFeatDetail,
        featChoiceEntries,
        chosenFeatOptions,
        nextLevel,
        className: classDetail?.name ?? char?.className,
        level: nextLevel,
        scores: baseScores,
        prof: charProficiencies,
        featSearch,
        featSummaries,
        hpGain,
        existingLevelUpFeats: char?.characterData?.chosenLevelUpFeats ?? [],
      }),
    [
      isAsiLevel,
      asiMode,
      asiStats,
      needsSubclassChoice,
      subclass,
      cantripCount,
      effectiveChosenCantrips,
      spellcaster,
      prepCount,
      effectiveChosenSpells,
      invocCount,
      effectiveChosenInvocations,
      expertiseChoices,
      chosenExpertise,
      chosenFeatDetail,
      featChoiceEntries,
      chosenFeatOptions,
      nextLevel,
      classDetail?.name,
      char?.className,
      char?.characterData?.proficiencies,
      featSearch,
      featSummaries,
      hpGain,
    ]
  );

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;
  if (nextLevel > 20) {
    return (
      <Wrap>
        <p style={{ color: C.muted }}>Already at max level (20).</p>
        <BackBtn onClick={() => navigate(`/characters/${char.id}`)} />
      </Wrap>
    );
  }

  const availableCantripChoices = classCantrips.filter((spell) =>
    !lockedCantripIds.has(spell.id)
    && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name))
  );
  const availableSpellChoices = classSpells.filter((spell) =>
    !lockedSpellIds.has(spell.id)
    && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name))
    && Number(spell.level ?? 0) > 0
    && Number(spell.level ?? 0) <= maxSpellLevel
  );
  const availableInvocationChoices = classInvocations.filter(
    (invocation) => !lockedInvocationIds.has(invocation.id) && allowedInvocationIds.has(invocation.id)
  );

  function rollHp() {
    const rolled = rollDiceExpr(`1d${hd}`);
    const total = Math.max(1, rolled + conMod);
    setRolledHp(total);
    setHpChoice("roll");
  }

  function toggleAsiPoint(key: string) {
    if (!asiMode || asiMode === "feat") return;
    setAsiStats((prev) => {
      const current = prev[key] ?? 0;
      const totalAssigned = Object.values(prev).reduce((sum, value) => sum + value, 0);
      const next = { ...prev };
      if (current >= 2) {
        delete next[key];
      } else if (totalAssigned < 2) {
        next[key] = current + 1;
      }
      return next;
    });
  }

  function clearAsi() {
    setAsiStats({});
    setAsiMode(null);
  }

  function toggleSelection(id: string, chosen: string[], setChosen: React.Dispatch<React.SetStateAction<string[]>>, max: number) {
    setChosen((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((entry) => entry !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  }

  async function confirm() {
    if (!char || !canConfirm || !extraFeatSpellSelectionsValid) return;
    setSaving(true);
    try {
      const selectedCantripEntries = classCantrips
        .filter((spell) => effectiveChosenCantrips.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedSpellEntries = classSpells
        .filter((spell) => effectiveChosenSpells.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedClassFeatureSpellEntries = classFeatureResolvedSpellChoices.flatMap((choice) => {
        const selected = resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          classFeatureSpellChoiceOptions[choice.key] ?? [],
        );
        return selected.map((spell) => ({ id: String(spell.id), name: spell.name, source: choice.sourceLabel ?? choice.title }));
      });
      const selectedInvocationSpellEntries = invocationResolvedSpellChoices.flatMap((choice) => {
        const selected = resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          invocationSpellChoiceOptions[choice.key] ?? [],
        );
        return selected.map((spell) => ({ id: String(spell.id), name: spell.name, source: choice.sourceLabel ?? choice.title }));
      });
      const selectedInvocationEntries = classInvocations
        .filter((spell) => effectiveChosenInvocations.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedManeuverEntries = maneuverChoiceEntries.flatMap((entry) =>
        entry.chosenEntries.map((spell) => ({
          id: String(spell.id),
          name: spell.name,
          source: entry.definition.sourceLabel,
          ability: entry.selectedAbility,
          sourceKey: entry.definition.sourceKey,
        }))
      );
      const selectedPlanEntries = planChoiceEntries.flatMap((entry) => {
        const byId = new Map((growthOptionEntriesByKey[entry.definition.key] ?? []).map((item) => [String(item.id), item]));
        return entry.chosen
          .map((id) => byId.get(String(id)))
          .filter((item): item is { id: string; name: string } => Boolean(item))
          .map((item) => ({
            id: String(item.id),
            name: item.name,
            source: entry.definition.sourceLabel,
            sourceKey: entry.definition.sourceKey,
          }));
      });
      const payload = buildLevelUpPayload({
        char,
        nextLevel,
        hpGain: hpGain ?? 0,
        featHpBonus,
        subclass,
        chosenCantrips: effectiveChosenCantrips,
        chosenSpells: effectiveChosenSpells,
        chosenInvocations: effectiveChosenInvocations,
        chosenExpertise,
        chosenFeatOptions,
        chosenFeatureChoices,
        expertiseChoices,
        featChoiceEntries,
        chosenFeatDetail,
        featSourceLabel,
        featSpellChoiceOptions,
        newFeatures,
        classDetailName: classDetail?.name,
        selectedCantripEntries,
        selectedSpellEntries,
        selectedClassFeatureSpellEntries,
        selectedInvocationSpellEntries,
        selectedInvocationEntries,
        selectedManeuverEntries,
        selectedPlanEntries,
        baseScores,
        asiMode,
        asiStats,
        featAbilityBonuses,
      });
      await api(`/api/me/characters/${char.id}`, jsonInit("PUT", payload));
      navigate(`/characters/${char.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const accentColor = C.accentHl;

  return (
    <Wrap>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "var(--fs-title)", padding: 0 }}
        >←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 900, color: C.text }}>{char.name}</h1>
          <div style={{ fontSize: "var(--fs-subtitle)", color: accentColor, fontWeight: 700, marginTop: 2 }}>
            Level {char.level} → <span style={{ color: "#fff" }}>{nextLevel}</span>
            {classDetail && <span style={{ color: C.muted, fontWeight: 400 }}> · {classDetail.name}</span>}
          </div>
        </div>
      </div>

      {/* ── HP gain ── */}
      <Section title={`HP at Level ${nextLevel}`} accent={accentColor}>
        <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 10 }}>
          Hit Die: d{hd} · CON modifier: {formatModifier(conMod)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ChoiceBtn
            active={hpChoice === "average"}
            onClick={() => { setHpChoice("average"); setRolledHp(null); setManualHp(""); }}
          >
            Take average — <strong>+{hpAverage}</strong>
          </ChoiceBtn>
          <ChoiceBtn
            active={hpChoice === "roll"}
            onClick={() => { setManualHp(""); rollHp(); }}
            accent={C.green}
          >
            {hpChoice === "roll" && rolledHp !== null
              ? <>🎲 Rolled — <strong>+{rolledHp}</strong> <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>(click to re-roll)</span></>
              : <>🎲 Roll 1d{hd}</>}
          </ChoiceBtn>
          <ChoiceBtn
            active={hpChoice === "manual"}
            onClick={() => { setHpChoice("manual"); setRolledHp(null); }}
            accent="#f59e0b"
          >
            Manual HP
          </ChoiceBtn>
        </div>
        {hpChoice === "manual" && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={manualHp}
              onChange={(e) => setManualHp(e.target.value)}
              placeholder={`Enter total gained (e.g. ${Math.max(1, 1 + conMod)}-${Math.max(1, hd + conMod)})`}
              style={{
                flex: "0 1 280px",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                color: C.text,
                fontSize: "var(--fs-medium)",
                fontWeight: 700,
                outline: "none",
              }}
            />
            <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
              Enter the final HP gained after applying Constitution.
            </div>
          </div>
        )}
        {hpGain !== null && (
          <div style={{ marginTop: 10, fontSize: "var(--fs-subtitle)", color: C.muted }}>
            New HP max: <span style={{ color: "#fff", fontWeight: 700 }}>{char.hpMax} + {hpGain}{featHpBonus > 0 ? ` + ${featHpBonus}` : ""} = {char.hpMax + hpGain + featHpBonus}</span>
          </div>
        )}
      </Section>

      {/* ── ASI ── */}
      {isAsiLevel && (
        <Section title="Ability Score Improvement" accent={accentColor}>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
            +2 to one ability score, +1 to two different scores, or take a feat.
          </div>

          {/* Mode selection */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(["asi", "feat"] as const).map((m) => (
              <ChoiceBtn
                key={m}
                active={asiMode === m}
                onClick={() => { clearAsi(); setAsiMode(m); }}
              >
                {m === "asi" ? "Improve Abilities" : "Take a Feat"}
              </ChoiceBtn>
            ))}
          </div>

          {asiMode && asiMode !== "feat" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {ABILITY_KEYS.map((k) => {
                const base = baseScores[k] ?? 10;
                const delta = asiStats[k] ?? 0;
                const preview = Math.min(20, base + delta);
                const maxed = base >= 20;
                const selected = delta > 0;
                return (
                  <button
                    key={k}
                    onClick={() => !maxed && toggleAsiPoint(k)}
                    style={{
                      padding: "10px 6px", borderRadius: 8, cursor: maxed ? "default" : "pointer",
                      border: `2px solid ${selected ? accentColor : "rgba(255,255,255,0.1)"}`,
                      background: selected ? `${accentColor}18` : "rgba(255,255,255,0.03)",
                      color: maxed ? C.muted : C.text,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 2 }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ fontSize: "var(--fs-large)", fontWeight: 900 }}>
                      {preview}
                      {selected && <span style={{ fontSize: "var(--fs-small)", color: accentColor }}> +{delta}</span>}
                    </div>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{formatModifier(abilityMod(preview))}</div>
                    {maxed && <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>MAX</div>}
                  </button>
                );
              })}
            </div>
          )}

          {asiMode === "feat" && (
            <FeatSelectionSection
              accentColor={accentColor}
              featSearch={featSearch}
              onFeatSearchChange={setFeatSearch}
              chosenFeatId={chosenFeatId}
              filteredFeatSummaries={filteredFeatSummaries}
              onChooseFeat={(featId) => {
                setChosenFeatId(featId);
                setChosenFeatOptions({});
              }}
              chosenFeatDetail={chosenFeatDetail}
              featPrereqsMet={featPrereqsMet}
              featRepeatableValid={featRepeatableValid}
              featChoiceEntries={featChoiceEntries}
                featChoiceOptionsByKey={featChoiceOptionsByKey}
                chosenFeatOptions={chosenFeatOptions}
                nextLevel={nextLevel}
              onToggleFeatOption={(choiceKey, option, count) => {
                setChosenFeatOptions((prev) => {
                  const current = prev[choiceKey] ?? [];
                  const next = current.includes(option)
                    ? current.filter((entry) => entry !== option)
                    : current.length < count
                      ? [...current, option]
                      : current;
                  return { ...prev, [choiceKey]: next };
                });
              }}
            />
          )}
        </Section>
      )}

      {expertiseChoices.length > 0 && (
        <Section title={`Expertise at Level ${nextLevel}`} accent={accentColor}>
          <ExpertiseSelectionSection
            accentColor={accentColor}
            expertiseChoices={expertiseChoices}
            chosenExpertise={chosenExpertise}
            proficientSkills={proficientSkills}
            existingExpertise={existingExpertise}
            onToggleExpertise={(choiceKey, skill, count) => {
              setChosenExpertise((prev) => {
                const current = prev[choiceKey] ?? [];
                const next = current.includes(skill)
                  ? current.filter((entry) => entry !== skill)
                  : current.length < count
                    ? [...current, skill]
                    : current;
                return { ...prev, [choiceKey]: next };
              });
            }}
          />
        </Section>
      )}

      {showSubclassChoice && (
        <Section title={`Subclass at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
            {subclass.trim() ? "Subclass selected. You can change it before confirming level-up." : "Choose your subclass."}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              {subclassOptions.map((option) => (
                <ChoiceBtn key={option} active={subclass === option} onClick={() => setSubclass(option)}>
                  {option}
                </ChoiceBtn>
              ))}
            </div>
            <div style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              minHeight: 120,
            }}>
              {subclassOverview ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: "#fff", marginBottom: 6 }}>
                      {subclass}
                    </div>
                    <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                      {cleanFeatureText(subclassOverview.text)}
                    </div>
                  </div>
                  {selectedSubclassFeatures.length > 0 && (
                    <div>
                      <div style={{ fontSize: "var(--fs-tiny)", color: accentColor, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                        Features Gained Now
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {selectedSubclassFeatures.map((feature) => (
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
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6 }}>
                  Pick a subclass to see its description and the features you gain at this level.
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {(cantripCount > 0 || prepCount > 0 || invocCount > 0 || featSpellListChoices.length > 0 || featResolvedSpellChoices.length > 0 || classFeatureResolvedSpellChoices.length > 0 || invocationResolvedSpellChoices.length > 0 || maneuverChoiceEntries.length > 0 || planChoiceEntries.length > 0 || progressionTableChoiceEntries.length > 0) && (
        <Section title={`Spell And Feature Choices at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {progressionTableChoiceEntries.map((entry) => (
              <div key={entry.definition.key}>
                <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, marginBottom: 8 }}>
                  {entry.definition.prompt}
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 10 }}>
                  {entry.definition.sourceName}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {entry.definition.options.map((option) => {
                    const active = entry.chosen.includes(option);
                    return (
                      <ChoiceBtn
                        key={option}
                        active={active}
                        onClick={() => {
                          setChosenFeatureChoices((prev) => ({
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
            {cantripChoiceCount > 0 && (
              <LevelUpSpellChoiceList
                title="Cantrips"
                caption={`Choose ${cantripChoiceCount}`}
                spells={availableCantripChoices}
                chosen={displayedChosenCantrips}
                max={cantripChoiceCount}
                onToggle={(id) => toggleSelection(id, displayedChosenCantrips, (updater) => {
                  setChosenCantrips((prev) => {
                    const unlocked = prev.filter((entry) => {
                      if (lockedCantripIds.has(entry)) return false;
                      const spell = classCantrips.find((candidate) => candidate.id === entry);
                      return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : true;
                    });
                    const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                    return [...Array.from(lockedCantripIds), ...nextUnlocked];
                  });
                }, cantripChoiceCount)}
              />
            )}
            {spellcaster && spellChoiceCount > 0 && (
              <LevelUpSpellChoiceList
                title={usesFlexiblePreparedSpellsModel ? "Additional Spells" : "Prepared Spells"}
                caption={`Choose ${spellChoiceCount} (up to level ${maxSpellLevel})`}
                spells={availableSpellChoices}
                chosen={displayedChosenSpells}
                max={spellChoiceCount}
                onToggle={(id) => toggleSelection(id, displayedChosenSpells, (updater) => {
                  setChosenSpells((prev) => {
                    const unlocked = prev.filter((entry) => {
                      if (lockedSpellIds.has(entry)) return false;
                      const spell = classSpells.find((candidate) => candidate.id === entry);
                      return spell ? !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)) : true;
                    });
                    const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                    return [...Array.from(lockedSpellIds), ...nextUnlocked];
                  });
                }, spellChoiceCount)}
              />
            )}
            {spellcaster && prepCount > 0 && usesFlexiblePreparedSpellsModel && spellChoiceCount === 0 && (
              <div style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}>
                <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, marginBottom: 6 }}>
                  Prepared Spells
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6 }}>
                  Your preparation capacity at level {nextLevel} is {prepCount} spell{prepCount === 1 ? "" : "s"} of up to level {maxSpellLevel}.
                  Manage the actual prepared circles from the character sheet; level-up does not force you to rebuild that list.
                </div>
              </div>
            )}
            {invocCount > 0 && classInvocations.length > 0 && invocationChoiceCount > 0 && (
              <LevelUpSpellChoiceList
                title="Eldritch Invocations"
                caption={`Choose ${invocationChoiceCount}`}
                spells={availableInvocationChoices}
                chosen={displayedChosenInvocations}
                max={invocationChoiceCount}
                onToggle={(id) => toggleSelection(id, displayedChosenInvocations, (updater) => {
                  setChosenInvocations((prev) => {
                    const unlocked = prev.filter((entry) => !lockedInvocationIds.has(entry));
                    const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                    return [...Array.from(lockedInvocationIds), ...nextUnlocked];
                  });
                }, invocationChoiceCount)}
                isAllowed={(invocation) => allowedInvocationIds.has(invocation.id)}
              />
            )}
            {maneuverChoiceEntries.map((entry) => (
              <div key={entry.definition.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <LevelUpSpellChoiceList
                  title={entry.definition.title}
                  caption={`Choose ${entry.remainingCount} new`}
                  spells={(growthOptionEntriesByKey[entry.definition.key] ?? []).map((spell) => ({ ...spell, id: String(spell.id), level: null }))}
                  chosen={entry.chosen}
                  max={entry.definition.totalCount}
                  onToggle={(id) => {
                    setChosenFeatureChoices((prev) => {
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
                {entry.definition.abilityChoice && (
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
                              setChosenFeatureChoices((prev) => ({
                                ...prev,
                                [entry.definition.abilityChoice!.key]: active ? [] : [option],
                              }));
                            }}
                          >
                            {ABILITY_LABELS[option]}
                          </ChoiceBtn>
                        );
                      })}
                    </div>
                  </div>
                )}
                {entry.definition.note && (
                  <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>{entry.definition.note}</div>
                )}
              </div>
            ))}
            {planChoiceEntries.map((entry) => (
              <div key={entry.definition.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <LevelUpItemChoiceList
                  title={entry.definition.title}
                  caption={`Choose ${entry.remainingCount} new`}
                  items={growthOptionEntriesByKey[entry.definition.key] ?? []}
                  chosen={entry.chosen}
                  disabledIds={entry.disabledIds}
                  max={entry.definition.totalCount}
                  onToggle={(id) => {
                    setChosenFeatureChoices((prev) => {
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
                {entry.definition.note && (
                  <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>{entry.definition.note}</div>
                )}
              </div>
            ))}
            {featSpellListChoices.map((choice) => {
              const selected = chosenFeatOptions[choice.key] ?? [];
              return (
                <div key={choice.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: "#fff" }}>{choice.title}</div>
                    <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? accentColor : C.muted }}>
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
                            setChosenFeatOptions((prev) => {
                              const current = prev[choice.key] ?? [];
                              const next = current.includes(option)
                                ? current.filter((entry) => entry !== option)
                                : current.length < choice.count
                                  ? [...current, option]
                                  : current;
                              return { ...prev, [choice.key]: next };
                            });
                          }}
                          accent={accentColor}
                        >
                          {option}
                        </ChoiceBtn>
                      );
                    })}
                  </div>
                  {choice.note && <div style={{ marginTop: 8, fontSize: "var(--fs-small)", color: C.muted }}>{choice.note}</div>}
                </div>
              );
            })}
            {featResolvedSpellChoices.map((choice) => (
              <LevelUpSpellChoiceList
                key={choice.key}
                title={choice.title}
                caption={`Choose ${choice.count}`}
                spells={(featSpellChoiceOptions[choice.key] ?? []).map((spell) => ({ ...spell, id: String(spell.id) }))}
                chosen={resolveSelectedSpellOptionEntries(chosenFeatOptions[choice.key] ?? [], featSpellChoiceOptions[choice.key] ?? []).map((spell) => String(spell.id))}
                max={choice.count}
                onToggle={(id) => {
                  setChosenFeatOptions((prev) => {
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
            ))}
            {classFeatureResolvedSpellChoices.map((choice) => (
              <LevelUpSpellChoiceList
                key={choice.key}
                title={choice.title}
                caption={`Choose ${choice.count}`}
                spells={(classFeatureSpellChoiceOptions[choice.key] ?? []).map((spell) => ({ ...spell, id: String(spell.id) }))}
                chosen={resolveSelectedSpellOptionEntries(chosenFeatOptions[choice.key] ?? [], classFeatureSpellChoiceOptions[choice.key] ?? []).map((spell) => String(spell.id))}
                max={choice.count}
                onToggle={(id) => {
                  setChosenFeatOptions((prev) => {
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
            ))}
            {invocationResolvedSpellChoices.map((choice) => (
              <LevelUpSpellChoiceList
                key={choice.key}
                title={choice.title}
                caption={`Choose ${choice.count}`}
                spells={(invocationSpellChoiceOptions[choice.key] ?? []).map((spell) => ({ ...spell, id: String(spell.id) }))}
                chosen={resolveSelectedSpellOptionEntries(chosenFeatOptions[choice.key] ?? [], invocationSpellChoiceOptions[choice.key] ?? []).map((spell) => String(spell.id))}
                max={choice.count}
                onToggle={(id) => {
                  setChosenFeatOptions((prev) => {
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
            ))}
            {(featResolvedSpellChoices.some((choice) => (featSpellChoiceOptions[choice.key] ?? []).length === 0)
              || classFeatureResolvedSpellChoices.some((choice) => (classFeatureSpellChoiceOptions[choice.key] ?? []).length === 0)
              || invocationResolvedSpellChoices.some((choice) => (invocationSpellChoiceOptions[choice.key] ?? []).length === 0)) && (
              <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                {featResolvedSpellChoices.some((choice) => choice.linkedTo && (chosenFeatOptions[choice.linkedTo] ?? []).length === 0)
                  ? "Choose the spell list first."
                  : "No eligible spell options found."}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── New features ── */}
      {newFeatures.length > 0 && (
        <Section title={`New Features at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {newFeatures.map((f) => {
              const key = f.name;
              const expanded = expandedFeatures.includes(key);
              return (
                <div
                  key={key}
                  style={{
                    borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)", overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setExpandedFeatures((p) =>
                      p.includes(key) ? p.filter((x) => x !== key) : [...p, key]
                    )}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", background: "none", border: "none", cursor: "pointer",
                      color: C.text, fontWeight: 700, fontSize: "var(--fs-subtitle)", textAlign: "left",
                    }}
                  >
                    <span>{f.name}</span>
                    <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{expanded ? "▲" : "▼"}</span>
                  </button>
                  {expanded && (
                    <div style={{
                      padding: "0 12px 12px", fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}>
                      {f.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Spell slots ── */}
      {newSlots && newSlots.some((s, i) => i > 0 && s > 0) && (
        <Section title={`Spell Slots at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {newSlots.map((count, i) => {
              if (count === 0) return null;
              return (
                <div key={i} style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{LEVEL_LABELS[i] ?? `L${i}`}</div>
                  <div style={{ fontWeight: 800, fontSize: "var(--fs-body)", color: accentColor }}>{count}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Confirm ── */}
      <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{
            padding: "12px 20px", borderRadius: 10, cursor: "pointer", fontSize: "var(--fs-medium)", fontWeight: 600,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted,
          }}
        >Cancel</button>
        <button
          onClick={confirm}
          disabled={!canConfirm || !extraFeatSpellSelectionsValid || saving}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 10, cursor: canConfirm && !saving ? "pointer" : "not-allowed",
            fontSize: "var(--fs-medium)", fontWeight: 800, border: "none",
            background: canConfirm ? accentColor : "rgba(255,255,255,0.08)",
            color: canConfirm ? "#fff" : C.muted,
            opacity: saving ? 0.6 : 1,
            transition: "background 0.2s",
          }}
        >
          {saving ? "Saving…" : `⬆ Level Up to ${nextLevel}`}
        </button>
      </div>
    </Wrap>
  );
}
