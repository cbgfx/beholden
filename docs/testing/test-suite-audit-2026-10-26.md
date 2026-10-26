# Test suite audit and cleanup - 2026-10-26

## Status

**The actionable cleanup is complete.** All 1,504 tests pass across 226 test files. No changes have been published or deployed.

| Workspace | Test files | Passing tests |
| --- | ---: | ---: |
| Server | 97 | 727 |
| Web player | 109 | 655 |
| Web DM | 20 | 122 |
| Total | 226 | 1,504 |

The original baseline was 1,466 tests across 205 files. Retiring unused and overlapping cases reduced some counts; stronger regression and deterministic boundary cases increased others. Splitting suites increased the file count without removing their remaining scenarios.

The subsequent [code audit](../code-audit-2026-10-26.md) is also fully resolved. Final verification used Node 26.12.0 and npm 12.2.0, and the dependency audit reports zero vulnerabilities.

## Completed actions

| Audit finding | Result |
| --- | --- |
| Ten test files replaced React with homemade hook mocks | Rewritten using real React mounting, effects, rerenders and unmounts. No homemade React mocks remain. Existing regression scenarios were retained. |
| Open-note behavior lacked composed reconnect coverage | Added real note-panel/editor integration tests in both apps. Tests assert expanded saved content, persistent editor DOM, unsaved title and body, background-failure recovery and retirement of pending reads on departure. Player snapshot coverage also checks changing character IDs. |
| Six cases exercised three helpers without production callers | Retired buildCanonicalIdMap, fixedItemUsesMaximum and parseGrandCompendiumEntry with those cases. Active canonicalization, charge recovery and strict schema coverage remain. |
| Streaming check covered a different exporter from production | Replaced it with a SQLite-backed streamNativeCompendiumCategory test checking the envelope, every entry and bounded serialization chunks. Added an empty-category case and retired the unused bundle serializer. |
| Guide validation overlapped two server suites | Removed the older native-import scan. The dedicated documentation suite retains minimum-count and all-example classification checks. Distinct player conversion checks remain. |
| Seven UI cases used fixed wall-clock waits | Replaced the waits with fake timers and controlled React updates. |
| Browser-dependent language initialization touched Node storage | DM language tests now use jsdom. The warning is resolved without globally silencing warnings. |
| Dice checks repeatedly sampled only an allowed range | Added exact controlled-roll arithmetic, rejection-sampling and non-crypto fallback endpoint checks. |
| Five server suites mixed too many responsibilities | Split into nineteen focused test files with fixtures, preserving the remaining server scenarios. |
| Fixtures silently normalized data using otherwise-unused converters | Materialized explicit canonical native/route records and retired five unused converters. Preserved the active itemTypeKey projection helper in its own module. |
| Shared and application test ownership was unclear | Documented ownership, real-React harness usage, fixture conventions, async checks and retirement rules in the [testing conventions](README.md). |

## Verification

`npm run verify` passed in full:

- TypeScript checks and lint.
- All server, player and DM test suites.
- Production builds for the server and both apps.
- Payload and bundle budgets.
- Production smoke: fresh database/SRD, both SPAs and assets, login worker and authenticated WebSocket.

Unsaved-body assertions were strengthened after that full run, and both focused reconnect suites passed afterward.

Three targeted regression checks also confirmed that the new tests fail when the corresponding protection is temporarily disabled:

1. Player preservation of the mounted sheet on background-read failure.
2. Player character refresh after reconnect.
3. DM preservation of cached note bodies during summary refresh.

The exact source bytes were restored after every check, and both reconnect suites passed again with the protections restored. These checks are not a suite-wide mutation score.

## Scope and remaining limitations

The original review triaged every discovered test file by purpose, imports, assertion patterns, mocks and runner discovery, with deeper source review of the flagged areas. It was not an exhaustive assertion-by-assertion mutation analysis. No line-coverage percentage or mutation score is claimed.

The new interaction tests use real React in jsdom and mock API/transport boundaries. The production smoke check verifies HTTP/WebSocket behavior. This work does not establish full-browser coverage of the deployed Cloudflare setup or reproduce the original periodic screen flicker in production.

The large player derived-state, level-up payload and structured-effects files can be split when their features are next changed. This was an optional organization recommendation; it is not outstanding correctness work. A separate shared test runner and coverage thresholds remain optional policy choices, not unfinished cleanup tasks.

Permissions, atomic inventory transfers, stale-write rejection, migrations, data restore and character progression tests were preserved. No blanket deletion or test-count target was applied.

