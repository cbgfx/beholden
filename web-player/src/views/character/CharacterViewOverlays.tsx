import { CharacterInitiativePrompt } from "@/views/character/CharacterInitiativePrompt";
import { CharacterFeatPickerModal } from "@/views/character/CharacterFeatPickerModal";
import { CharacterInfoDrawer, CharacterPolymorphDrawer } from "@/views/character/CharacterViewDrawers";
import { NoteEditDrawer } from "@/views/character/CharacterViewParts";
import { SHEET_COLOR_PRESETS } from "@/views/character/CharacterViewHelpers";
import { getExhaustionD20Penalty } from "@/views/character/CharacterExhaustion";
import type { CharacterViewModel } from "@/views/character/CharacterViewModel";
import { EngagedEnemiesDrawer } from "@/views/character/EngagedEnemiesDrawer";

export function CharacterViewOverlays({ model }: { model: CharacterViewModel }) {
  const {
    derived, ui, notes, live, polymorphControls,
    handleAddFeat, applyPolymorphSelf,
  } = model;
  const { currentCharacterData } = derived;
  const initiativePenalty = getExhaustionD20Penalty(currentCharacterData.exhaustion ?? 0);

  return (
    <>
      <CharacterFeatPickerModal
        isOpen={ui.featPickerOpen}
        accentColor={derived.accentColor}
        currentFeatIds={currentCharacterData.extraFeatIds ?? []}
        existingFeatureNames={derived.classFeaturesList.map((feature) => feature.name)}
        onClose={() => ui.setFeatPickerOpen(false)}
        onAdd={(feat, abilityChoices) => { void handleAddFeat(feat, abilityChoices); }}
      />

      {live.initiativePrompt && (
        <CharacterInitiativePrompt
          encounterId={live.initiativePrompt.encounterId}
          combatantId={live.initiativePrompt.combatantId}
          initiativeBonus={(derived.transformedCombatStats?.initiativeBonus ?? derived.initiativeBonus) - initiativePenalty}
          accentColor={derived.accentColor}
          onClose={() => void live.dismissInitiativePrompt(live.initiativePrompt!.combatantId)}
          onSubmitted={() => { void live.refreshInitiativePrompt(); }}
        />
      )}

      <CharacterPolymorphDrawer
        open={ui.polymorphDrawerOpen}
        accentColor={derived.accentColor}
        polymorphQuery={polymorphControls.polymorphQuery}
        polymorphTypeFilter={polymorphControls.polymorphTypeFilter}
        polymorphCrMax={polymorphControls.polymorphCrMax}
        polymorphTypeOptions={polymorphControls.polymorphTypeOptions}
        polymorphRowsBusy={polymorphControls.polymorphRowsBusy}
        polymorphRowsError={polymorphControls.polymorphRowsError}
        filteredPolymorphRows={polymorphControls.filteredPolymorphRows}
        polymorphApplyingId={ui.polymorphApplyingId}
        onClose={() => ui.setPolymorphDrawerOpen(false)}
        onQueryChange={polymorphControls.setPolymorphQuery}
        onTypeFilterChange={polymorphControls.setPolymorphTypeFilter}
        onCrMaxChange={polymorphControls.setPolymorphCrMax}
        onApply={applyPolymorphSelf}
      />

      {ui.noteDrawer && (
        <NoteEditDrawer
          scope={ui.noteDrawer.scope}
          note={ui.noteDrawer.note}
          accentColor={derived.accentColor}
          onSave={notes.handleNoteSave}
          onDelete={ui.noteDrawer.note
            ? () => {
                notes.handleNoteDelete(ui.noteDrawer!.scope, ui.noteDrawer!.note!.id);
                ui.setNoteDrawer(null);
              }
            : undefined}
          onClose={() => ui.setNoteDrawer(null)}
        />
      )}

      <CharacterInfoDrawer
        open={ui.infoDrawerOpen}
        accentColor={derived.accentColor}
        identityFields={derived.identityFields}
        editableOverrideFields={derived.editableOverrideFields}
        overridesDraft={ui.overridesDraft}
        colorDraft={ui.colorDraft}
        colorPresets={SHEET_COLOR_PRESETS}
        abilityOverridesDraft={ui.abilityOverridesDraft}
        overridesSaving={ui.overridesSaving}
        onClose={() => ui.setInfoDrawerOpen(false)}
        onSave={() => notes.saveSheetOverrides()}
        onColorChange={ui.setColorDraft}
        onOverrideChange={(key, value) => {
          ui.setOverridesDraft((previous) => ({ ...previous, [key]: value }));
        }}
        onAbilityOverrideChange={(key, value) => {
          ui.setAbilityOverridesDraft((previous) => {
            const next = { ...previous };
            if (value == null || !Number.isFinite(value)) delete next[key];
            else next[key] = Math.floor(value);
            return next;
          });
        }}
      />

      <EngagedEnemiesDrawer
        open={ui.engagedEnemiesDrawerOpen}
        enemies={live.combatStatus?.engagedEnemies ?? []}
        onClose={() => ui.setEngagedEnemiesDrawerOpen(false)}
      />
    </>
  );
}
