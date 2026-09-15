import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { fetchLevelUpSpellOptions } from "./fetchLevelUpSpellOptions";
import { fetchMyCharacter } from "@/services/actorApi";
import { fetchClassCatalog, fetchGrandClassDetail, fetchFeatCatalog, type ClassCatalogRow } from "@/services/compendiumApi";
import { fetchSpellsByName, mergeSpellsById } from "@/services/spellLookup";
import { getExpandedSpellListNames, getSpellcastingClassName } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { mergeAutoLevels } from "@/views/level-up/LevelUpHelpers";
import type {
  LevelUpCharacter as Character,
  LevelUpClassDetail as ClassDetail,
  LevelUpFeatDetail as FeatDetail,
  LevelUpFeatSummary as FeatSummary,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";

export function useLevelUpInitialData(id: string | undefined) {
  const [char, setChar] = useState<Character | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [classCatalog, setClassCatalog] = useState<ClassCatalogRow[]>([]);
  const [ownedClassDetails, setOwnedClassDetails] = useState<Record<string, ClassDetail>>({});
  const [targetClassKey, setTargetClassKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const retryOptions = () => { setError(null); setRetryKey((key) => key + 1); };

  const [subclass, setSubclass] = useState<string>("");
  const [chosenCantrips, setChosenCantrips] = useState<string[]>([]);
  const [chosenSpells, setChosenSpells] = useState<string[]>([]);
  const [chosenInvocations, setChosenInvocations] = useState<string[]>([]);
  const [chosenExpertise, setChosenExpertise] = useState<Record<string, string[]>>({});
  const [chosenFeatureChoices, setChosenFeatureChoices] = useState<Record<string, string[]>>({});
  const [featSummaries, setFeatSummaries] = useState<FeatSummary[]>([]);
  const [chosenFeatDetail, setChosenFeatDetail] = useState<FeatDetail | null>(null);
  const [classCantrips, setClassCantrips] = useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = useState<SpellSummary[]>([]);
  // False while the classCantrips/classSpells/classInvocations fetch below is in flight for the
  // current classDetail/subclass/level -- distinct from those arrays being empty, which can
  // legitimately mean "still loading" as much as "no options exist". Sanitizers that prune chosen
  // spells against these lists must wait for this before treating an empty list as authoritative,
  // or they'll wipe a hydrated character's real picks before the real options ever arrive.
  const [classSpellOptionsLoaded, setClassSpellOptionsLoaded] = useState(false);
  const [classInvocations, setClassInvocations] = useState<SpellSummary[]>([]);
  const [chosenFeatId, setChosenFeatId] = useState<string>("");

  const nextLevel = (char?.level ?? 0) + 1;
  const mergedAutolevels = React.useMemo(() => mergeAutoLevels(classDetail), [classDetail]);
  const classEntries = React.useMemo(() => Array.isArray(char?.characterData?.classes) ? char.characterData.classes : [], [char?.characterData?.classes]);
  const selectedClassEntry = React.useMemo(() => classEntries.find((entry) => entry.id === targetClassKey) ?? null, [classEntries, targetClassKey]);
  const primaryClassEntry = selectedClassEntry ?? classEntries[0] ?? null;
  const targetClassId = selectedClassEntry?.classId ?? (targetClassKey.startsWith("new:") ? targetClassKey.slice(4) : null);
  const isAddingClass = Boolean(targetClassId && !selectedClassEntry);
  const nextClassLevel = selectedClassEntry ? selectedClassEntry.level + 1 : 1;

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    fetchMyCharacter(id)
      .then((c) => {
        if (!alive) return;
        setChar(c as Character);
        const classEntry = Array.isArray(c.characterData?.classes) ? c.characterData.classes[0] ?? null : null;
        setTargetClassKey(String(classEntry?.id ?? ""));
        setSubclass(String(classEntry?.subclass ?? ""));
        setChosenCantrips((c.characterData?.chosenCantrips ?? []) as string[]);
        setChosenSpells((c.characterData?.chosenSpells ?? []) as string[]);
        setChosenInvocations((c.characterData?.chosenInvocations ?? []) as string[]);
        setChosenFeatureChoices((c.characterData?.chosenFeatureChoices ?? {}) as Record<string, string[]>);
        const existingFeatOptions = (c.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>;
        setChosenExpertise(
          Object.fromEntries(
            Object.entries(existingFeatOptions).filter(([key]) => key.startsWith("classexpertise:")),
          ),
        );
      })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (!char?.ruleset) return;
    let alive = true;
    fetchClassCatalog(char.ruleset)
      .then((rows) => { if (alive) setClassCatalog(rows); })
      .catch(() => { if (alive) setError("Could not load available classes. Retry loading options."); });
    return () => { alive = false; };
  }, [char?.ruleset, retryKey]);

  useEffect(() => {
    if (!targetClassId || !char?.ruleset) {
      setClassDetail(null);
      return;
    }
    let alive = true;
    setClassDetail(null);
    setClassSpellOptionsLoaded(false);
    fetchGrandClassDetail<ClassDetail>(targetClassId, char.ruleset)
      .then((detail) => { if (alive) setClassDetail(detail); })
      .catch(() => { if (alive) { setClassDetail(null); setError("Could not load class details. Retry loading options."); } });
    return () => { alive = false; };
  }, [targetClassId, char?.ruleset, retryKey]);

  useEffect(() => {
    if (!char?.ruleset) return;
    const ruleset = char.ruleset;
    let alive = true;
    Promise.all(classEntries.filter((entry) => entry.classId).map(async (entry) => ({
      id: entry.id,
      detail: await fetchGrandClassDetail<ClassDetail>(entry.classId!, ruleset),
    }))).then((rows) => {
      if (!alive) return;
      setOwnedClassDetails(Object.fromEntries(rows.filter((row) => row.detail).map((row) => [row.id, row.detail!] as const)));
    }).catch(() => { if (alive) setError("Could not check your existing classes. Retry loading options."); });
    return () => { alive = false; };
  }, [classEntries, char?.ruleset, retryKey]);

  useEffect(() => {
    if (!char || !targetClassKey) return;
    const scoped = char.characterData?.classSpellSelections?.[targetClassKey] as { chosenCantrips?: string[]; chosenSpells?: string[]; chosenInvocations?: string[] } | undefined;
    setSubclass(String(selectedClassEntry?.subclass ?? ""));
    setChosenCantrips(scoped?.chosenCantrips ?? (selectedClassEntry === classEntries[0] ? char.characterData?.chosenCantrips ?? [] : []));
    setChosenSpells(scoped?.chosenSpells ?? (selectedClassEntry === classEntries[0] ? char.characterData?.chosenSpells ?? [] : []));
    setChosenInvocations(scoped?.chosenInvocations ?? (selectedClassEntry === classEntries[0] ? char.characterData?.chosenInvocations ?? [] : []));
  }, [char, classEntries, selectedClassEntry, targetClassKey]);

  useEffect(() => {
    if (!classDetail) {
      setClassCantrips([]);
      setClassSpells([]);
      setClassInvocations([]);
      setClassSpellOptionsLoaded(false);
      return;
    }
    let alive = true;
    setClassSpellOptionsLoaded(false);
    const spellcastingClassName = getSpellcastingClassName(classDetail, nextClassLevel, subclass) ?? classDetail.name;
    const spellAccessId = Object.entries(classDetail.spellLists ?? {}).find(([, label]) => label === spellcastingClassName)?.[0];
    const encodedClass = encodeURIComponent(spellAccessId ?? spellcastingClassName);
    const ruleset = char?.ruleset ?? "5.5e";
    const rulesetParam = `&ruleset=${encodeURIComponent(ruleset)}`;
    const cantripsDone = fetchLevelUpSpellOptions(`classes=${encodedClass}&level=0&includeText=1&lite=1&excludeSpecial=1${rulesetParam}`)
      .then((rows) => { if (alive) setClassCantrips(rows); });
    const expandedSpellNames = getExpandedSpellListNames(classDetail, nextClassLevel, subclass);
    const spellsDone = Promise.all([
      fetchLevelUpSpellOptions(`classes=${encodedClass}&minLevel=1&maxLevel=9&includeText=1&lite=1&excludeSpecial=1${rulesetParam}`),
      fetchSpellsByName(expandedSpellNames, ruleset),
    ])
      .then(([baseSpells, expandedSpells]) => { if (alive) setClassSpells(mergeSpellsById(baseSpells, expandedSpells)); });
    const invocationsDone = /warlock/i.test(classDetail.name)
      ? api<SpellSummary[]>(`/api/class-talents/search?kind=invocation&limit=150&includeText=1${rulesetParam}`)
        .then((rows) => { if (alive) setClassInvocations(rows); })
      : Promise.resolve(setClassInvocations([]));
    Promise.all([cantripsDone, spellsDone, invocationsDone])
      .then(() => { if (alive) setClassSpellOptionsLoaded(true); })
      .catch(() => { if (alive) setError("Could not load level-up options. Retry loading options before continuing."); });
    return () => { alive = false; };
  }, [classDetail, nextClassLevel, subclass, char?.ruleset, retryKey]);

  useEffect(() => {
    if (!char?.ruleset) return;
    let alive = true;
    fetchFeatCatalog(char.ruleset)
      .then((rows) => { if (alive) setFeatSummaries(rows as FeatSummary[]); })
      .catch(() => { if (alive) setError("Could not load available feats. Retry loading options."); });
    return () => { alive = false; };
  }, [char?.ruleset, retryKey]);

  useEffect(() => {
    if (!chosenFeatId || !char?.ruleset) {
      setChosenFeatDetail(null);
      return;
    }
    let alive = true;
    setChosenFeatDetail(null);
    api<FeatDetail>(`/api/compendium/feats/${encodeURIComponent(chosenFeatId)}?ruleset=${char.ruleset}`)
      .then((feat) => { if (alive) setChosenFeatDetail(feat); })
      .catch(() => { if (alive) { setChosenFeatDetail(null); setError("Could not load the selected feat. Retry loading options."); } });
    return () => { alive = false; };
  }, [chosenFeatId, char?.ruleset, retryKey]);

  return {
    char,
    classDetail,
    loading,
    error,
    setError,
    retryOptions,
    nextLevel,
    nextClassLevel,
    mergedAutolevels,
    primaryClassEntry,
    classEntries,
    classCatalog,
    ownedClassDetails,
    targetClassKey,
    setTargetClassKey,
    targetClassId,
    selectedClassEntry,
    isAddingClass,
    subclass,
    setSubclass,
    chosenCantrips,
    setChosenCantrips,
    chosenSpells,
    setChosenSpells,
    chosenInvocations,
    setChosenInvocations,
    chosenExpertise,
    setChosenExpertise,
    chosenFeatureChoices,
    setChosenFeatureChoices,
    featSummaries,
    chosenFeatId,
    setChosenFeatId,
    chosenFeatDetail,
    classCantrips,
    classSpells,
    classInvocations,
    classSpellOptionsLoaded,
  };
}
