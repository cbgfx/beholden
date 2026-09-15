import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React, { useState } from "react";
import { useInvocationGrantedFeatChoices } from "@/views/shared/useInvocationGrantedFeatChoices";
import { useNavigate, useParams } from "react-router-dom";
import { C, withAlpha } from "@/lib/theme";
import { Button } from "@/ui/Button";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import type {
  AsiMode,
  HpChoice,
} from "@/views/level-up/LevelUpTypes";
import { AsiAbilityGrid, BackBtn, ChoiceBtn, ExclusiveChoiceReplacementSection, ExpertiseReplacementSection, ExpertiseSelectionSection, FeatSelectionSection, LevelUpHpSection, Section, Wrap } from "@/views/level-up/LevelUpParts";
import { LevelUpChoicesSection, LevelUpFeaturesSection, LevelUpSpellSlotsSection, LevelUpSubclassSection } from "@/views/level-up/LevelUpSections";
import { deriveFeatAbilityBonuses, deriveHpGain, deriveLevelUpValidation, type LevelUpBlockerKey } from "@/views/level-up/LevelUpUtils";
import { deriveFeatHitPointMaxBonus } from "@/domain/character/featEffects";
import { useLevelUpInitialData } from "@/views/level-up/useLevelUpInitialData";
import { useLevelUpDerivedState } from "@/views/level-up/useLevelUpDerivedState";
import { useLevelUpChoiceSelections } from "@/views/level-up/useLevelUpChoiceSelections";
import { useLevelUpSelectionSanitizers } from "@/views/level-up/useLevelUpSelectionSanitizers";
import { useLevelUpSubmit } from "@/views/level-up/useLevelUpSubmit";
import { useLevelUpActions } from "@/views/level-up/useLevelUpActions";
import { describeMulticlassRequirement, multiclassRequirementMet } from "@/domain/character/multiclassEligibility";

