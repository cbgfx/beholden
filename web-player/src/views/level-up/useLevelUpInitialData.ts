import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { fetchMyCharacter } from "@/services/actorApi";
import { fetchClassCatalog, fetchGrandClassDetail, fetchFeatCatalog, type ClassCatalogRow } from "@/services/compendiumApi";
import { getSpellcastingClassName } from "@/views/character-creator/utils/CharacterCreatorUtils";
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
    fetchMyCharacter(id)
      .then((c) => {
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
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!char?.ruleset) return;
    fetchClassCatalog(char.ruleset).then(setClassCatalog).catch(() => setClassCatalog([]));
  }, [char?.ruleset]);

  useEffect(() => {
    if (!targetClassId || !char?.ruleset) {
      setClassDetail(null);
      return;
    }
    let alive = true;
    fetchGrandClassDetail<ClassDetail>(targetClassId, char.ruleset)
      .then((detail) => { if (alive) setClassDetail(detail); })
      .catch(() => { if (alive) setClassDetail(null); });
    return () => { alive = false; };
  }, [targetClassId, char?.ruleset]);

  useEffect(() => {
    if (!char?.ruleset) return;
    const ruleset = char.ruleset;
    let alive = true;
    Promise.all(classEntries.filter((entry) => entry.classId).map(async (entry) => ({
      id: entry.id,
      detail: await fetchGrandClassDetail<ClassDetail>(entry.classId!, ruleset).catch(() => null),
    }))).then((rows) => {
      if (!alive) return;
      setOwnedClassDetails(Object.fromEntries(rows.filter((row) => row.detail).map((row) => [row.id, row.detail!] as const)));
    });
    return () => { alive = false; };
  }, [classEntries, char?.ruleset]);

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
      return;
    }
    const spellcastingClassName = getSpellcastingClassName(classDetail, nextClassLevel, subclass) ?? classDetail.name;
    const spellAccessId = Object.entries(classDetail.spellLists ?? {}).find(([, label]) => label === spellcastingClassName)?.[0];
    const encodedClass = encodeURIComponent(spellAccessId ?? spellcastingClassName);
    api<SpellSummary[]>(`/api/spells/search?classes=${encodedClass}&level=0&limit=120&includeText=1&lite=1&excludeSpecial=1`)
      .then(setClassCantrips)
      .catch(() => setClassCantrips([]));
    api<SpellSummary[]>(`/api/spells/search?classes=${encodedClass}&minLevel=1&maxLevel=9&limit=220&includeText=1&lite=1&excludeSpecial=1`)
      .then(setClassSpells)
      .catch(() => setClassSpells([]));
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/class-talents/search?kind=invocation&limit=150&includeText=1")
        .then(setClassInvocations)
        .catch(() => setClassInvocations([]));
    } else {
      setClassInvocations([]);
    }
  }, [classDetail, nextClassLevel, subclass]);

  useEffect(() => {
    if (!char?.ruleset) return;
    fetchFeatCatalog(char.ruleset).then((rows) => setFeatSummaries(rows as FeatSummary[])).catch(() => setFeatSummaries([]));
  }, [char?.ruleset]);

  useEffect(() => {
    if (!chosenFeatId || !char?.ruleset) {
      setChosenFeatDetail(null);
      return;
    }
    api<FeatDetail>(`/api/compendium/feats/${encodeURIComponent(chosenFeatId)}?ruleset=${char.ruleset}`)
      .then((feat) => setChosenFeatDetail(feat))
      .catch(() => setChosenFeatDetail(null));
  }, [chosenFeatId, char?.ruleset]);

  return {
    char,
    classDetail,
    loading,
    error,
    setError,
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
  };
}
