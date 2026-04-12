import React, { useEffect, useState } from "react";
import { api } from "@/services/api";
import { fetchMyCharacter } from "@/services/actorApi";
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
  const primaryClassEntry = React.useMemo(
    () => (Array.isArray(char?.characterData?.classes) ? char.characterData.classes[0] ?? null : null),
    [char?.characterData?.classes],
  );

  useEffect(() => {
    if (!id) return;
    fetchMyCharacter(id)
      .then((c) => {
        setChar(c as Character);
        const classEntry = Array.isArray(c.characterData?.classes) ? c.characterData.classes[0] ?? null : null;
        setSubclass(String(classEntry?.subclass ?? ""));
        setChosenCantrips(c.characterData?.chosenCantrips ?? []);
        setChosenSpells(c.characterData?.chosenSpells ?? []);
        setChosenInvocations(c.characterData?.chosenInvocations ?? []);
        setChosenFeatureChoices((c.characterData?.chosenFeatureChoices ?? {}) as Record<string, string[]>);
        const existingFeatOptions = (c.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>;
        setChosenExpertise(
          Object.fromEntries(
            Object.entries(existingFeatOptions).filter(([key]) => key.startsWith("classexpertise:")),
          ),
        );
        const classId = typeof classEntry?.classId === "string" ? classEntry.classId : null;
        return classId ? api<ClassDetail>(`/api/compendium/classes/${classId}`) : null;
      })
      .then((cd) => {
        if (cd) setClassDetail(cd);
      })
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
    const encodedClass = encodeURIComponent(spellcastingClassName);
    api<SpellSummary[]>(`/api/spells/search?classes=${encodedClass}&level=0&limit=120&compact=1&lite=1&excludeSpecial=1`)
      .then(setClassCantrips)
      .catch(() => setClassCantrips([]));
    api<SpellSummary[]>(`/api/spells/search?classes=${encodedClass}&minLevel=1&maxLevel=9&limit=220&compact=1&lite=1&excludeSpecial=1`)
      .then(setClassSpells)
      .catch(() => setClassSpells([]));
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=150&includeText=1&lite=1")
        .then(setClassInvocations)
        .catch(() => setClassInvocations([]));
    } else {
      setClassInvocations([]);
    }
  }, [classDetail, nextLevel, subclass]);

  useEffect(() => {
    api<FeatSummary[]>("/api/compendium/feats").then(setFeatSummaries).catch(() => setFeatSummaries([]));
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

  return {
    char,
    classDetail,
    loading,
    error,
    setError,
    nextLevel,
    mergedAutolevels,
    primaryClassEntry,
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
