import { Fragment, useCallback, useEffect, useMemo, useRef } from "react";
import { C } from "@/lib/theme";
import {
  PinnedVitalsBox,
  PolymorphedFormPanel,
  buildActionColumnPanels,
  buildInventoryColumnPanels,
  buildPrimaryColumnPanels,
  buildSupportColumnPanels,
  type CharacterPanelRegistry,
} from "@/views/character/CharacterViewColumns";
import { MOVABLE_PANEL_IDS, PANEL_IDS, type PanelId, type SheetViewDef } from "@/views/character/panelRegistry";
import { DEFAULT_SHEET_VIEWS } from "@/views/character/defaultSheetViews";
import { CharacterSheetHeader } from "@/views/character/CharacterSheetHeader";
import { abilityMod, formatModifier } from "@/views/character/CharacterSheetUtils";
import { isSpellLinkedResource } from "@/views/character/CharacterViewResourceHelpers";
import { getExhaustionD20Penalty } from "@/views/character/CharacterExhaustion";
import { Wrap } from "@/views/character/CharacterViewParts";
import { CharacterViewOverlays } from "@/views/character/CharacterViewOverlays";
import { usePanelDragAndDrop, SIDEBAR_ZONE_ID } from "@/views/character/usePanelDragAndDrop";
import { PanelCard } from "@/views/character/CharacterPanelCard";
import { PanelDragGhost } from "@/views/character/CharacterPanelDragGhost";
import { uid } from "@/views/character/CharacterViewHelpers";
import { cloneSheetView, MAX_SHEET_COLUMNS, MIN_SHEET_COLUMNS } from "@/views/character/sheetViewLayout";
import { useCharacterSheetViews } from "@/views/character/useCharacterSheetViews";
import type { CharacterViewModel } from "@/views/character/CharacterViewModel";
import { CharacterLayoutEditorToolbar } from "@/views/character/CharacterLayoutEditorToolbar";

/** Combat (Play) and All can never be deleted, even when other views exist --
 * every other built-in or custom view can be. */
const PROTECTED_VIEW_IDS = new Set(["play", "all"]);

