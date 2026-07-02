import { C } from "@/lib/theme";
import {
  CharacterActionColumn,
  CharacterInventoryColumn,
  CharacterPrimaryColumn,
  CharacterSupportColumn,
} from "@/views/character/CharacterViewColumns";
import { CharacterSheetHeader } from "@/views/character/CharacterSheetHeader";
import { abilityMod, formatModifier } from "@/views/character/CharacterSheetUtils";
import { getExhaustionD20Penalty } from "@/views/character/CharacterExhaustion";
import { Wrap } from "@/views/character/CharacterViewParts";
import { CharacterViewOverlays } from "@/views/character/CharacterViewOverlays";
import type { CharacterViewModel } from "@/views/character/CharacterViewModel";

export function CharacterViewLayout({ model }: { model: CharacterViewModel }) {
  const {
    char, data, derived, ui, notes, runtime, hpActions, live,
    polymorphCondition, polymorphMonsterState, combatProps, handlePortraitSelected,
    handleRemoveExtraFeat,
  } = model;
  const currentData = derived.currentCharacterData;
  const exhaustionPenalty = getExhaustionD20Penalty(currentData.exhaustion ?? 0);
  const identityLabels = [
    char.className,
    currentData.classes?.[0]?.subclass,
    char.species,
  ].filter((item): item is string => Boolean(item));

  return (
    <Wrap wide minWidth={ui.sheetView === "all" ? 1760 : ui.sheetView === "play" ? 1260 : 880}>
      <input ref={ui.portraitFileRef} type="file" accept="image/*" hidden onChange={handlePortraitSelected} />
      {ui.concentrationAlert && (
        <div style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(240, 165, 0, 0.15)", border: `1px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: C.text, fontWeight: 700 }}>
            ⚠️ You are Concentrating — CON Save DC <strong>{ui.concentrationAlert.dc}</strong>
          </span>
          <button type="button" aria-label="Dismiss concentration reminder" onClick={() => ui.setConcentrationAlert(null)} style={{ all: "unset", cursor: "pointer", color: C.muted, fontWeight: 900, fontSize: "var(--fs-title)", lineHeight: 1 }}>×</button>
        </div>
      )}
      <CharacterSheetHeader
        character={char}
        identityLabels={identityLabels}
        campaigns={char.campaigns}
        accentColor={derived.accentColor}
        portraitUploading={ui.portraitUploading}
        onSelectPortrait={() => ui.portraitFileRef.current?.click()}
        onOpenInfo={() => ui.setInfoDrawerOpen(true)}
        sheetView={ui.sheetView}
        onSheetViewChange={(view) => {
          ui.setSheetView(view);
          try { localStorage.setItem("character-sheet:view", view); } catch { /* ignore */ }
        }}
        activeBastion={live.activeBastion}
        xpEarned={derived.xpEarned}
        xpNeeded={derived.xpNeeded}
        xpInput={ui.xpInput}
        xpPopupOpen={ui.xpPopupOpen}
        setXpInput={ui.setXpInput}
        setXpPopupOpen={ui.setXpPopupOpen}
        saveXp={runtime.saveXp}
      />

      <div style={{
        display: "grid",
        gridTemplateColumns: ui.sheetView === "all"
          ? "repeat(4, minmax(420px, 1fr))"
          : ui.sheetView === "play"
            ? "minmax(390px, 0.95fr) minmax(460px, 1.15fr) minmax(390px, 0.95fr)"
            : "minmax(390px, 0.9fr) minmax(460px, 1.1fr)",
        gap: 16,
        alignItems: "flex-start",
      }}>
        <CharacterPrimaryColumn
          combatProps={combatProps}
          hudProps={{
            char,
            accentColor: derived.accentColor,
            effectiveHpMax: derived.effectiveHpMax,
            tempHp: derived.tempHp,
            hpError: ui.hpError,
            hpSaving: ui.hpSaving,
            hpAmount: ui.hpAmount,
            hd: derived.hd,
            lastRoll: ui.lastRoll,
            hpInputRef: ui.hpInputRef,
            setHpError: ui.setHpError,
            setLastRoll: ui.setLastRoll,
            setHpAmount: ui.setHpAmount,
            handleApplyHp: hpActions.handleApplyHp,
            inspirationActive: derived.overrides.inspiration ?? false,
            handleToggleInspiration: runtime.handleToggleInspiration,
            condPickerOpen: ui.condPickerOpen,
            setCondPickerOpen: ui.setCondPickerOpen,
            condSaving: ui.condSaving,
            toggleCondition: runtime.toggleCondition,
            dsSaving: ui.dsSaving,
            saveDeathSaves: runtime.saveDeathSaves,
            hpMaxBonus: derived.overrides.hpMaxBonus ?? 0,
            concentrationSpell: currentData.concentrationSpell ?? null,
            onConcentrationSpellChange: (spell) => { void notes.saveCharacterData({ ...currentData, concentrationSpell: spell }); },
            concentrationSpellNames: Array.from(new Set([
              ...derived.grantedSpellData.spells.map((spell) => spell.spellName),
              ...(derived.prof?.spells ?? []).map((spell) => spell.name),
            ])).sort((a, b) => a.localeCompare(b)),
          }}
          abilitiesProps={{
            scores: derived.scores,
            scoreExplanations: derived.scoreExplanations,
            pb: derived.pb,
            prof: derived.prof,
            saveBonuses: derived.saveBonuses,
            skillBonuses: derived.skillBonuses,
            abilityCheckAdvantages: derived.abilityCheckAdvantages,
            abilityCheckDisadvantages: derived.abilityCheckDisadvantages,
            saveAdvantages: derived.saveAdvantages,
            saveDisadvantages: derived.saveDisadvantages,
            skillAdvantages: derived.skillAdvantages,
            skillDisadvantages: derived.skillDisadvantages,
            accentColor: derived.accentColor,
            stealthDisadvantage: derived.stealthDisadvantage,
            nonProficientArmorPenalty: derived.nonProficientArmorPenalty,
            hasJackOfAllTrades: derived.hasJackOfAllTrades,
            d20TestPenalty: exhaustionPenalty,
            mod: abilityMod,
            fmtMod: formatModifier,
          }}
          defensesProps={{
            resistances: derived.parsedDefenses.resistances,
            damageImmunities: derived.parsedDefenses.damageImmunities,
            conditionImmunities: derived.parsedDefenses.conditionImmunities,
            senses: derived.senses,
            customResistances: currentData.customResistances ?? [],
            customImmunities: currentData.customImmunities ?? [],
            accentColor: derived.accentColor,
            onCustomResistancesChange: (value) => { void notes.saveCustomResistances(value); },
            onCustomImmunitiesChange: (value) => { void notes.saveCustomImmunities(value); },
          }}
          proficienciesProps={{
            prof: derived.prof,
            accentColor: derived.accentColor,
            customTools: currentData.customTools ?? [],
            customLanguages: currentData.customLanguages ?? [],
            onCustomToolsChange: (value) => { void notes.saveCustomTools(value); },
            onCustomLanguagesChange: (value) => { void notes.saveCustomLanguages(value); },
          }}
        />

        {(ui.sheetView === "play" || ui.sheetView === "all") && (
          <CharacterActionColumn
            combatProps={combatProps}
            polymorphed={Boolean(polymorphCondition)}
            polymorphMonsterState={polymorphMonsterState}
            itemSpellsProps={{
              items: derived.inventory,
              pb: derived.pb,
              intScore: derived.scores.int,
              wisScore: derived.scores.wis,
              chaScore: derived.scores.cha,
              accentColor: derived.accentColor,
              onChargeChange: runtime.handleItemChargeChange,
              spellcastingBlocked: derived.nonProficientArmorPenalty,
              spellSaveDcBonus: derived.spellSaveDcBonus,
            }}
            richSpellsProps={{
              spells: derived.prof?.spells ?? [],
              grantedSpells: derived.grantedSpellData.spells,
              resources: derived.classResourcesWithSpellCasts,
              pb: derived.pb,
              scores: derived.scores,
              accentColor: derived.accentColor,
              classDetail: data.classDetail,
              charLevel: char.level,
              preparedLimit: derived.preparedSpellLimit,
              usesFlexiblePreparedList: derived.usesFlexiblePreparedList,
              usedSpellSlots: currentData.usedSpellSlots ?? {},
              preparedSpells: derived.preparedSpells,
              onSlotsChange: runtime.saveUsedSpellSlots,
              onPreparedChange: runtime.savePreparedSpells,
              onAddSpell: runtime.addTrackedSpell,
              onRemoveSpell: runtime.removeTrackedSpell,
              addSpellSourceLabel: data.classDetail?.name ?? char.className ?? "Manual",
              onResourceChange: runtime.changeResourceCurrent,
              spellcastingBlocked: derived.nonProficientArmorPenalty,
              spellDamageBonuses: derived.invocationSpellDamageBonuses,
              spellSaveDcBonus: derived.spellSaveDcBonus,
            }}
          />
        )}

        {(ui.sheetView === "gear" || ui.sheetView === "all") && (
          <CharacterInventoryColumn inventoryProps={{
            char,
            charData: char.characterData,
            parsedFeatureEffects: derived.parsedFeatureEffects,
            accentColor: derived.accentColor,
            campaignId: char.campaigns[0]?.campaignId ?? null,
            onSave: notes.saveCharacterData,
          }} />
        )}

        {(ui.sheetView === "play" || ui.sheetView === "reference" || ui.sheetView === "all") && (
          <CharacterSupportColumn
            accentColor={derived.accentColor}
            hasCampaign={char.campaigns.length > 0}
            hitDiceCurrent={derived.hitDiceCurrent}
            hitDiceMax={derived.hitDiceMax}
            hitDieSize={derived.hitDieSize}
            hitDieConMod={derived.conMod}
            exhaustion={currentData.exhaustion ?? 0}
            classResources={derived.classResourcesWithSpellCasts}
            playerNotesList={notes.playerNotesList}
            allSharedNotes={notes.allSharedNotes}
            classFeaturesList={derived.classFeaturesList}
            expandedNoteIds={ui.expandedNoteIds}
            expandedClassFeatureIds={ui.expandedClassFeatureIds}
            onSaveHitDiceCurrent={runtime.saveHitDiceCurrent}
            onShortRest={runtime.handleShortRest}
            onLongRest={runtime.handleLongRest}
            onExhaustionChange={(value) => { void notes.saveCharacterData({ ...currentData, exhaustion: value }); }}
            onChangeResourceCurrent={runtime.changeResourceCurrent}
            onOpenPlayerNoteCreate={() => ui.setNoteDrawer({ scope: "player", note: null })}
            onOpenSharedNoteCreate={() => ui.setNoteDrawer({ scope: "shared", note: null })}
            onToggleNoteExpanded={notes.toggleNoteExpanded}
            onToggleClassFeatureExpanded={notes.toggleClassFeatureExpanded}
            onOpenPlayerNoteEdit={(note) => ui.setNoteDrawer({ scope: "player", note })}
            onOpenSharedNoteEdit={(note) => ui.setNoteDrawer({ scope: "shared", note })}
            onDeletePlayerNote={(id) => notes.handleNoteDelete("player", id)}
            onDeleteSharedNote={(id) => notes.handleNoteDelete("shared", id)}
            onSavePlayerNotesOrder={(list) => { void notes.savePlayerNotesList(list); }}
            onSaveSharedNotesOrder={notes.saveSharedNotesList}
            showReferenceContent={ui.sheetView !== "play"}
            creaturesProps={ui.sheetView === "play" || ui.sheetView === "all" ? {
              charData: char.characterData,
              accentColor: derived.accentColor,
              onSave: notes.saveCharacterData,
            } : undefined}
            polymorphName={derived.polymorphName || null}
            onOpenTransformSelf={() => ui.setPolymorphDrawerOpen(true)}
            onRevertTransformSelf={polymorphCondition ? () => { void runtime.toggleCondition("polymorphed"); } : undefined}
            onOpenFeatPicker={() => ui.setFeatPickerOpen(true)}
            onRemoveExtraFeat={handleRemoveExtraFeat}
          />
        )}
      </div>

      <CharacterViewOverlays model={model} />
    </Wrap>
  );
}
