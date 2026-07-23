import React, { useState } from "react";
import { useInvocationGrantedFeatChoices } from "@/views/shared/useInvocationGrantedFeatChoices";
import { useNavigate, useParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import type {
  AsiMode,
  HpChoice,
} from "@/views/level-up/LevelUpTypes";
import { AsiAbilityGrid, BackBtn, ChoiceBtn, ExclusiveChoiceReplacementSection, ExpertiseReplacementSection, ExpertiseSelectionSection, FeatSelectionSection, LevelUpHpSection, Section, Wrap } from "@/views/level-up/LevelUpParts";
import { LevelUpChoicesSection, LevelUpFeaturesSection, LevelUpSpellSlotsSection, LevelUpSubclassSection } from "@/views/level-up/LevelUpSections";
import { deriveFeatAbilityBonuses, deriveHpGain, deriveLevelUpValidation } from "@/views/level-up/LevelUpUtils";
import { deriveFeatHitPointMaxBonus } from "@/domain/character/featEffects";
import { useLevelUpInitialData } from "@/views/level-up/useLevelUpInitialData";
import { useLevelUpDerivedState } from "@/views/level-up/useLevelUpDerivedState";
import { useLevelUpChoiceSelections } from "@/views/level-up/useLevelUpChoiceSelections";
import { useLevelUpSelectionSanitizers } from "@/views/level-up/useLevelUpSelectionSanitizers";
import { useLevelUpSubmit } from "@/views/level-up/useLevelUpSubmit";
import { useLevelUpActions } from "@/views/level-up/useLevelUpActions";
import { describeMulticlassRequirement, multiclassRequirementMet } from "@/domain/character/multiclassEligibility";

export function LevelUpView() {
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
  }, [char?.id]);

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
    existingClassInvocationNames,
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
    existingClassSpellNames,
    existingClassInvocationNames,
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
    existingClassInvocationNames,
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

  const { filteredFeatSummaries, featPrereqsMet, featRepeatableValid, canConfirm: baseCanConfirm } = React.useMemo(
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
      <Section title="Class level" accent={accentColor}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {classEntries.map((entry) => <ChoiceBtn key={entry.id} active={targetClassKey === entry.id} onClick={() => setTargetClassKey(entry.id)} accent={accentColor}>{entry.className ?? ownedClassDetails[entry.id]?.name ?? "Class"} {entry.level} → {entry.level + 1}</ChoiceBtn>)}
          {classCatalog.filter((option) => !classEntries.some((entry) => entry.classId === option.id)).map((option) => <ChoiceBtn key={option.id} active={targetClassKey === `new:${option.id}`} onClick={() => setTargetClassKey(`new:${option.id}`)} accent={accentColor}>Add {option.name}</ChoiceBtn>)}
        </div>
        {isAddingClass && <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: "var(--fs-small)" }}>
          {multiclassRequirements.map((requirement) => <div key={`${requirement.name}:${requirement.label}`} style={{ color: requirement.met ? C.green : C.red }}>{requirement.met ? "✓" : "✕"} {requirement.name}: {requirement.label}</div>)}
          {multiclassSkillCount > 0 && <div><div style={{ color: C.muted, marginBottom: 6 }}>Choose {multiclassSkillCount} skill proficiency</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(classDetail?.multiclass?.skills?.from ?? []).map((name) => <ChoiceBtn key={name} active={chosenMulticlassSkills.includes(name)} onClick={() => setChosenMulticlassSkills((current) => current.includes(name) ? current.filter((value) => value !== name) : current.length < multiclassSkillCount ? [...current, name] : current)}>{name}</ChoiceBtn>)}</div></div>}
          {multiclassToolCount > 0 && <div><div style={{ color: C.muted, marginBottom: 6 }}>Choose {multiclassToolCount} tool proficiency</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Array.from(new Set((classDetail?.multiclass?.tools?.choices ?? []).flatMap((choice) => choice.from))).map((name) => <ChoiceBtn key={name} active={chosenMulticlassTools.includes(name)} onClick={() => setChosenMulticlassTools((current) => current.includes(name) ? current.filter((value) => value !== name) : current.length < multiclassToolCount ? [...current, name] : current)}>{name}</ChoiceBtn>)}</div></div>}
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
        <Section title={`Expertise at Level ${nextLevel}`} accent={accentColor}>
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
        <Section title={`Expertise Replacement at Level ${nextLevel}`} accent={accentColor}>
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
        <Section title={`Fighting Style at Level ${nextLevel}`} accent={accentColor}>
          <ExclusiveChoiceReplacementSection
            accentColor={accentColor}
            title="Optionally replace your Fighting Style"
            choice={fightingStyleReplacementChoice}
            chosenFeatureChoices={chosenFeatureChoices}
            onSelect={(choiceKey, optionId) => setChosenFeatureChoices((prev) => ({ ...prev, [choiceKey]: [optionId] }))}
          />
        </Section>
      )}

      {pactBoonReplacementChoice && pactBoonReplacementChoice.options.length > 0 && (
        <Section title={`Pact Boon at Level ${nextLevel}`} accent={accentColor}>
          <ExclusiveChoiceReplacementSection
            accentColor={accentColor}
            title="Optionally replace your Pact Boon"
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
        newFeatures={newFeatures}
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
          disabled={!canConfirm || !allExtraSelectionsValid || saving}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 10, cursor: canConfirm && allExtraSelectionsValid && !saving ? "pointer" : "not-allowed",
            fontSize: "var(--fs-medium)", fontWeight: 800, border: "none",
            background: canConfirm && allExtraSelectionsValid ? accentColor : "rgba(255,255,255,0.08)",
            color: canConfirm && allExtraSelectionsValid ? "#fff" : C.muted,
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
