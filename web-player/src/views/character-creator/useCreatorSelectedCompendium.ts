import React from "react";
import { api } from "@/services/api";
import { fetchGrandBackgroundDetail, fetchGrandClassDetail, fetchGrandSpeciesDetail } from "@/services/compendiumApi";
import { fetchSpellsByName, mergeSpellsById } from "@/services/spellLookup";
import type { BgDetail, ClassDetail, RaceDetail, SpellSummary } from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { getExpandedSpellListNames, getSpellcastingClassName } from "@/views/character-creator/utils/CharacterCreatorUtils";

export function useCreatorSelectedCompendium(args: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  isEditing: boolean;
}) {
  const { form, setForm, isEditing } = args;
  const [classDetail, setClassDetail] = React.useState<ClassDetail | null>(null);
  const [raceDetail, setRaceDetail] = React.useState<RaceDetail | null>(null);
  const [bgDetail, setBgDetail] = React.useState<BgDetail | null>(null);
  const [classCantrips, setClassCantrips] = React.useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = React.useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = React.useState<SpellSummary[]>([]);
  const previousClassId = React.useRef<string | null>(null);
  const previousRaceId = React.useRef<string | null>(null);
  const previousBackgroundId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!form.classId) {
      previousClassId.current = null;
      setClassDetail(null);
      return;
    }
    const previous = previousClassId.current;
    previousClassId.current = form.classId;
    if (!isEditing || (previous !== null && previous !== form.classId)) {
      setForm((current) => ({
        ...current,
        chosenClassFeatIds: {}, chosenClassLanguages: [], chosenClassEquipmentOption: null,
        chosenFeatOptions: Object.fromEntries(Object.entries(current.chosenFeatOptions).filter(([key]) => !key.startsWith("classfeat:"))),
      }));
    }
    setClassDetail(null);
    if (!form.ruleset) return;
    let cancelled = false;
    fetchGrandClassDetail<ClassDetail>(form.classId, form.ruleset)
      .then((detail) => { if (!cancelled) setClassDetail(detail); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.classId, form.ruleset, isEditing, setForm]);

  React.useEffect(() => {
    if (!classDetail) {
      setClassCantrips([]); setClassSpells([]); setClassInvocations([]);
      return;
    }
    let cancelled = false;
    const spellcastingName = getSpellcastingClassName(classDetail, form.level, form.subclass) ?? classDetail.name;
    const accessId = Object.entries(classDetail.spellLists ?? {}).find(([, label]) => label === spellcastingName)?.[0];
    const name = encodeURIComponent(accessId ?? spellcastingName);
    const ruleset = form.ruleset ?? "5.5e";
    const rulesetParam = `&ruleset=${encodeURIComponent(ruleset)}`;
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=120&includeText=1&lite=1&excludeSpecial=1${rulesetParam}`)
      .then((rows) => { if (!cancelled) setClassCantrips(rows); }).catch(() => {});
    Promise.all([
      api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=220&includeText=1&compact=1&lite=1&excludeSpecial=1${rulesetParam}`),
      fetchSpellsByName(getExpandedSpellListNames(classDetail, form.level, form.subclass), ruleset),
    ]).then(([base, expanded]) => { if (!cancelled) setClassSpells(mergeSpellsById(base, expanded)); }).catch(() => {});
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>(`/api/class-talents/search?kind=invocation&limit=150&includeText=1${rulesetParam}`)
        .then((rows) => { if (!cancelled) setClassInvocations(rows); }).catch(() => {});
    } else setClassInvocations([]);
    return () => { cancelled = true; };
  }, [classDetail, form.level, form.ruleset, form.subclass]);

  React.useEffect(() => {
    if (!form.raceId) { previousRaceId.current = null; setRaceDetail(null); return; }
    const previous = previousRaceId.current;
    previousRaceId.current = form.raceId;
    if (!isEditing || (previous !== null && previous !== form.raceId)) {
      setForm((current) => ({
        ...current,
        chosenRaceSkills: [], chosenRaceLanguages: [], chosenRaceTools: [], chosenRaceFeatId: null,
        chosenRaceSize: null, chosenRaceAbilityChoices: [], raceAbilityMode: "split", raceAbilityBonuses: {},
        chosenClassLanguages: [],
        chosenFeatOptions: Object.fromEntries(Object.entries(current.chosenFeatOptions).filter(([key]) => !key.startsWith("race:"))),
      }));
    }
    setRaceDetail(null);
    if (!form.ruleset) return;
    let cancelled = false;
    fetchGrandSpeciesDetail<RaceDetail>(form.raceId, form.ruleset)
      .then((detail) => { if (!cancelled) setRaceDetail(detail); }).catch(() => {});
    return () => { cancelled = true; };
  }, [form.raceId, form.ruleset, isEditing, setForm]);

  React.useEffect(() => {
    if (!form.bgId) { previousBackgroundId.current = null; setBgDetail(null); return; }
    const previous = previousBackgroundId.current;
    previousBackgroundId.current = form.bgId;
    if (!isEditing || (previous !== null && previous !== form.bgId)) {
      setForm((current) => ({
        ...current,
        chosenBgTools: [], chosenBgLanguages: [], chosenBgOriginFeatId: null,
        chosenBgEquipmentOption: null, bgAbilityMode: "split", bgAbilityBonuses: {},
        chosenFeatOptions: Object.fromEntries(Object.entries(current.chosenFeatOptions).filter(([key]) => !key.startsWith("bg:"))),
      }));
    }
    setBgDetail(null);
    if (!form.ruleset) return;
    let cancelled = false;
    fetchGrandBackgroundDetail<BgDetail>(form.bgId, form.ruleset)
      .then((detail) => { if (!cancelled) setBgDetail(detail); }).catch(() => {});
    return () => { cancelled = true; };
  }, [form.bgId, form.ruleset, isEditing, setForm]);

  return { classDetail, setClassDetail, raceDetail, setRaceDetail, bgDetail, setBgDetail, classCantrips, classSpells, classInvocations };
}