export function CharacterViewLayout({ model }: { model: CharacterViewModel }) {
  const {
    char, data, derived, ui, notes, runtime, hpActions, live,
    polymorphCondition, polymorphMonsterState, combatProps, handlePortraitSelected,
    handleRemoveExtraFeat,
  } = model;
  const currentData = derived.currentCharacterData;
  const exhaustionPenalty = getExhaustionD20Penalty(char.ruleset, currentData.exhaustion ?? 0);
  const identityLabels = [
    ...(derived.classPresentation.length
      ? derived.classPresentation.map((entry) => `${entry.className} ${entry.classLevel}${entry.subclassName ? ` · ${entry.subclassName}` : ""}`)
      : [char.className]),
    char.species,
  ].filter((item): item is string => Boolean(item));

  const hasCampaign = char.campaigns.length > 0;

  const setSheetView = ui.setSheetView;
  const selectView = useCallback((id: string) => {
    setSheetView(id);
    try { localStorage.setItem("character-sheet:view", id); } catch { /* ignore */ }
  }, [setSheetView]);
  const { views: sheetViews, activeView, updateViews } = useCharacterSheetViews({
    storedViews: currentData.sheetViews,
    activeViewId: ui.sheetView,
    onActiveViewChange: selectView,
    onSave: (views) => notes.saveCharacterData({ sheetViews: views }),
  });

  const isProtectedView = PROTECTED_VIEW_IDS.has(activeView.id);
  const canDeleteActiveView = sheetViews.length > 1 && !isProtectedView;
  const canResetActiveView = DEFAULT_SHEET_VIEWS.some((view) => view.id === activeView.id);

  const inCombat = live.combatStatus !== null;
  const isMyTurn = live.combatStatus !== null && live.combatStatus.activeCombatantId === live.combatStatus.combatantId;

  // Jump to the Combat layout the moment combat starts, so players aren't
  // caught mid-fight on a view that's missing their action economy panels.
  // Edge-triggered on the false->true transition only -- reloading the sheet
  // while already in combat should never fight whatever view the player had
  // open.
  const wasInCombatRef = useRef(inCombat);
  useEffect(() => {
    if (!wasInCombatRef.current && inCombat) {
      selectView("play");
    }
    wasInCombatRef.current = inCombat;
  }, [inCombat, selectView]);

  const handleCreateView = () => {
    const newView: SheetViewDef = { id: uid(), name: "New View", columns: 2, layout: [[], []] };
    updateViews((views) => [...views, newView]);
    selectView(newView.id);
    ui.setLayoutEditMode(true);
  };
  const handleRenameActiveView = (name: string) => {
    if (isProtectedView) return;
    persistActiveView((view) => ({ ...view, name }));
  };
  const handleDuplicateActiveView = () => {
    const copy: SheetViewDef = { ...cloneSheetView(activeView), id: uid(), name: `${activeView.name} Copy` };
    updateViews((views) => [...views, copy]);
    selectView(copy.id);
  };
  const handleDeleteActiveView = () => {
    if (!canDeleteActiveView) return;
    const nextActiveId = (sheetViews.find((view) => view.id === "play")
      ?? sheetViews.find((view) => view.id !== activeView.id))?.id;
    updateViews((views) => views.filter((view) => view.id !== activeView.id));
    if (nextActiveId) selectView(nextActiveId);
  };

  const primaryPanels = buildPrimaryColumnPanels({
    abilitiesProps: {
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
      onOpenPermanentBuffs: () => ui.setPermanentBuffsDrawerOpen(true),
    },
    defensesProps: {
      resistances: derived.parsedDefenses.resistances,
      damageImmunities: derived.parsedDefenses.damageImmunities,
      conditionImmunities: derived.parsedDefenses.conditionImmunities,
      senses: derived.senses,
      customResistances: currentData.customResistances ?? [],
      customImmunities: currentData.customImmunities ?? [],
      accentColor: derived.accentColor,
      onCustomResistancesChange: (value) => { void notes.saveCustomResistances(value); },
      onCustomImmunitiesChange: (value) => { void notes.saveCustomImmunities(value); },
    },
    proficienciesProps: {
      prof: derived.prof,
      accentColor: derived.accentColor,
      customTools: currentData.customTools ?? [],
      customLanguages: currentData.customLanguages ?? [],
      onCustomToolsChange: (value) => { void notes.saveCustomTools(value); },
      onCustomLanguagesChange: (value) => { void notes.saveCustomLanguages(value); },
    },
  });

  const actionPanels = buildActionColumnPanels({
    combatProps,
    itemSpellsProps: {
      items: derived.inventory,
      pb: derived.pb,
      intScore: derived.scores.int,
      wisScore: derived.scores.wis,
      chaScore: derived.scores.cha,
      accentColor: derived.accentColor,
      onChargeChange: runtime.handleItemChargeChange,
      spellcastingBlocked: derived.nonProficientArmorPenalty,
      spellSaveDcBonus: derived.spellSaveDcBonus,
      conditions: char.conditions ?? [],
      onToggleCondition: runtime.toggleCondition,
    },
    richSpellsProps: {
      spells: derived.prof?.spells ?? [],
      grantedSpells: derived.grantedSpellData.spells,
      resources: derived.classResourcesWithSpellCasts,
      pb: derived.pb,
      scores: derived.scores,
      accentColor: derived.accentColor,
      classDetail: data.classDetail,
      ruleset: char.ruleset,
      spellSlotState: derived.spellSlotState,
      classSpellcastingStates: derived.classSpellcastingStates,
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
      spellDamageBonuses: derived.spellDamageAbilityBonuses,
      spellSaveDcBonus: derived.spellSaveDcBonus,
      conditions: char.conditions ?? [],
      onToggleCondition: runtime.toggleCondition,
    },
  });

  const inventoryPanels = buildInventoryColumnPanels({
    inventoryProps: {
      char: { ...char, chaScore: derived.scores.cha },
      charData: char.characterData,
      proficiencies: derived.prof,
      parsedFeatureEffects: derived.parsedFeatureEffects,
      accentColor: derived.accentColor,
      campaignId: char.campaigns[0]?.campaignId ?? null,
      onSave: notes.saveCharacterData,
    },
  });

  const supportPanels = buildSupportColumnPanels({
    recoveryProps: {
      accentColor: derived.accentColor,
      hitDiceCurrent: derived.hitDiceCurrent,
      hitDiceMax: derived.hitDiceMax,
      hitDieSize: derived.hitDieSize,
      hitDicePools: derived.hitDicePools,
      hitDieConMod: derived.conMod,
      exhaustion: currentData.exhaustion ?? 0,
      ruleset: char.ruleset,
      classResources: derived.classResourcesWithSpellCasts.filter((resource) => {
        return !isSpellLinkedResource({
          resource,
          grantedSpells: derived.grantedSpellData.spells,
          spellLinkedResourceKeys: derived.spellLinkedResourceKeys,
        });
      }),
      reactionUsed: live.combatStatus?.usedReaction ?? null,
      classPresentation: derived.classPresentation,
      onSaveHitDiceCurrent: runtime.saveHitDiceCurrent,
      onSaveHitDicePoolCurrent: runtime.saveHitDicePoolCurrent,
      onShortRest: runtime.handleShortRest,
      onLongRest: runtime.handleLongRest,
      onExhaustionChange: (value) => { void notes.saveCharacterData({ exhaustion: value }); },
      onChangeResourceCurrent: runtime.changeResourceCurrent,
      polymorphName: derived.polymorphName || null,
      onOpenTransformSelf: () => ui.setPolymorphDrawerOpen(true),
      onRevertTransformSelf: polymorphCondition ? () => { void runtime.toggleCondition("polymorphed"); } : undefined,
    },
    playerNotesProps: {
      accentColor: derived.accentColor,
      playerNotesList: notes.playerNotesList,
      expandedNoteIds: ui.expandedNoteIds,
      onOpenPlayerNoteCreate: () => ui.setNoteDrawer({ scope: "player", note: null }),
      onToggleNoteExpanded: notes.toggleNoteExpanded,
      onOpenPlayerNoteEdit: (note) => ui.setNoteDrawer({ scope: "player", note }),
      onDeletePlayerNote: (id) => notes.handleNoteDelete("player", id),
      onSavePlayerNotesOrder: (list) => { void notes.savePlayerNotesList(list); },
    },
    sharedNotesProps: hasCampaign ? {
      accentColor: derived.accentColor,
      allSharedNotes: notes.allSharedNotes,
      expandedNoteIds: ui.expandedNoteIds,
      onOpenSharedNoteCreate: () => ui.setNoteDrawer({ scope: "shared", note: null }),
      onToggleNoteExpanded: notes.toggleNoteExpanded,
      onOpenSharedNoteEdit: (note) => ui.setNoteDrawer({ scope: "shared", note }),
      onDeleteSharedNote: (id) => notes.handleNoteDelete("shared", id),
      onSaveSharedNotesOrder: notes.saveSharedNotesList,
    } : null,
    classFeaturesProps: {
      accentColor: derived.accentColor,
      classFeaturesList: derived.classFeaturesList,
      classPresentation: derived.classPresentation,
      acquisitionLevels: derived.acquisitionLevels,
      expandedClassFeatureIds: ui.expandedClassFeatureIds,
      onToggleClassFeatureExpanded: notes.toggleClassFeatureExpanded,
      onOpenFeatPicker: () => ui.setFeatPickerOpen(true),
      onRemoveExtraFeat: handleRemoveExtraFeat,
    },
    // Built unconditionally now -- whether Creatures is *visible* is purely a
    // matter of whether the active view's layout places it, same as every
    // other panel, not a sheetView-specific runtime gate.
    creaturesProps: {
      charData: char.characterData,
      accentColor: derived.accentColor,
      onSave: notes.saveCharacterData,
    },
    countersProps: {
      counters: currentData.counters ?? [],
      accentColor: derived.accentColor,
      onSave: (counters) => notes.saveCharacterData({ counters }),
    },
  });

  const registry: CharacterPanelRegistry = {
    ...primaryPanels,
    ...actionPanels,
    ...inventoryPanels,
    ...supportPanels,
  };

  // While polymorphed, item-spells and spells keep their normal positions in
  // `layout` (so reverting the transformation restores them exactly) -- only
  // what *renders* at their combined position swaps to the statblock, once,
  // wherever the first of the two is encountered.
  let polymorphSwapRendered = false;
  const renderPanel = (id: PanelId): React.ReactNode => {
    if (polymorphCondition && (id === PANEL_IDS.itemSpells || id === PANEL_IDS.spells)) {
      if (polymorphSwapRendered) return null;
      polymorphSwapRendered = true;
      return <PolymorphedFormPanel polymorphMonsterState={polymorphMonsterState} />;
    }
    return registry[id] ?? null;
  };
  // The swap above only has somewhere to land if this view actually places
  // item-spells or spells -- a custom view built without either (nothing
  // stops that once views are fully player-editable) would otherwise leave
  // the transformed form entirely un-shown while polymorphed. Pin it next to
  // the vitals box in that case, same as combat-stats is pinned.
  const hasSpellsSlot = activeView.layout.some((column) => column.includes(PANEL_IDS.itemSpells) || column.includes(PANEL_IDS.spells));
  const showPinnedPolymorphForm = polymorphCondition && !hasSpellsSlot;

  // Persist a change to just the active view, leaving every other view (and
  // which one is currently selected) untouched.
  const persistActiveView = (updater: (view: SheetViewDef) => SheetViewDef) => {
    updateViews((views) => views.map((view) => (view.id === activeView.id ? updater(view) : view)));
  };

  // A saved layout can reference an id that isn't currently buildable (e.g.
  // `shared-notes` when the character has no campaign) -- drop those rather
  // than showing a card that then has nowhere to go: since the sidebar's
  // contents come from `registry` but a column's previously came straight
  // from `layout` with no such check, dragging one of these out to the
  // sidebar made it vanish (registry didn't have it either). Filtering both
  // sides against the same registry keeps them consistent -- an id that
  // isn't currently valid simply isn't shown anywhere, not shown-then-lost.
  const validPanelIds = useMemo(
    () => MOVABLE_PANEL_IDS.filter((id) => hasCampaign || id !== PANEL_IDS.sharedNotes),
    [hasCampaign],
  );
  const dragZones = useMemo(() => {
    const validIds = new Set(validPanelIds);
    const placedIds = new Set(activeView.layout.flat().filter((id) => validIds.has(id)));
    return [
      ...activeView.layout.map((ids, columnIndex) => ({ id: String(columnIndex), ids: ids.filter((id) => validIds.has(id)) })),
      { id: SIDEBAR_ZONE_ID, ids: validPanelIds.filter((id) => !placedIds.has(id)) },
    ];
  }, [activeView, validPanelIds]);
  const drag = usePanelDragAndDrop({
    zones: dragZones,
    onCommit: (zonesResult) => {
      persistActiveView((view) => ({
        ...view,
        layout: view.layout.map((_, columnIndex) => zonesResult[String(columnIndex)] ?? []),
      }));
    },
  });

  const handleAddColumn = () => {
    persistActiveView((view) => (view.columns >= MAX_SHEET_COLUMNS ? view : { ...view, columns: view.columns + 1, layout: [...view.layout, []] }));
  };
  const handleRemoveColumn = () => {
    // The removed column's panels aren't reassigned anywhere -- they simply
    // stop being "placed," which puts them back in the sidebar automatically.
    persistActiveView((view) => (view.columns <= MIN_SHEET_COLUMNS ? view : { ...view, columns: view.columns - 1, layout: view.layout.slice(0, -1) }));
  };
  const handleResetView = () => {
    const seeded = DEFAULT_SHEET_VIEWS.find((view) => view.id === activeView.id);
    if (!seeded) return;
    persistActiveView(() => cloneSheetView(seeded));
  };

  return (
    <Wrap wide inCombat={inCombat} minWidth={activeView.columns * 380}>
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
        onOpenEngagedEnemies={() => ui.setEngagedEnemiesDrawerOpen(true)}
        showEngagedEnemies={inCombat}
        inCombat={inCombat}
        isMyTurn={isMyTurn}
        sheetViews={sheetViews}
        activeViewId={activeView.id}
        onSelectView={selectView}
        onCreateView={handleCreateView}
        layoutEditMode={ui.layoutEditMode}
        onToggleLayoutEditMode={() => ui.setLayoutEditMode((value) => !value)}
        activeBastion={live.activeBastion}
        xpEarned={derived.xpEarned}
        xpNeeded={derived.xpNeeded}
        xpLevelStart={derived.xpLevelStart}
        xpInput={ui.xpInput}
        xpPopupOpen={ui.xpPopupOpen}
        setXpInput={ui.setXpInput}
        setXpPopupOpen={ui.setXpPopupOpen}
        saveXp={runtime.saveXp}
      />

      {ui.layoutEditMode && (
        <CharacterLayoutEditorToolbar
          activeView={activeView}
          protectedView={isProtectedView}
          canReset={canResetActiveView}
          canDelete={canDeleteActiveView}
          onRename={handleRenameActiveView}
          onAddColumn={handleAddColumn}
          onRemoveColumn={handleRemoveColumn}
          onReset={handleResetView}
          onDuplicate={handleDuplicateActiveView}
          onDelete={handleDeleteActiveView}
        />
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{
        display: "grid",
        flex: 1,
        minWidth: 0,
        // Driven by the active view's own column count -- was keyed to the
        // legacy sheetView with bespoke per-view widths, but that couldn't
        // reflect Add/Remove Column at all (there was no CSS track for a
        // 5th column to render into).
        gridTemplateColumns: `repeat(${activeView.columns}, minmax(340px, 1fr))`,
        gap: 16,
        alignItems: "flex-start",
      }}>
        {Array.from({ length: activeView.columns }, (_, columnIndex) => {
          const zoneId = String(columnIndex);
          const columnIds = drag.displayZones[zoneId] ?? [];
          return (
          <div
            key={columnIndex}
            ref={drag.registerZone(zoneId)}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              minHeight: ui.layoutEditMode ? 40 : undefined,
              ...(ui.layoutEditMode ? {
                padding: 8,
                borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.16)",
              } : null),
            }}
          >
            {columnIndex === 0 && (
              <PinnedVitalsBox
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
                  onConcentrationSpellChange: (spell) => { void notes.saveCharacterData({ concentrationSpell: spell }); },
                  concentrationSpellNames: Array.from(new Set([
                    ...derived.grantedSpellData.spells.map((spell) => spell.spellName),
                    ...(derived.prof?.spells ?? []).map((spell) => spell.name),
                  ])).sort((a, b) => a.localeCompare(b)),
                  hasRageResource: derived.classResourcesWithSpellCasts.some((resource) => /^rage$/i.test(resource.name)),
                }}
              />
            )}
            {columnIndex === 0 && showPinnedPolymorphForm && (
              <PolymorphedFormPanel polymorphMonsterState={polymorphMonsterState} />
            )}
            {columnIds.map((id) => (
              <Fragment key={id}>
                {ui.layoutEditMode ? (
                  <PanelCard
                    id={id}
                    dragging={drag.dragId === id}
                    rowRef={drag.registerRow(zoneId, id)}
                    onPointerDown={(e) => drag.onHandlePointerDown(e, id)}
                  />
                ) : renderPanel(id)}
              </Fragment>
            ))}
          </div>
          );
        })}
      </div>

      {ui.layoutEditMode && (
        <div
          ref={drag.registerZone(SIDEBAR_ZONE_ID)}
          style={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.02)",
            minHeight: 120,
          }}
        >
          <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, marginBottom: 2 }}>
            Not in this view
          </div>
          {(drag.displayZones[SIDEBAR_ZONE_ID] ?? []).map((id) => (
            <PanelCard
              key={id}
              id={id}
              dragging={drag.dragId === id}
              rowRef={drag.registerRow(SIDEBAR_ZONE_ID, id)}
              onPointerDown={(e) => drag.onHandlePointerDown(e, id)}
            />
          ))}
          {(drag.displayZones[SIDEBAR_ZONE_ID] ?? []).length === 0 && (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, fontStyle: "italic" }}>
              Every panel is placed.
            </div>
          )}
        </div>
      )}
      </div>

      {drag.dragId && drag.pointerPos && (
        <PanelDragGhost id={drag.dragId} x={drag.pointerPos.x} y={drag.pointerPos.y} />
      )}

      <CharacterViewOverlays model={model} />
    </Wrap>
  );
}
