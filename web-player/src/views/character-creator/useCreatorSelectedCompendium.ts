import type { ProgressionRequirement } from "@beholden/shared/domain/progressionRequirements";
import { fetchLevelUpSpellOptions } from "@/views/level-up/fetchLevelUpSpellOptions";
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
  const [retryKey, setRetryKey] = React.useState(0);
  const [loads, setLoads] = React.useState<Record<string, { key: string; state: "loading" | "failed" | "complete" }>>({});
  const mark = React.useCallback((id: string, key: string, state: "loading" | "failed" | "complete") =>
    setLoads((previous) => ({ ...previous, [id]: { key, state } })), []);
  const classKey = JSON.stringify([form.ruleset, form.classId, retryKey]);
  const raceKey = JSON.stringify([form.ruleset, form.raceId, retryKey]);
  const bgKey = JSON.stringify([form.ruleset, form.bgId, retryKey]);
  const spellsKey = JSON.stringify([classKey, form.level, form.subclass]);
  const loadRequirements: ProgressionRequirement[] = [
    { id: "class", key: classKey, selected: form.classId, label: "class", step: 2 },
    { id: "species", key: raceKey, selected: form.raceId, label: "species", step: 3 },
    { id: "background", key: bgKey, selected: form.bgId, label: "background", step: 4 },
    { id: "class-options", key: spellsKey, selected: form.classId, label: "class spell and invocation options", step: 8 },
  ].map(({ id, key, selected, label, step }) => {
    const state = !selected ? "incomplete" : loads[id]?.key === key ? loads[id].state : "loading";
    return { id: "load:" + id, state, step, message: !selected ? "Choose your " + label + "."
      : state === "failed" ? "Could not load " + label + ". Retry loading options."
      : state === "complete" ? "Loaded " + label + "." : "Loading " + label + "..." };
  });
  const classReady = loads.class?.key === classKey && loads.class.state === "complete";
  const classSpellOptionsLoaded = loads["class-options"]?.key === spellsKey && loads["class-options"].state === "complete";
  const retryOptions = () => setRetryKey((key) => key + 1);
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
    if (previous !== form.classId && (!isEditing || previous !== null)) {
      setForm((current) => ({
        ...current,
        chosenClassFeatIds: {}, chosenClassLanguages: [], chosenClassEquipmentOption: null,
        chosenFeatOptions: Object.fromEntries(Object.entries(current.chosenFeatOptions).filter(([key]) => !key.startsWith("classfeat:"))),
      }));
    }
    setClassDetail(null);
    if (!form.ruleset) return;
    let cancelled = false;
    mark("class", classKey, "loading");
    fetchGrandClassDetail<ClassDetail>(form.classId, form.ruleset)
      .then((detail) => { if (!cancelled) { setClassDetail(detail); mark("class", classKey, "complete"); } })
      .catch(() => { if (!cancelled) mark("class", classKey, "failed"); });
    return () => { cancelled = true; };
  }, [form.classId, form.ruleset, isEditing, setForm, classKey, mark]);

  React.useEffect(() => {
    if (!classDetail || !classReady) {
      setClassCantrips([]); setClassSpells([]); setClassInvocations([]);
      return;
    }
    let cancelled = false;
    const spellcastingName = getSpellcastingClassName(classDetail, form.level, form.subclass) ?? classDetail.name;
    const accessId = Object.entries(classDetail.spellLists ?? {}).find(([, label]) => label === spellcastingName)?.[0];
    const name = encodeURIComponent(accessId ?? spellcastingName);
    const ruleset = form.ruleset ?? "5.5e";
    const rulesetParam = `&ruleset=${encodeURIComponent(ruleset)}`;
    mark("class-options", spellsKey, "loading");
    Promise.all([
      fetchLevelUpSpellOptions<SpellSummary>(`classes=${name}&level=0&includeText=1&lite=1&excludeSpecial=1${rulesetParam}`),
      Promise.all([
        fetchLevelUpSpellOptions<SpellSummary>(`classes=${name}&minLevel=1&maxLevel=9&includeText=1&lite=1&excludeSpecial=1${rulesetParam}`),
        fetchSpellsByName(getExpandedSpellListNames(classDetail, form.level, form.subclass), ruleset),
      ]).then(([base, expanded]) => mergeSpellsById(base, expanded)),
      /warlock/i.test(classDetail.name)
        ? api<SpellSummary[]>(`/api/class-talents/search?kind=invocation&limit=150&includeText=1${rulesetParam}`)
        : Promise.resolve([] as SpellSummary[]),
    ]).then(([cantrips, spells, invocations]) => {
      if (cancelled) return;
      setClassCantrips(cantrips); setClassSpells(spells); setClassInvocations(invocations);
      mark("class-options", spellsKey, "complete");
    }).catch(() => { if (!cancelled) mark("class-options", spellsKey, "failed"); });
    return () => { cancelled = true; };
  }, [classDetail, classReady, form.level, form.ruleset, form.subclass, spellsKey, mark]);

  React.useEffect(() => {
    if (!form.raceId) { previousRaceId.current = null; setRaceDetail(null); return; }
    const previous = previousRaceId.current;
    previousRaceId.current = form.raceId;
    if (previous !== form.raceId && (!isEditing || previous !== null)) {
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
    mark("species", raceKey, "loading");
    fetchGrandSpeciesDetail<RaceDetail>(form.raceId, form.ruleset)
      .then((detail) => { if (!cancelled) { setRaceDetail(detail); mark("species", raceKey, "complete"); } })
      .catch(() => { if (!cancelled) mark("species", raceKey, "failed"); });
    return () => { cancelled = true; };
  }, [form.raceId, form.ruleset, isEditing, setForm, raceKey, mark]);

  React.useEffect(() => {
    if (!form.bgId) { previousBackgroundId.current = null; setBgDetail(null); return; }
    const previous = previousBackgroundId.current;
    previousBackgroundId.current = form.bgId;
    if (previous !== form.bgId && (!isEditing || previous !== null)) {
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
    mark("background", bgKey, "loading");
    fetchGrandBackgroundDetail<BgDetail>(form.bgId, form.ruleset)
      .then((detail) => { if (!cancelled) { setBgDetail(detail); mark("background", bgKey, "complete"); } })
      .catch(() => { if (!cancelled) mark("background", bgKey, "failed"); });
    return () => { cancelled = true; };
  }, [form.bgId, form.ruleset, isEditing, setForm, bgKey, mark]);

  return { retryKey, loadRequirements, classSpellOptionsLoaded, retryOptions, classDetail, setClassDetail, raceDetail, setRaceDetail, bgDetail, setBgDetail, classCantrips, classSpells, classInvocations };
}