## Current file inventory

Every file below passed in the full verification run. The two reconnect suites also passed the stronger draft-body checks afterward. Fixtures and reusable harness modules are support code, not separately counted test files.

### server

| Test file | Current disposition |
| --- | --- |
| [config/environment.test.ts](../../server/src/config/environment.test.ts) | Retained; current behavioral coverage passes. |
| [lib/binderFoundation.mechanics.test.ts](../../server/src/lib/binderFoundation.mechanics.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [lib/binderFoundation.routes.test.ts](../../server/src/lib/binderFoundation.routes.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [lib/binderFoundation.schema.test.ts](../../server/src/lib/binderFoundation.schema.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [lib/canonicalCompendiumId.test.ts](../../server/src/lib/canonicalCompendiumId.test.ts) | Active behavior retained; obsolete helper case retired; passing. |
| [lib/characterSheetNormalization.test.ts](../../server/src/lib/characterSheetNormalization.test.ts) | Retained; current behavioral coverage passes. |
| [lib/dbStartupMigration.test.ts](../../server/src/lib/dbStartupMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/levelUpProficiencies.test.ts](../../server/src/lib/levelUpProficiencies.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/activityMigration.test.ts](../../server/src/lib/migrations/activityMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/bastionFacilityInstanceSizeMigration.test.ts](../../server/src/lib/migrations/bastionFacilityInstanceSizeMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/bastionFacilitySizeMigration.test.ts](../../server/src/lib/migrations/bastionFacilitySizeMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/bastionOwnerlessFacilityMigration.test.ts](../../server/src/lib/migrations/bastionOwnerlessFacilityMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/characterProgressionCanonicalMigration.test.ts](../../server/src/lib/migrations/characterProgressionCanonicalMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/characterProgressionMigration.test.ts](../../server/src/lib/migrations/characterProgressionMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/compendiumClassFeatCanonicalMigration.test.ts](../../server/src/lib/migrations/compendiumClassFeatCanonicalMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/compendiumPrimaryKeyMigration.test.ts](../../server/src/lib/migrations/compendiumPrimaryKeyMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/hitDiceSpentMigration.test.ts](../../server/src/lib/migrations/hitDiceSpentMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/inventoryIntegrityMigration.test.ts](../../server/src/lib/migrations/inventoryIntegrityMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/itemDisplayColumnMigration.test.ts](../../server/src/lib/migrations/itemDisplayColumnMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/migrationLedger.test.ts](../../server/src/lib/migrations/migrationLedger.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/monsterTreasureMigration.test.ts](../../server/src/lib/migrations/monsterTreasureMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/partyInventoryPayloadColumnMigration.test.ts](../../server/src/lib/migrations/partyInventoryPayloadColumnMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/migrations/preparedSpellFlagMigration.test.ts](../../server/src/lib/migrations/preparedSpellFlagMigration.test.ts) | Retained; current behavioral coverage passes. |
| [lib/passwordWorker.test.ts](../../server/src/lib/passwordWorker.test.ts) | Retained; current behavioral coverage passes. |
| [lib/referenceRegistry.test.ts](../../server/src/lib/referenceRegistry.test.ts) | Retained; current behavioral coverage passes. |
| [lib/sharedNotes.test.ts](../../server/src/lib/sharedNotes.test.ts) | Retained; current behavioral coverage passes. |
| [routes/adminRoutes.test.ts](../../server/src/routes/adminRoutes.test.ts) | Retained; current behavioral coverage passes. |
| [routes/adventures.test.ts](../../server/src/routes/adventures.test.ts) | Retained; current behavioral coverage passes. |
| [routes/bastionBroadcast.test.ts](../../server/src/routes/bastionBroadcast.test.ts) | Retained; current behavioral coverage passes. |
| [routes/bastionOperations.test.ts](../../server/src/routes/bastionOperations.test.ts) | Retained; current behavioral coverage passes. |
| [routes/campaigns/bootstrap.test.ts](../../server/src/routes/campaigns/bootstrap.test.ts) | Retained; current behavioral coverage passes. |
| [routes/campaigns/fullRest.test.ts](../../server/src/routes/campaigns/fullRest.test.ts) | Retained; current behavioral coverage passes. |
| [routes/characters/inventoryConflict.test.ts](../../server/src/routes/characters/inventoryConflict.test.ts) | Retained; current behavioral coverage passes. |
| [routes/characters/sheetLiveState.test.ts](../../server/src/routes/characters/sheetLiveState.test.ts) | Retained; current behavioral coverage passes. |
| [routes/combat/combatAccess.test.ts](../../server/src/routes/combat/combatAccess.test.ts) | Retained; current behavioral coverage passes. |
| [routes/combat/regression.concentration.test.ts](../../server/src/routes/combat/regression.concentration.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/combat/regression.roster.test.ts](../../server/src/routes/combat/regression.roster.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/combat/regression.transitions.test.ts](../../server/src/routes/combat/regression.transitions.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/combat/regression.visibility.test.ts](../../server/src/routes/combat/regression.visibility.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/compendium/grandCompendiumRoutes.items.test.ts](../../server/src/routes/compendium/grandCompendiumRoutes.items.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/compendium/grandCompendiumRoutes.monsters.test.ts](../../server/src/routes/compendium/grandCompendiumRoutes.monsters.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/compendium/grandCompendiumRoutes.spells-classes.test.ts](../../server/src/routes/compendium/grandCompendiumRoutes.spells-classes.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/compendium/grandCompendiumRoutes.transfer.test.ts](../../server/src/routes/compendium/grandCompendiumRoutes.transfer.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [routes/compendium/itemPreview.test.ts](../../server/src/routes/compendium/itemPreview.test.ts) | Retained; current behavioral coverage passes. |
| [routes/compendium/itemSearchFilters.test.ts](../../server/src/routes/compendium/itemSearchFilters.test.ts) | Retained; current behavioral coverage passes. |
| [routes/compendium/monsterLetterIndex.test.ts](../../server/src/routes/compendium/monsterLetterIndex.test.ts) | Retained; current behavioral coverage passes. |
| [routes/compendium/spellSearchFilters.test.ts](../../server/src/routes/compendium/spellSearchFilters.test.ts) | Retained; current behavioral coverage passes. |
| [routes/encounters.test.ts](../../server/src/routes/encounters.test.ts) | Retained; current behavioral coverage passes. |
| [routes/exportImport/helpers.test.ts](../../server/src/routes/exportImport/helpers.test.ts) | Retained; current behavioral coverage passes. |
| [routes/healthMeta.test.ts](../../server/src/routes/healthMeta.test.ts) | Retained; current behavioral coverage passes. |
| [routes/inpcs.test.ts](../../server/src/routes/inpcs.test.ts) | Retained; current behavioral coverage passes. |
| [routes/notes.test.ts](../../server/src/routes/notes.test.ts) | Retained; current behavioral coverage passes. |
| [routes/partyInventory.transfer.test.ts](../../server/src/routes/partyInventory.transfer.test.ts) | Retained; current behavioral coverage passes. |
| [routes/players.test.ts](../../server/src/routes/players.test.ts) | Retained; current behavioral coverage passes. |
| [routes/sharedNotesSync.test.ts](../../server/src/routes/sharedNotesSync.test.ts) | Retained; current behavioral coverage passes. |
| [routes/treasure/treasure.test.ts](../../server/src/routes/treasure/treasure.test.ts) | Retained; current behavioral coverage passes. |
| [routes/updateCheck.test.ts](../../server/src/routes/updateCheck.test.ts) | Retained; current behavioral coverage passes. |
| [routes/webUi.test.ts](../../server/src/routes/webUi.test.ts) | Retained; current behavioral coverage passes. |
| [routes/workspacePreferences.test.ts](../../server/src/routes/workspacePreferences.test.ts) | Retained; current behavioral coverage passes. |
| [server/egressLogging.test.ts](../../server/src/server/egressLogging.test.ts) | Retained; current behavioral coverage passes. |
| [server/eventVisibility.test.ts](../../server/src/server/eventVisibility.test.ts) | Retained; current behavioral coverage passes. |
| [server/jsonBody.test.ts](../../server/src/server/jsonBody.test.ts) | Added encoded-body rejection and server-liveness regression; passing. |
| [server/uploadLimits.test.ts](../../server/src/server/uploadLimits.test.ts) | Retained; current behavioral coverage passes. |
| [services/adventureMonsterImport.test.ts](../../server/src/services/adventureMonsterImport.test.ts) | Retained; current behavioral coverage passes. |
| [services/binders/binderNpcSync.test.ts](../../server/src/services/binders/binderNpcSync.test.ts) | Retained; current behavioral coverage passes. |
| [services/binders/linkedCharacterSync.test.ts](../../server/src/services/binders/linkedCharacterSync.test.ts) | Retained; current behavioral coverage passes. |
| [services/binders/nativeBinder.test.ts](../../server/src/services/binders/nativeBinder.test.ts) | Retained; current behavioral coverage passes. |
| [services/binders/notionImport.test.ts](../../server/src/services/binders/notionImport.test.ts) | Retained; current behavioral coverage passes. |
| [services/characterProgressionEligibility.test.ts](../../server/src/services/characterProgressionEligibility.test.ts) | Retained; current behavioral coverage passes. |
| [services/combat.removal.test.ts](../../server/src/services/combat.removal.test.ts) | Retained; current behavioral coverage passes. |
| [services/combatPlayerSync.test.ts](../../server/src/services/combatPlayerSync.test.ts) | Retained; current behavioral coverage passes. |
| [services/combatTransitions.test.ts](../../server/src/services/combatTransitions.test.ts) | Retained; current behavioral coverage passes. |
| [services/compendium/defaultSrdCompendium.test.ts](../../server/src/services/compendium/defaultSrdCompendium.test.ts) | Retained; current behavioral coverage passes. |
| [services/compendium/grandCompendiumSchemas.classes.test.ts](../../server/src/services/compendium/grandCompendiumSchemas.classes.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/grandCompendiumSchemas.items.test.ts](../../server/src/services/compendium/grandCompendiumSchemas.items.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/grandCompendiumSchemas.monsters.test.ts](../../server/src/services/compendium/grandCompendiumSchemas.monsters.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/grandCompendiumSchemas.other.test.ts](../../server/src/services/compendium/grandCompendiumSchemas.other.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/grandCompendiumSchemas.spells.test.ts](../../server/src/services/compendium/grandCompendiumSchemas.spells.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/nativeCompendium.compatibility.test.ts](../../server/src/services/compendium/nativeCompendium.compatibility.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/nativeCompendium.persistence.test.ts](../../server/src/services/compendium/nativeCompendium.persistence.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/nativeCompendium.validation.test.ts](../../server/src/services/compendium/nativeCompendium.validation.test.ts) | Focused replacement after suite split; remaining scenarios retained and passing. |
| [services/compendium/nativeCompendiumStreaming.test.ts](../../server/src/services/compendium/nativeCompendiumStreaming.test.ts) | Retargeted to production SQLite exporter, including empty-category coverage; passing. |
| [services/compendium/stagedCompendiumPreview.test.ts](../../server/src/services/compendium/stagedCompendiumPreview.test.ts) | Retained; current behavioral coverage passes. |
| [services/concentrationOwnership.test.ts](../../server/src/services/concentrationOwnership.test.ts) | Retained; current behavioral coverage passes. |
| [services/conditions.test.ts](../../server/src/services/conditions.test.ts) | Retained; current behavioral coverage passes. |
| [services/conditionSpeed.test.ts](../../server/src/services/conditionSpeed.test.ts) | Retained; current behavioral coverage passes. |
| [services/databaseArchive.test.ts](../../server/src/services/databaseArchive.test.ts) | Added bounded streaming extraction, malformed ZIP and cancellation regressions; passing. |
| [services/databaseImageArchive.test.ts](../../server/src/services/databaseImageArchive.test.ts) | Retained; current behavioral coverage passes. |
| [services/databaseTransfer.test.ts](../../server/src/services/databaseTransfer.test.ts) | Retained; current behavioral coverage passes. |
| [services/images/orphanImages.test.ts](../../server/src/services/images/orphanImages.test.ts) | Retained; current behavioral coverage passes. |
| [services/inventoryValidation.test.ts](../../server/src/services/inventoryValidation.test.ts) | Retained; current behavioral coverage passes. |
| [services/liveStateHome.test.ts](../../server/src/services/liveStateHome.test.ts) | Retained; current behavioral coverage passes. |
| [services/maintenance/jsonReferences.test.ts](../../server/src/services/maintenance/jsonReferences.test.ts) | Retained; current behavioral coverage passes. |
| [services/maintenance/startupMaintenance.test.ts](../../server/src/services/maintenance/startupMaintenance.test.ts) | Retained; current behavioral coverage passes. |
| [services/spellStateValidation.test.ts](../../server/src/services/spellStateValidation.test.ts) | Retained; current behavioral coverage passes. |
| [tests/docs/aiContentGuide.test.ts](../../server/src/tests/docs/aiContentGuide.test.ts) | Retained; current behavioral coverage passes. |
| [tests/integration/accountAndCampaignPersistence.test.ts](../../server/src/tests/integration/accountAndCampaignPersistence.test.ts) | Retained; current behavioral coverage passes. |

### web-player

| Test file | Current disposition |
| --- | --- |
| [domain/character/characterFeatures.test.ts](../../web-player/src/domain/character/characterFeatures.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/characterFeaturesProgression.test.ts](../../web-player/src/domain/character/characterFeaturesProgression.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/classProgressionRequirements.test.ts](../../web-player/src/domain/character/classProgressionRequirements.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/classSpellSelections.test.ts](../../web-player/src/domain/character/classSpellSelections.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/extraFeatAbilityScores.test.ts](../../web-player/src/domain/character/extraFeatAbilityScores.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/featEffects.test.ts](../../web-player/src/domain/character/featEffects.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/featureNoteTemplates.test.ts](../../web-player/src/domain/character/featureNoteTemplates.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/fightingStyles.test.ts](../../web-player/src/domain/character/fightingStyles.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/invocationFeatChoices.test.ts](../../web-player/src/domain/character/invocationFeatChoices.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/multiclassEligibility.test.ts](../../web-player/src/domain/character/multiclassEligibility.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/multiclassRegression.test.ts](../../web-player/src/domain/character/multiclassRegression.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/multiclassSpellcasting.test.ts](../../web-player/src/domain/character/multiclassSpellcasting.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/progressionHp.test.ts](../../web-player/src/domain/character/progressionHp.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/progressionLevelDown.test.ts](../../web-player/src/domain/character/progressionLevelDown.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/progressionOwnership.test.ts](../../web-player/src/domain/character/progressionOwnership.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/progressionRepair.test.ts](../../web-player/src/domain/character/progressionRepair.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/progressionRequirements.test.ts](../../web-player/src/domain/character/progressionRequirements.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/speciesTraitChoices.test.ts](../../web-player/src/domain/character/speciesTraitChoices.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/spellAcquisition.test.ts](../../web-player/src/domain/character/spellAcquisition.test.ts) | Retained; current behavioral coverage passes. |
| [domain/character/structuredFeatureEffects.test.ts](../../web-player/src/domain/character/structuredFeatureEffects.test.ts) | Retained; current behavioral coverage passes. |
| [domain/normalizeDescriptionText.test.ts](../../web-player/src/domain/normalizeDescriptionText.test.ts) | Retained; current behavioral coverage passes. |
| [domain/toggleEditing.test.ts](../../web-player/src/domain/toggleEditing.test.ts) | Retained; current behavioral coverage passes. |
| [domain/wysiwygMarkdownToHtml.test.ts](../../web-player/src/domain/wysiwygMarkdownToHtml.test.ts) | Retained; current behavioral coverage passes. |
| [i18n/catalogs.test.ts](../../web-player/src/i18n/catalogs.test.ts) | Retained; current behavioral coverage passes. |
| [i18n/i18n.test.tsx](../../web-player/src/i18n/i18n.test.tsx) | Retained; current behavioral coverage passes. |
| [i18n/languageLifecycle.test.tsx](../../web-player/src/i18n/languageLifecycle.test.tsx) | Retained; current behavioral coverage passes. |
| [lib/dice.test.ts](../../web-player/src/lib/dice.test.ts) | Strengthened with deterministic arithmetic and sampler boundaries; passing. |
| [lib/diceOperators.test.ts](../../web-player/src/lib/diceOperators.test.ts) | Strengthened with deterministic arithmetic and sampler boundaries; passing. |
| [lib/virtualListRange.test.ts](../../web-player/src/lib/virtualListRange.test.ts) | Retained; current behavioral coverage passes. |
| [services/compendiumApi.test.ts](../../web-player/src/services/compendiumApi.test.ts) | Retained; current behavioral coverage passes. |
| [ui/AuthContext.test.ts](../../web-player/src/ui/AuthContext.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [ui/useDebouncedSingleflight.test.ts](../../web-player/src/ui/useDebouncedSingleflight.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [ui/useDebouncedTaskQueue.test.ts](../../web-player/src/ui/useDebouncedTaskQueue.test.ts) | Added real React queue disposal and synchronous-error regressions; passing. |
| [ui/usePointerDragReorder.test.ts](../../web-player/src/ui/usePointerDragReorder.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [ui/useProfileSave.test.ts](../../web-player/src/ui/useProfileSave.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [ui/useUpdateCheck.test.ts](../../web-player/src/ui/useUpdateCheck.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [ui/webSocketConnection.test.ts](../../web-player/src/ui/webSocketConnection.test.ts) | Retained; current behavioral coverage passes. |
| [views/campaign/bastionEcho.test.ts](../../web-player/src/views/campaign/bastionEcho.test.ts) | Retained; current behavioral coverage passes. |
| [views/campaign/bastionOperationQueue.test.ts](../../web-player/src/views/campaign/bastionOperationQueue.test.ts) | Retained; current behavioral coverage passes. |
| [views/campaign/useCommittedText.test.tsx](../../web-player/src/views/campaign/useCommittedText.test.tsx) | Retained; current behavioral coverage passes. |
| [views/character/characterAppearance.test.ts](../../web-player/src/views/character/characterAppearance.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/CharacterRuleParsers.test.ts](../../web-player/src/views/character/CharacterRuleParsers.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/CharacterSheetUtils.test.ts](../../web-player/src/views/character/CharacterSheetUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/CharacterViewDerivedComputations.test.ts](../../web-player/src/views/character/CharacterViewDerivedComputations.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/CharacterViewDerivedState.test.ts](../../web-player/src/views/character/CharacterViewDerivedState.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/CharacterViewResourceHelpers.test.ts](../../web-player/src/views/character/CharacterViewResourceHelpers.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/CharacterCombatPanels.test.ts](../../web-player/src/views/character/combat/CharacterCombatPanels.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/CharacterConditions.test.ts](../../web-player/src/views/character/combat/CharacterConditions.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/CharacterExhaustion.test.ts](../../web-player/src/views/character/combat/CharacterExhaustion.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/CharacterHpDelta.test.ts](../../web-player/src/views/character/combat/CharacterHpDelta.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/CharacterRestRecovery.test.ts](../../web-player/src/views/character/combat/CharacterRestRecovery.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/CharacterViewCombatActions.test.ts](../../web-player/src/views/character/combat/CharacterViewCombatActions.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/EngagedEnemiesDrawer.test.ts](../../web-player/src/views/character/combat/EngagedEnemiesDrawer.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/preparedSpellWrites.test.ts](../../web-player/src/views/character/combat/preparedSpellWrites.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/combat/restConditions.test.ts](../../web-player/src/views/character/combat/restConditions.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/CharacterInventory.test.ts](../../web-player/src/views/character/inventory/CharacterInventory.test.ts) | Active behavior retained; obsolete helper case retired; passing. |
| [views/character/inventory/CharacterInventoryBundles.test.ts](../../web-player/src/views/character/inventory/CharacterInventoryBundles.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/CharacterInventoryDerived.test.ts](../../web-player/src/views/character/inventory/CharacterInventoryDerived.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/CharacterInventoryPanelHelpers.test.ts](../../web-player/src/views/character/inventory/CharacterInventoryPanelHelpers.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/currencyMath.test.ts](../../web-player/src/views/character/inventory/currencyMath.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/inventoryTransferPayload.test.ts](../../web-player/src/views/character/inventory/inventoryTransferPayload.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/partyInventorySync.test.ts](../../web-player/src/views/character/inventory/partyInventorySync.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/useCharacterInventoryContainers.test.ts](../../web-player/src/views/character/inventory/useCharacterInventoryContainers.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/useCharacterInventoryItems.test.ts](../../web-player/src/views/character/inventory/useCharacterInventoryItems.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/inventory/useCharacterInventorySync.test.ts](../../web-player/src/views/character/inventory/useCharacterInventorySync.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [views/character/layout/sheetViewLayout.test.ts](../../web-player/src/views/character/layout/sheetViewLayout.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/notes/noteSave.test.tsx](../../web-player/src/views/character/notes/noteSave.test.tsx) | Added private/shared note failure, draft preservation and retry regressions; passing. |
| [views/character/spells/CharacterConcentrationSpells.test.ts](../../web-player/src/views/character/spells/CharacterConcentrationSpells.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/spells/CharacterSpellShared.test.ts](../../web-player/src/views/character/spells/CharacterSpellShared.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/spells/CharacterStoredSpellUtils.test.ts](../../web-player/src/views/character/spells/CharacterStoredSpellUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/state/characterSyncLifecycle.test.tsx](../../web-player/src/views/character/state/characterSyncLifecycle.test.tsx) | Retained; current behavioral coverage passes. |
| [views/character/state/derivedStatSync.test.ts](../../web-player/src/views/character/state/derivedStatSync.test.ts) | Retained; current behavioral coverage passes. |
| [views/character/state/notesReconnect.test.tsx](../../web-player/src/views/character/state/notesReconnect.test.tsx) | Added composed reconnect/editor regression coverage; passing. |
| [views/character/state/useCharacterActions.test.ts](../../web-player/src/views/character/state/useCharacterActions.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [views/character/state/useCharacterSnapshot.test.ts](../../web-player/src/views/character/state/useCharacterSnapshot.test.ts) | Rewritten with real React; ordering, failure recovery and navigation cases pass. |
| [views/character/state/useQueuedPersistedState.test.ts](../../web-player/src/views/character/state/useQueuedPersistedState.test.ts) | Added queue reconciliation, failure/retry and stale acknowledgement regressions; passing. |
| [views/character-creator/constants/CharacterCreatorConstants.test.ts](../../web-player/src/views/character-creator/constants/CharacterCreatorConstants.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/creatorRequirements.test.ts](../../web-player/src/views/character-creator/creatorRequirements.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/creatorSubmissionLevel.test.ts](../../web-player/src/views/character-creator/creatorSubmissionLevel.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/requirementNotification.test.ts](../../web-player/src/views/character-creator/requirementNotification.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/useCharacterCreatorDerivedState.test.ts](../../web-player/src/views/character-creator/useCharacterCreatorDerivedState.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/useCharacterCreatorSubmit.test.tsx](../../web-player/src/views/character-creator/useCharacterCreatorSubmit.test.tsx) | Retained; current behavioral coverage passes. |
| [views/character-creator/useChoiceDataLoaders.test.tsx](../../web-player/src/views/character-creator/useChoiceDataLoaders.test.tsx) | Retained; current behavioral coverage passes. |
| [views/character-creator/useCreatorCompendiumCatalogs.test.ts](../../web-player/src/views/character-creator/useCreatorCompendiumCatalogs.test.ts) | Rewritten with real React; regression scenarios retained and passing. |
| [views/character-creator/useCreatorEditHydration.test.tsx](../../web-player/src/views/character-creator/useCreatorEditHydration.test.tsx) | Retained; current behavioral coverage passes. |
| [views/character-creator/useCreatorSelectedCompendium.test.tsx](../../web-player/src/views/character-creator/useCreatorSelectedCompendium.test.tsx) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/backgroundEquipment.test.ts](../../web-player/src/views/character-creator/utils/backgroundEquipment.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/CharacterCreatorClassCoreUtils.test.ts](../../web-player/src/views/character-creator/utils/CharacterCreatorClassCoreUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/CharacterCreatorClassFeatureUtils.test.ts](../../web-player/src/views/character-creator/utils/CharacterCreatorClassFeatureUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/CharacterCreatorDerivedStats.test.ts](../../web-player/src/views/character-creator/utils/CharacterCreatorDerivedStats.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/CharacterCreatorFormUtils.test.ts](../../web-player/src/views/character-creator/utils/CharacterCreatorFormUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/CharacterCreatorSpellcastingUtils.test.ts](../../web-player/src/views/character-creator/utils/CharacterCreatorSpellcastingUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/classToolProficiencies.test.ts](../../web-player/src/views/character-creator/utils/classToolProficiencies.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/FeatGrantUtils.test.ts](../../web-player/src/views/character-creator/utils/FeatGrantUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/GrowthChoiceUtils.test.ts](../../web-player/src/views/character-creator/utils/GrowthChoiceUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/character-creator/utils/SpellChoiceUtils.test.ts](../../web-player/src/views/character-creator/utils/SpellChoiceUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/CompendiumView/hooks/paginatedCompendiumSearch.test.tsx](../../web-player/src/views/CompendiumView/hooks/paginatedCompendiumSearch.test.tsx) | Retained; current behavioral coverage passes. |
| [views/CompendiumView/monsterSortName.test.ts](../../web-player/src/views/CompendiumView/monsterSortName.test.ts) | Retained; current behavioral coverage passes. |
| [views/CompendiumView/sharedCompendium.test.tsx](../../web-player/src/views/CompendiumView/sharedCompendium.test.tsx) | Behavior retained; fixed waits replaced with fake timers; passing. |
| [views/home/aiContentGuide.test.ts](../../web-player/src/views/home/aiContentGuide.test.ts) | Retained; current behavioral coverage passes. |
| [views/home/PlayerHomeUtils.test.ts](../../web-player/src/views/home/PlayerHomeUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/buildLevelUpPayload.test.ts](../../web-player/src/views/level-up/buildLevelUpPayload.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/fetchLevelUpSpellOptions.test.ts](../../web-player/src/views/level-up/fetchLevelUpSpellOptions.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/LevelUpExclusiveChoiceUtils.test.ts](../../web-player/src/views/level-up/LevelUpExclusiveChoiceUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/LevelUpHelpers.test.ts](../../web-player/src/views/level-up/LevelUpHelpers.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/LevelUpUtils.test.ts](../../web-player/src/views/level-up/LevelUpUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/MysticArcanumRevisitUtils.test.ts](../../web-player/src/views/level-up/MysticArcanumRevisitUtils.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/useLevelUpDerivedState.test.ts](../../web-player/src/views/level-up/useLevelUpDerivedState.test.ts) | Retained; current behavioral coverage passes. |
| [views/level-up/useLevelUpSubmit.test.tsx](../../web-player/src/views/level-up/useLevelUpSubmit.test.tsx) | Retained; current behavioral coverage passes. |

### web-dm

| Test file | Current disposition |
| --- | --- |
| [components/treasure/TreasureRow.test.ts](../../web-dm/src/components/treasure/TreasureRow.test.ts) | Retained; current behavioral coverage passes. |
| [domain/utils/difficulty.test.ts](../../web-dm/src/domain/utils/difficulty.test.ts) | Retained; current behavioral coverage passes. |
| [domain/utils/monsterDpr.test.ts](../../web-dm/src/domain/utils/monsterDpr.test.ts) | Retained; current behavioral coverage passes. |
| [drawers/drawers/NoteDrawer.test.tsx](../../web-dm/src/drawers/drawers/NoteDrawer.test.tsx) | Retained; current behavioral coverage passes. |
| [i18n/i18n.test.ts](../../web-dm/src/i18n/i18n.test.ts) | Browser environment corrected; language/catalog checks pass without the storage warning. |
| [layout/workspace/DmWorkspace.test.tsx](../../web-dm/src/layout/workspace/DmWorkspace.test.tsx) | Retained; current behavioral coverage passes. |
| [layout/workspace/workspaceLayout.test.ts](../../web-dm/src/layout/workspace/workspaceLayout.test.ts) | Retained; current behavioral coverage passes. |
| [store/reducer.test.ts](../../web-dm/src/store/reducer.test.ts) | Retained; current behavioral coverage passes. |
| [tests/integration/browserClient.test.ts](../../web-dm/src/tests/integration/browserClient.test.ts) | Retained; current behavioral coverage passes. |
| [tests/integration/campaignScope.test.tsx](../../web-dm/src/tests/integration/campaignScope.test.tsx) | Added stale delta/bootstrap and queued scope-change regressions; passing. |
| [tests/integration/notesReconnect.test.tsx](../../web-dm/src/tests/integration/notesReconnect.test.tsx) | Added composed reconnect/editor regression coverage; passing. |
| [tests/integration/persistenceLifecycle.test.tsx](../../web-dm/src/tests/integration/persistenceLifecycle.test.tsx) | Retained; current behavioral coverage passes. |
| [tools/bastions/bastionFacilities.test.ts](../../web-dm/src/tools/bastions/bastionFacilities.test.ts) | Retained; current behavioral coverage passes. |
| [views/BinderView/placeFilters.test.ts](../../web-dm/src/views/BinderView/placeFilters.test.ts) | Retained; current behavioral coverage passes. |
| [views/BinderView/useRichTextDraft.test.ts](../../web-dm/src/views/BinderView/useRichTextDraft.test.ts) | Retained; current behavioral coverage passes. |
| [views/CampaignView/monsterPicker/hooks/useMonsterIndexSearch.test.tsx](../../web-dm/src/views/CampaignView/monsterPicker/hooks/useMonsterIndexSearch.test.tsx) | Behavior retained; fixed waits replaced with fake timers; passing. |
| [views/CombatView/engine/CombatEngine.test.ts](../../web-dm/src/views/CombatView/engine/CombatEngine.test.ts) | Retained; current behavioral coverage passes. |
| [views/CompendiumView/panels/ItemFormModel.test.ts](../../web-dm/src/views/CompendiumView/panels/ItemFormModel.test.ts) | Retained; current behavioral coverage passes. |
| [views/CompendiumView/panels/monsterFormMapping.test.ts](../../web-dm/src/views/CompendiumView/panels/monsterFormMapping.test.ts) | Retained; current behavioral coverage passes. |
| [views/CompendiumView/panels/SpellFormModel.test.ts](../../web-dm/src/views/CompendiumView/panels/SpellFormModel.test.ts) | Retained; current behavioral coverage passes. |