export function LevelUpView() {
  const translateUi = useUiTranslation("playerUi");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
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
    classSpellOptionsLoaded,
  } = useLevelUpInitialData(id);

  // HP
  const [hpChoice, setHpChoice] = useState<HpChoice>(null);
  const [rolledHp, setRolledHp] = useState<number | null>(null);
  const [manualHp, setManualHp] = useState<string>("");
  React.useEffect(() => {
    setHpChoice(null);
    setRolledHp(null);
    setManualHp("");
  }, [targetClassKey]);

  // ASI
  const [asiMode, setAsiMode] = useState<AsiMode>(null);
  const [asiStats, setAsiStats] = useState<Record<string, number>>({});
  const [chosenMulticlassSkills, setChosenMulticlassSkills] = useState<string[]>([]);
  const [chosenMulticlassTools, setChosenMulticlassTools] = useState<string[]>([]);
  React.useEffect(() => {
    setChosenMulticlassSkills([]);
    setChosenMulticlassTools([]);
  }, [targetClassKey]);

  // Feature expand
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [featSearch, setFeatSearch] = useState("");
  const [chosenFeatOptions, setChosenFeatOptions] = useState<Record<string, string[]>>({});
  React.useEffect(() => {
    setChosenFeatOptions((char?.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>);
  }, [char?.id, char?.characterData?.chosenFeatOptions]);

  const {
    hd,
    conMod,
    hpAverage,
    usesFlexiblePreparedSpellsModel,
    classChoiceGroups,
    newFeatures,
    isAsiLevel,
    newSlots,
    subclassOptions,
    showSubclassChoice,
    needsSubclassChoice,
    subclassOverview,
    selectedSubclassFeatures,
    cantripCount,
    invocCount,
    prepCount,
    maxSpellLevel,
    spellcaster,
    expertiseChoices,
    expertiseReplacementChoices,
    fightingStyleReplacementChoice,
    pactBoonReplacementChoice,
    charProficiencies,
    proficientSkills,
    existingExpertise,
    existingClassSpellNames,
    featChoiceEntries,
    featSourceLabel,
    featSpellListChoices,
    featResolvedSpellChoices,
    classFeatureResolvedSpellChoices,
    cantripReplacementCount,
    classFeatureProficiencyChoices,
    classFeatureSkillKeys,
    classFeatureToolKeys,
    classFeatureLanguageKeys,
    classFeatureSaveKeys,
    growthChoiceDefinitions,
    preparedSpellProgressionChoiceDefinitions,
    preparedSpellProgressionGrantedKeys,
    invocationResolvedSpellChoices,
    invocationFeatChoices,
    allInvocationFeatChoices,
    allowedInvocationIds,
    featSpellChoiceOptions,
    classFeatureSpellChoiceOptions,
    invocationSpellChoiceOptions,
    growthOptionEntriesByKey,
  } = useLevelUpDerivedState({
    char,
    classDetail,
    mergedAutolevels,
    nextLevel,
    nextClassLevel,
    primaryClassEntry,
    subclass,
    chosenCantrips,
    chosenInvocations,
    chosenFeatOptions,
    chosenFeatureChoices,
    chosenFeatDetail,
    featSummaries,
    classCantrips,
    classInvocations,
  });

  useLevelUpSelectionSanitizers({
    char,
    classCantrips,
    classSpells,
    classInvocations,
    classSpellOptionsLoaded,
    existingClassSpellNames,
    cantripCount,
    maxSpellLevel,
    prepCount,
    allowedInvocationIds,
    invocCount,
    setChosenCantrips,
    setChosenSpells,
    setChosenInvocations,
    expertiseChoices,
    expertiseReplacementChoices,
    proficientSkills,
    existingExpertise,
    setChosenExpertise,
  });

  const hpGain = deriveHpGain(hpChoice, hpAverage, rolledHp, manualHp);
  const featAbilityBonuses = React.useMemo(
    () => deriveFeatAbilityBonuses({ chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel }),
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const featHpBonus = asiMode === "feat"
    ? deriveFeatHitPointMaxBonus([chosenFeatDetail], nextLevel)
    : 0;

  // Current scores + ASI deltas
  const baseScores = React.useMemo<Record<string, number>>(
    () => ({
      str: char?.strScore ?? 10,
      dex: char?.dexScore ?? 10,
      con: char?.conScore ?? 10,
      int: char?.intScore ?? 10,
      wis: char?.wisScore ?? 10,
      cha: char?.chaScore ?? 10,
    }),
    [char?.chaScore, char?.conScore, char?.dexScore, char?.intScore, char?.strScore, char?.wisScore],
  );
  const {
    featChoiceOptionsByKey,
    extraFeatSpellSelectionsValid,
    cantripChoiceCount,
    spellChoiceCount,
    invocationChoiceCount,
    displayedChosenCantrips,
    displayedChosenSpells,
    displayedChosenInvocations,
    lockedCantripIds,
    lockedSpellIds,
    lockedInvocationIds,
    lockedInvocationSelectionIds,
    maneuverChoiceEntries,
    planChoiceEntries,
    progressionTableChoiceEntries,
    effectiveChosenCantrips,
    effectiveChosenSpells,
    effectiveChosenInvocations,
    globallyChosenSpellChoiceIds,
    globallyChosenSpellChoiceNames,
  } = useLevelUpChoiceSelections({
    char,
    nextLevel,
    chosenFeatDetail,
    featChoiceEntries,
    featSpellChoiceOptions,
    featSpellListChoices,
    featResolvedSpellChoices,
    classFeatureResolvedSpellChoices,
    classFeatureProficiencyChoices,
    invocationResolvedSpellChoices,
    classFeatureSpellChoiceOptions,
    invocationSpellChoiceOptions,
    growthChoiceDefinitions,
    growthOptionEntriesByKey,
    preparedSpellProgressionChoiceDefinitions,
    preparedSpellProgressionGrantedKeys,
    chosenFeatureChoices,
    setChosenFeatureChoices,
    chosenFeatOptions,
    setChosenFeatOptions,
    chosenCantrips,
    chosenSpells,
    chosenInvocations,
    classCantrips,
    classSpells,
    classInvocations,
    existingClassSpellNames,
    cantripCount,
    cantripReplacementCount,
    maxSpellLevel,
    prepCount,
    allowedInvocationIds,
    invocCount,
  });
  const invocationGrantedFeatChoices = useInvocationGrantedFeatChoices({
    ruleset: char?.ruleset ?? "5.5e",
    choices: invocationFeatChoices,
    selectedOptions: chosenFeatOptions,
    level: nextLevel,
  });
  const invocationFeatSelectionsValid = invocationFeatChoices.every(
    (choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count,
  );
  const allExtraSelectionsValid = extraFeatSpellSelectionsValid && invocationFeatSelectionsValid && invocationGrantedFeatChoices.valid;

  const { filteredFeatSummaries, featPrereqsMet, featRepeatableValid, canConfirm: baseCanConfirm, blockers: baseBlockers } = React.useMemo(
    () =>
      deriveLevelUpValidation({
        ruleset: char?.ruleset ?? "5.5e",
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
        expertiseReplacementChoices,
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
        ownedFeatIds: [
          char?.characterData?.chosenRaceFeatId,
          char?.characterData?.chosenBgOriginFeatId,
          ...Object.values(char?.characterData?.chosenClassFeatIds ?? {}),
        ].map((value) => String(value ?? "")).filter(Boolean),
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
      expertiseReplacementChoices,
      chosenExpertise,
      chosenFeatDetail,
      featChoiceEntries,
      chosenFeatOptions,
      nextLevel,
      classDetail?.name,
      char?.className,
      char?.ruleset,
      char?.characterData?.chosenLevelUpFeats,
      char?.characterData?.chosenRaceFeatId,
      char?.characterData?.chosenBgOriginFeatId,
      char?.characterData?.chosenClassFeatIds,
      baseScores,
      charProficiencies,
      featSearch,
      featSummaries,
      hpGain,
    ]
  );

  const multiclassRequirements = React.useMemo(() => {
    if (!isAddingClass || !classDetail) return [];
    return [
      ...classEntries.map((entry) => ({ name: entry.className ?? ownedClassDetails[entry.id]?.name ?? "Current class", detail: ownedClassDetails[entry.id] })),
      { name: classDetail.name, detail: classDetail },
    ].flatMap(({ name, detail }) => {
      const requirement = detail?.multiclass?.requirements;
      if (!requirement) return [];
      return [{ name, label: describeMulticlassRequirement(requirement.ability, requirement.minimum ?? 13), met: multiclassRequirementMet(requirement.ability, requirement.minimum, baseScores) }];
    });
  }, [baseScores, classDetail, classEntries, isAddingClass, ownedClassDetails]);
  const multiclassEligible = multiclassRequirements.every((requirement) => requirement.met);
  const multiclassSkillCount = isAddingClass ? classDetail?.multiclass?.skills?.choose ?? 0 : 0;
  const multiclassToolCount = isAddingClass ? (classDetail?.multiclass?.tools?.choices ?? []).reduce((sum, choice) => sum + choice.count, 0) : 0;
  const multiclassChoicesComplete = chosenMulticlassSkills.length === multiclassSkillCount && chosenMulticlassTools.length === multiclassToolCount;
  const classChoicesComplete = classChoiceGroups.every((group) => Boolean(chosenFeatureChoices[group.key]?.[0]));
  const canConfirm = baseCanConfirm && multiclassEligible && multiclassChoicesComplete && classChoicesComplete;

  // The gates the view owns, appended to the ones the validation helper found.
  const blockers = React.useMemo<LevelUpBlockerKey[]>(() => {
    const all = [...baseBlockers];
    if (!multiclassEligible) all.push("multiclassRequirements");
    if (!multiclassChoicesComplete) all.push("multiclassChoices");
    if (!classChoicesComplete) all.push("classChoices");
    if (!allExtraSelectionsValid) all.push("extraChoices");
    return all;
  }, [allExtraSelectionsValid, baseBlockers, classChoicesComplete, multiclassChoicesComplete, multiclassEligible]);

  const blockerMessages: Record<LevelUpBlockerKey, string> = {
    hp: translateUi("Choose how to gain hit points — roll, take the average, or enter a value."),
    asi: translateUi("Spend both ability score points, or choose a feat instead."),
    subclass: translateUi("Choose a subclass."),
    cantrips: translateUi("Choose your new cantrips."),
    spells: translateUi("You have more spells selected than you can prepare."),
    invocations: translateUi("Choose your new invocations."),
    expertise: translateUi("Choose your expertise skills."),
    expertiseReplacement: translateUi("Finish choosing which expertise to replace."),
    featMissing: translateUi("Choose a feat."),
    featPrereq: translateUi("You don't meet the prerequisite for the selected feat."),
    featRepeatable: translateUi("You already have that feat, and it can't be taken twice."),
    featOptions: translateUi("The selected feat still needs its options chosen."),
    multiclassRequirements: translateUi("You don't meet the ability score requirements to multiclass."),
    multiclassChoices: translateUi("Choose your multiclass skills and tools."),
    classChoices: translateUi("Choose your new class feature options."),
    extraChoices: translateUi("Some spell, proficiency or feature choices are incomplete."),
  };

  const {
    availableCantripChoices,
    availableSpellChoices,
    availableInvocationChoices,
    toggleAsiPoint,
    clearAsi,
    toggleSelection,
    toggleMultiChoice,
    resetHpToAverage,
    chooseHpRoll,
    chooseHpManual,
  } = useLevelUpActions({
    hd,
    conMod,
    classCantrips,
    classSpells,
    classInvocations,
    lockedCantripIds,
    lockedSpellIds,
    lockedInvocationIds,
    preparedSpellProgressionGrantedKeys,
    maxSpellLevel,
    allowedInvocationIds,
    setHpChoice,
    setRolledHp,
    setManualHp,
    setAsiStats,
    setAsiMode,
  });

  const { saving, confirm } = useLevelUpSubmit({
    char,
    canConfirm,
    extraFeatSpellSelectionsValid: allExtraSelectionsValid,
    navigate,
    setError,
    nextLevel,
    nextClassLevel,
    targetClassEntryId: selectedClassEntry?.id ?? `class_${String(targetClassId ?? classDetail?.id ?? "new").replace(/^c_/, "")}`,
    targetClassId: targetClassId ?? classDetail?.id ?? null,
    isAddingClass,
    multiclassProficiencies: {
      skills: chosenMulticlassSkills,
      tools: [...(classDetail?.multiclass?.tools?.fixed ?? []), ...chosenMulticlassTools],
      armor: classDetail?.multiclass?.armor ?? [],
      weapons: classDetail?.multiclass?.weapons ?? [],
    },
    hpGain,
    featHpBonus,
    subclass,
    chosenCantrips,
    chosenSpells,
    chosenInvocations,
    chosenExpertise,
    chosenFeatOptions,
    invocationFeatChoices,
    allInvocationFeatChoices,
    chosenFeatureChoices,
    expertiseChoices,
    expertiseReplacementChoices,
    fightingStyleReplacementChoice,
    pactBoonReplacementChoice,
    featChoiceEntries,
    chosenFeatDetail,
    featSourceLabel,
    featSpellChoiceOptions,
    newFeatures,
    classDetailName: classDetail?.name,
    classCantrips,
    classSpells,
    classInvocations,
    effectiveChosenCantrips,
    effectiveChosenSpells,
    effectiveChosenInvocations,
    classFeatureResolvedSpellChoices,
    classFeatureSpellChoiceOptions,
    classFeatureProficiencyChoices,
    invocationResolvedSpellChoices,
    invocationSpellChoiceOptions,
    maneuverChoiceEntries,
    planChoiceEntries,
    growthOptionEntriesByKey,
    baseScores,
    asiMode,
    asiStats,
    featAbilityBonuses,
  });

  if (loading) return <Wrap><p style={{ color: C.muted }}>{translateUi("Loading…")}</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;
  if (nextLevel > 20) {
    return (
      <Wrap>
        <p style={{ color: C.muted }}>{translateUi("Already at max level (20).")}</p>
        <BackBtn onClick={() => navigate(`/characters/${char.id}`)} />
      </Wrap>
    );
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
            {translateUi("Level")} {char.level} → <span style={{ color: "#fff" }}>{nextLevel}</span>
            {classDetail && <span style={{ color: C.muted, fontWeight: 400 }}> · {classDetail.name}</span>}
          </div>
        </div>
      </div>

      {/* ── HP gain ── */}
      <Section title={translateUi("Class level")} accent={accentColor}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {classEntries.map((entry) => <ChoiceBtn key={entry.id} active={targetClassKey === entry.id} onClick={() => setTargetClassKey(entry.id)} accent={accentColor}>{entry.className ?? ownedClassDetails[entry.id]?.name ?? "Class"} {entry.level} → {entry.level + 1}</ChoiceBtn>)}
          {classCatalog.filter((option) => !classEntries.some((entry) => entry.classId === option.id)).map((option) => <ChoiceBtn key={option.id} active={targetClassKey === `new:${option.id}`} onClick={() => setTargetClassKey(`new:${option.id}`)} accent={accentColor}>{translateUi("Add")} {option.name}</ChoiceBtn>)}
        </div>
        {isAddingClass && <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: "var(--fs-small)" }}>
          {multiclassRequirements.map((requirement) => <div key={`${requirement.name}:${requirement.label}`} style={{ color: requirement.met ? C.green : C.red }}>{requirement.met ? "✓" : "✕"} {requirement.name}: {requirement.label}</div>)}
          {multiclassSkillCount > 0 && <div><div style={{ color: C.muted, marginBottom: 6 }}>{translateUi("Choose")} {multiclassSkillCount} {translateUi("skill proficiency")}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(classDetail?.multiclass?.skills?.from ?? []).map((name) => <ChoiceBtn key={name} active={chosenMulticlassSkills.includes(name)} onClick={() => setChosenMulticlassSkills((current) => current.includes(name) ? current.filter((value) => value !== name) : current.length < multiclassSkillCount ? [...current, name] : current)}>{name}</ChoiceBtn>)}</div></div>}
          {multiclassToolCount > 0 && <div><div style={{ color: C.muted, marginBottom: 6 }}>{translateUi("Choose")} {multiclassToolCount} {translateUi("tool proficiency")}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Array.from(new Set((classDetail?.multiclass?.tools?.choices ?? []).flatMap((choice) => choice.from))).map((name) => <ChoiceBtn key={name} active={chosenMulticlassTools.includes(name)} onClick={() => setChosenMulticlassTools((current) => current.includes(name) ? current.filter((value) => value !== name) : current.length < multiclassToolCount ? [...current, name] : current)}>{name}</ChoiceBtn>)}</div></div>}
        </div>}
      </Section>

      <LevelUpHpSection
        nextLevel={nextLevel}
        hd={hd}
        conMod={conMod}
        hpChoice={hpChoice}
        hpAverage={hpAverage}
        rolledHp={rolledHp}
        manualHp={manualHp}
        hpGain={hpGain}
        featHpBonus={featHpBonus}
        hpMax={char.hpMax}
        accentColor={accentColor}
        onChooseAverage={resetHpToAverage}
        onChooseRoll={chooseHpRoll}
        onChooseManual={chooseHpManual}
        onManualChange={setManualHp}
      />

      {/* ── ASI ── */}
      {isAsiLevel && (
        <Section title={translateUi("Ability Score Improvement")} accent={accentColor}>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
            {translateUi("+2 to one ability score, +1 to two different scores, or take a feat.")}
          </div>

          {/* Mode selection */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(["asi", "feat"] as const).map((m) => (
              <ChoiceBtn
                key={m}
                active={asiMode === m}
                onClick={() => { clearAsi(); setAsiMode(m); }}
              >
                {m === "asi" ? translateUi("Improve Abilities") : translateUi("Take a Feat")}
              </ChoiceBtn>
            ))}
          </div>

          {asiMode && asiMode !== "feat" && (
            <AsiAbilityGrid
              baseScores={baseScores}
              asiStats={asiStats}
              accentColor={accentColor}
              onToggle={(key) => toggleAsiPoint(key, asiMode)}
            />
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
              featSpellChoiceOptions={featSpellChoiceOptions}
              chosenFeatOptions={chosenFeatOptions}
              nextLevel={nextLevel}
              onToggleFeatOption={(choiceKey, option, count) =>
                toggleMultiChoice(choiceKey, option, count, setChosenFeatOptions)
              }
            />
          )}
        </Section>
      )}

      {expertiseChoices.length > 0 && (
        <Section title={translateUi("Expertise at Level {{value1}}", { value1: nextLevel })} accent={accentColor}>
          <ExpertiseSelectionSection
            accentColor={accentColor}
            expertiseChoices={expertiseChoices}
            chosenExpertise={chosenExpertise}
            proficientSkills={proficientSkills}
            existingExpertise={existingExpertise}
            onToggleExpertise={(choiceKey, skill, count) =>
              toggleMultiChoice(choiceKey, skill, count, setChosenExpertise)
            }
          />
        </Section>
      )}

      {expertiseReplacementChoices.length > 0 && (
        <Section title={translateUi("Expertise Replacement at Level {{value1}}", { value1: nextLevel })} accent={accentColor}>
          <ExpertiseReplacementSection
            accentColor={accentColor}
            replacementChoices={expertiseReplacementChoices}
            chosenExpertise={chosenExpertise}
            proficientSkills={proficientSkills}
            existingExpertise={existingExpertise}
            onToggleExpertise={(choiceKey, skill, count) =>
              toggleMultiChoice(choiceKey, skill, count, setChosenExpertise)
            }
          />
        </Section>
      )}

      {fightingStyleReplacementChoice && fightingStyleReplacementChoice.options.length > 0 && (
        <Section title={translateUi("Fighting Style at Level {{value1}}", { value1: nextLevel })} accent={accentColor}>
          <ExclusiveChoiceReplacementSection
            accentColor={accentColor}
            title={translateUi("Optionally replace your Fighting Style")}
            choice={fightingStyleReplacementChoice}
            chosenFeatureChoices={chosenFeatureChoices}
            onSelect={(choiceKey, optionId) => setChosenFeatureChoices((prev) => ({ ...prev, [choiceKey]: [optionId] }))}
          />
        </Section>
      )}

      {pactBoonReplacementChoice && pactBoonReplacementChoice.options.length > 0 && (
        <Section title={translateUi("Pact Boon at Level {{value1}}", { value1: nextLevel })} accent={accentColor}>
          <ExclusiveChoiceReplacementSection
            accentColor={accentColor}
            title={translateUi("Optionally replace your Pact Boon")}
            choice={pactBoonReplacementChoice}
            chosenFeatureChoices={chosenFeatureChoices}
            onSelect={(choiceKey, optionId) => setChosenFeatureChoices((prev) => ({ ...prev, [choiceKey]: [optionId] }))}
          />
        </Section>
      )}

      <LevelUpSubclassSection
        show={showSubclassChoice}
        nextLevel={nextLevel}
        accentColor={accentColor}
        subclass={subclass}
        subclassOptions={subclassOptions}
        subclassOverview={subclassOverview}
        selectedSubclassFeatures={selectedSubclassFeatures}
        onSelectSubclass={setSubclass}
      />

      <LevelUpChoicesSection
        show={classChoiceGroups.length > 0 || cantripCount > 0 || prepCount > 0 || invocCount > 0 || featSpellListChoices.length > 0 || featResolvedSpellChoices.length > 0 || classFeatureResolvedSpellChoices.length > 0 || classFeatureProficiencyChoices.length > 0 || invocationResolvedSpellChoices.length > 0 || maneuverChoiceEntries.length > 0 || planChoiceEntries.length > 0 || progressionTableChoiceEntries.length > 0}
        nextLevel={nextLevel}
        accentColor={accentColor}
        progressionTableChoiceEntries={progressionTableChoiceEntries}
        classChoiceGroups={classChoiceGroups}
        classFeatureProficiencyChoices={classFeatureProficiencyChoices}
        chosenFeatureChoices={chosenFeatureChoices}
        existingSkillKeys={classFeatureSkillKeys}
        existingToolKeys={classFeatureToolKeys}
        existingLanguageKeys={classFeatureLanguageKeys}
        existingSaveKeys={classFeatureSaveKeys}
        cantripChoiceCount={cantripChoiceCount}
        availableCantripChoices={availableCantripChoices}
        displayedChosenCantrips={displayedChosenCantrips}
        globallyChosenSpellChoiceIds={globallyChosenSpellChoiceIds}
        globallyChosenSpellChoiceNames={globallyChosenSpellChoiceNames}
        lockedCantripIds={lockedCantripIds}
        classCantrips={classCantrips}
        preparedSpellProgressionGrantedKeys={preparedSpellProgressionGrantedKeys}
        spellcaster={spellcaster}
        spellChoiceCount={spellChoiceCount}
        usesFlexiblePreparedSpellsModel={usesFlexiblePreparedSpellsModel}
        prepCount={prepCount}
        maxSpellLevel={maxSpellLevel}
        availableSpellChoices={availableSpellChoices}
        displayedChosenSpells={displayedChosenSpells}
        lockedSpellIds={lockedSpellIds}
        classSpells={classSpells}
        invocCount={invocCount}
        invocationChoiceCount={invocationChoiceCount}
        availableInvocationChoices={availableInvocationChoices}
        displayedChosenInvocations={displayedChosenInvocations}
        lockedInvocationIds={lockedInvocationIds}
        lockedInvocationSelectionIds={lockedInvocationSelectionIds}
        allowedInvocationIds={allowedInvocationIds}
        maneuverChoiceEntries={maneuverChoiceEntries}
        planChoiceEntries={planChoiceEntries}
        growthOptionEntriesByKey={growthOptionEntriesByKey}
        featSpellListChoices={featSpellListChoices}
        featResolvedSpellChoices={featResolvedSpellChoices}
        classFeatureResolvedSpellChoices={classFeatureResolvedSpellChoices}
        invocationResolvedSpellChoices={invocationResolvedSpellChoices}
        invocationFeatChoices={invocationFeatChoices}
        invocationGrantedFeatChoices={invocationGrantedFeatChoices}
        featSpellChoiceOptions={featSpellChoiceOptions}
        classFeatureSpellChoiceOptions={classFeatureSpellChoiceOptions}
        invocationSpellChoiceOptions={invocationSpellChoiceOptions}
        chosenFeatOptions={chosenFeatOptions}
        normalizeSpellTrackingKey={normalizeSpellTrackingKey}
        toggleSelection={toggleSelection}
        setChosenCantrips={setChosenCantrips}
        setChosenSpells={setChosenSpells}
        setChosenInvocations={setChosenInvocations}
        setChosenFeatureChoices={setChosenFeatureChoices}
        setChosenFeatOptions={setChosenFeatOptions}
        extraFeatSpellSelectionsValid={allExtraSelectionsValid}
      />

      {/* ── New features ── */}

      <LevelUpFeaturesSection
        nextLevel={nextLevel}
        accentColor={accentColor}
        newFeatures={newFeatures.filter((feature) => !feature.hidden)}
        expandedFeatures={expandedFeatures}
        onToggleFeature={(key) =>
          setExpandedFeatures((prev) =>
            prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]
          )
        }
      />

      <LevelUpSpellSlotsSection
        nextLevel={nextLevel}
        accentColor={accentColor}
        newSlots={newSlots}
      />

      {/* ── Confirm ── */}
      {blockers.length > 0 ? (
        <div
          role="status"
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${withAlpha(C.colorGold, 0.35)}`,
            background: withAlpha(C.colorGold, 0.08),
            color: C.text,
            fontSize: "var(--fs-small)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {translateUi("Before you can level up:")}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
            {blockers.map((blocker) => <li key={blocker}>{blockerMessages[blocker]}</li>)}
          </ul>
        </div>
      ) : null}

      <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
        <Button type="button" variant="ghost" onClick={() => navigate(`/characters/${char.id}`)}>
          {translateUi("Cancel")}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={confirm}
          disabled={!canConfirm || !allExtraSelectionsValid || saving}
          style={{ flex: 1 }}
        >
          {saving ? translateUi("Saving…") : translateUi("⬆ Level Up to {{value1}}", { value1: nextLevel })}
        </Button>
      </div>
    </Wrap>
  );
}
