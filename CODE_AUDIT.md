# Beholden — Code Audit

Read-only audit across all four application workspaces (`server`, `shared`, `web-dm`, `web-player`), looking for duplicated logic, dead code, oversized files, and other maintainability issues. Four parallel passes, one per workspace, ~103,000 lines / 736 source files read. No code was changed as part of this audit.

Severity: **HIGH** = correctness risk or high-leverage fix, **MED** = worth scheduling, **LOW** = minor / opportunistic.

## Remediation progress

Completed after this audit was compiled:

- Reference and Deity records now refresh quietly when the tab regains focus.
- `PlayerRow` now has one action API; the legacy `actions` branch was removed.
- Ordinal formatting is shared by DM and Player applications.
- The unused shared `FieldGrid` component and export were removed.
- Mortal saved-view selection now reuses the standard Binder searchable select.
- Binder reload debouncing now uses one shared hook.
- The equipment parser was moved out of the misleading race-parser module.
- Binder entity names use one shared server validation schema.
- Server route error-message fallbacks use one helper.
- The duplicated Mortal/Reference visibility icon is now one component.
- Campaign 404 responses now consistently include `Campaign not found`.
- Image uploads now share one validation/conversion helper across campaign, character,
  player, Mortal, and Reference routes.
- Campaign-character ID lookups now use one database helper instead of repeating the
  same projected `players` query throughout routes and services.
- Optional non-empty compendium objects now share one refinement predicate across all
  monster, item, species, feat, class, class-talent, and spell schemas.
- Character Creator and Level Up now share selection-map equality/key helpers.
- The three Level Up locked spell-selection pipelines now use one parameterized helper.
- Character Creator computes its resolved ability scores once per state change and
  reuses the result for sheet facts and spell-limit sanitation.
- Reference Workspace display behavior now comes from a per-record-type configuration
  instead of rebuilding the primary flag matrix inline.
- The monster-picker library (virtual list, CR formatting, row/sort types) is now shared
  between the DM and Player applications instead of two independently-drifting copies.
- Dice-expression evaluation is now one shared engine, combining the fuller arithmetic
  grammar with the cryptographically-strong roll — every caller in both apps gets both.
- The combat-update (`PUT .../combatants/:id`) and Binder-Mortal-patch
  (`PATCH .../mortals/:id`) route handlers are now thin wrappers around named service
  functions, matching the rest of `services/`'s conventions.
- Character Creator's and Level Up's tagged-entry dedup logic now share one primitive
  instead of two separately-maintained implementations.
- Level Up's proficiency-category patching now has regression test coverage for every
  category (skills/tools/languages/armor/weapons/saves, invocations, expertise,
  maneuvers/metamagic/infusions/plans), not just spells and the multiclass-add path.
- `WysiwygNoteEditor` is split into markdown⇄HTML conversion, contenteditable/selection
  helpers, and the mention-autocomplete state machine, each in their own module; the
  editor component itself only wires them together. The markdown-to-HTML direction now
  has unit tests, which wasn't possible while it was bundled into the React component.
- Character-sheet and combat HP controls now share one sign/expression parser while
  retaining their intentionally different invalid-input presentation behavior.
- Native compendium transfer now has a stable facade over focused parsing,
  manifest/preview, import, and export modules. The eight blob-backed category imports
  are driven by one typed configuration; Deck and Bastion retain explicit writers
  because their normalized storage is genuinely different.
- Removed the full `@iconify-json/game-icons` catalog from both browser bundles.
  Individual icons now load on demand, and the DM icon picker fetches only the lightweight
  name catalog when opened; the former 6.4 MB JavaScript chunk and build warning are gone.
- Item and spell searches now share one ruleset-loading and abortable paginated-fetch
  lifecycle while retaining their category-specific query, normalization, and filter logic.
- Character Creator's and Level Up's derived-state hooks each had one genuinely-duplicated
  cluster consolidated in place (Creator: 3 near-identical spell-choice-source blocks into
  one parameterized builder; Level Up: 4 near-identical proficiency-key-set blocks into one
  helper, plus a doubly-computed effect-collection call hoisted to run once), and each had
  its one fully self-contained sub-cluster (no dependency on the class-feature/race-trait
  effect parsing left behind) extracted into its own file
  (`useCreatorProficiencyChoices`/`useLevelUpProficiencyChoices`). Both hooks also dropped
  their handful of confirmed-dead return fields. The cross-wizard "5 spell-choice shapes"
  merge and the remaining 3-way hook split were not attempted — see the note below on why,
  the same reasoning that applied to priority 3.

Priority 3 was re-scoped after investigation, not implemented as originally written:
unifying Character Creator's and Level Up's proficiency-map construction into one
function turned out to be the wrong fix. Level Up has never loaded race/background/
full-class-feat data because those can't change after character creation; making it
call Creator's from-scratch rebuild would mean adding real new compendium fetches to
remove a duplication problem, not fix one. The shared dedup primitive and new test
coverage above address the actual risk (a category fix landing in one wizard but not
the other) without that larger, riskier rewrite.

LOW findings reviewed with no destructive change required:

- The two `DraggableList` adapters intentionally retain app-specific row presentation;
  drag/reorder state and pointer mechanics are already shared. Merging the adapters
  would replace a small styling boundary with a large theme-prop API.
- Currency arithmetic, ability modifiers, creator HP, and combat HP were cross-checked.
  They solve different domain operations; no duplicate implementation was found to extract.
- The creator/Level Up compendium type convergence is being handled by priority 3's
  proficiency/data-model work, so it was not independently rewritten in this pass.
- `migrateClassFeatureChoiceKeys` remains an intentional read-time compatibility path.
  Removing it requires production-data evidence that no legacy saves remain; retaining
  it is safer and its behavior remains covered by tests.
- Both `DiceCalculatorModal` components keep their own bespoke arithmetic evaluator
  rather than switching to the new shared dice engine: the two aren't behavior-equivalent
  (the modal truncates on every division step and never clamps negative results, the
  shared engine floors only the final result and clamps to zero for HP safety). Swapping
  them would have silently changed what the calculator displays.

### LOW-priority status

- [x] Shared ordinal formatting
- [x] Draggable-list duplication reviewed; shared pointer/reorder core retained
- [x] Currency, ability, and HP formula cross-checks completed
- [x] Shared server image-upload preparation
- [x] Shared Binder name schema and error fallback
- [x] Consistent Campaign 404 payloads
- [x] Shared campaign-character row lookup
- [x] Shared non-empty compendium-object refinement
- [x] Removed unused `FieldGrid`
- [x] Reference record-type display configuration
- [x] Standard Mortal saved-view selector
- [x] Shared Binder debounced-effect hook
- [x] Shared selection-map comparison
- [x] Creator/Level Up type overlap reviewed under Priority 3
- [x] Shared locked-selection resolver
- [x] Reused Character Creator resolved scores
- [x] Legacy class-choice migration reviewed and intentionally retained
- [x] Renamed the misplaced Character Creator equipment parser

### Native compendium status

- [x] **HIGH:** Replace the repeated per-category import loops with a typed configuration
- [x] **MED:** Split the 1,007-line native-compendium module by responsibility

The original findings remain below as the audit record; this progress list is the
current implementation status rather than a rewrite of the original report.

---

## Priority order (aggregated across all four passes)

1. **Promote the monster-picker library and dice engine into `shared`.** Found independently by three of the four audits, in both apps, already drifting in behavior.
2. **Pull the two business-critical god handlers out of `server/routes`.** Combat-update and binder-mortal-patch routes each bury 150+ lines of HP/concentration/validation logic directly in an Express handler.
3. **Unify how the character creator and level-up wizard build `proficiencies`.** One rebuilds the whole map from scratch, the other patches deltas onto the old one — same data, two mental models, the likeliest place a real gameplay bug is hiding.

---

## Cross-app duplication (web-dm ↔ web-player)

`shared/` exists so `web-dm` and `web-player` don't reinvent the same logic. These didn't get the memo.

### [HIGH] Monster-picker mini-library duplicated wholesale — *confirmed by 3 audits*
`useVirtualList`, `formatCr`, `CompendiumMonsterRow`, `SortMode`, and the row-rendering in `MonsterBrowserPanel.tsx` exist near-verbatim in both `web-dm/src/views/CampaignView/monsterPicker/` and `web-player/src/lib/monsterPicker/`, already showing small feature drift (web-dm has an extra `scrollToIndex` and `parseLeadingNumberLoose` the player copy lacks). Pure, DOM-light, presentation-agnostic — textbook case for `shared/src/domain/compendium`.

- `web-dm/src/views/CampaignView/monsterPicker/hooks/useVirtualList.ts` vs `web-player/src/lib/monsterPicker/useVirtualList.ts`
- `web-dm/.../monsterPicker/utils.ts` vs `web-player/src/lib/monsterPicker/utils.ts`
- `web-dm/.../monsterPicker/hooks/useMonsterPickerRows.ts` vs `web-player/src/lib/monsterPicker/useMonsterPickerRows.ts`
- `web-dm/.../monsterPicker/types.ts` vs `web-player/src/lib/monsterPicker/types.ts`
- `web-dm/src/views/CompendiumView/panels/MonsterBrowserPanel.tsx` (486 lines) vs `web-player`'s equivalent (315 lines)

### [HIGH] Dice-expression evaluation implemented four separate times — *confirmed by 2 audits*
Not just style: `web-player/src/lib/dice.ts`'s `rollDiceExpr` uses `crypto.getRandomValues` with rejection sampling and supports additive dice groups (`1d4+6d8`); `web-dm/src/views/CombatView/utils/dice.ts`'s same-purpose combat HP-delta version has no crypto RNG and no multi-group addition, but does support parens and `*`/`/`. Two players rolling damage get different randomness quality depending which client they're on.

- `web-dm/src/tools/DiceCalculatorModal.tsx` (`rollAllDice`/`evalArith`)
- `web-player/src/tools/DiceCalculatorModal.tsx` (same shape, reformatted)
- `web-player/src/lib/dice.ts` (`rollDiceExpr`, used for HP-delta input)
- `web-dm/src/views/CombatView/utils/dice.ts` (also `rollDiceExpr`, different feature set)

### [MED] HP-delta string parsing duplicated verbatim — ✅ Completed
`web-player/src/views/character/CharacterHpDelta.ts:12-23` (`parseCharacterHpDelta`) and `web-dm/src/views/CombatView/utils/hpDelta.ts:7-24` (`parseSignedHpDelta`) — same sign-prefix parsing, same call into a local dice roller, different names.

### [LOW] Small formatters reinvented per app — ✅ Completed
web-dm has a proper `ordinal()` in `lib/format/ordinal.ts`; web-player hardcodes the same `["", "1st", "2nd", ...]` array inline in `CharacterItemSpellsPanel.tsx:114` and again in `CharacterSpellDrawer.tsx` instead of importing it.

### [LOW] `DraggableList` row-shell duplicated per app — ✅ Reviewed; shared mechanics retained
Both correctly delegate reorder mechanics to `shared`'s `usePointerDragReorder` — good — but the row wrapper (active state, icon slot, badges) around it is hand-rebuilt independently in each app (`web-dm/src/components/drag/DraggableList.tsx`, 157 lines vs `web-player/src/ui/DraggableList.tsx`, 103 lines) for mostly cosmetic reasons.

### [LOW] Two unconfirmed cross-checks worth a look — ✅ Reviewed; no duplicate found
web-player's `currencyMath.ts` (gold-input arithmetic, `evaluateCurrencyInput`) and the ability-modifier/HP-max formulas in `CharacterSheetUtils.ts`/`CharacterCreatorUtils.ts` are exactly the shape of thing that tends to get duplicated — flagged for a follow-up diff against web-dm's `AbilityTable.tsx` and `useCombatHpActions.ts`, not yet verified either way.

---

## `server` (138 files, 23.3k lines)

### Duplicate logic

**[MED] Campaign-exists-or-404 check, copy-pasted 13×.** The same `SELECT id FROM campaigns WHERE id = ?` → 404 block appears across `routes/campaigns.ts:156,174,248,259,294,309` (6×), `routes/binders.ts:428`, `routes/adminRoutes.ts:193`, `routes/treasure.ts:142,240`, `routes/binderLore.ts:195`, `routes/campaignBootstrap.ts:94`, `services/binders/nativeBinder.ts:227`. A `requireCampaignExists(db, id, res)` helper alongside the existing `requireParam` removes all of it.

**[HIGH] Compendium import engine: ~290 lines of near-identical per-category loops.** `services/compendium/nativeCompendium.ts:660-950` hand-repeats the same insert-loop shape for every content category (monsters, items, spells, classTalents, ...) — only the column list and per-entry extraction differ. A config-driven `{table, columns, extract}` loop would replace all ~8 copies and remove the main place a new category gets added with a copy-paste mistake.

**[LOW] Image-upload validate → resize → error boilerplate, 5×.** Identical mimetype-check + `resizeToWebP` try/catch across `routes/campaigns.ts:263-272`, `characters.ts:566-571`, `players.ts:480-487`, `binderMortals.ts:675-679`, `binderReferences.ts:528-531`. Worth a `handleImageUpload(req, res)` wrapper.

**[LOW] Two more small repeats.** A `z.string().trim().min(1).max(160)` name-field shape hand-typed 5× (`routes/binders.ts:58,66`, `binderLore.ts:20`, `binderMortals.ts:24`, `binderReferences.ts:95`) instead of living in `lib/schemas.ts`; the `error instanceof Error ? error.message : fallback` idiom repeated 11× across `bastions.ts` (×3), `binders.ts` (×2), `exportImport.ts`, `compendium/admin.ts` (×4).

### Oversized files

**[MED] `services/compendium/nativeCompendium.ts` — 1,007 lines.** Mixes batch parsing/validation, manifest/hash resolution, preview generation, and the import/export engine. → split into `nativeCompendiumParsing.ts`, `...Manifest.ts`, `...Import.ts`, `...Export.ts`.

**[MED] Binder route files hold business logic that belongs in `services/`.** `routes/binderMortals.ts` (680 lines), `routes/binderLore.ts` (478), `routes/binderReferences.ts` (566) each carry DTO-mapping, validation, and cross-record-linking helper functions sitting above route registration instead of in `services/binders/*`. Same shape, three files — worth fixing together.

### Other

**[HIGH] Two god route handlers carrying business-critical logic.**
- `PUT /api/encounters/:encounterId/combatants/:combatantId` (`routes/combat.ts:350-522`, ~170 lines) inlines field-merge resolution, HP/concentration-break detection, spell-name tracking (Hex/Hunter's Mark) with direct `user_characters` JSON patch, binder-NPC sync, and four separate WebSocket broadcasts.
- `PATCH /api/binders/:binderId/mortals/:mortalId` (`routes/binderMortals.ts:518-668`, ~150 lines) chains five sequential cross-entity validations (`isValidRace`, `isBinderRecordType` ×3, `playerLink`, `isValidMonster`) before a transactional subtype conversion.

Both should become one named service function each (`applyCombatantUpdate(...)`, `validateMortalPatch(...)`) — easier to test, harder to break by accident.

**[LOW] Inconsistent 404 error shape.** Some existence checks return `{ ok: false, message: "..." }`, others `{ ok: false }` with no message, some `{ ok: false, message: "Not found" }` — no fixed contract across `routes/campaigns.ts:157,175,249,310`.

**[LOW] Repeated player-row query.** `SELECT ${CAMPAIGN_CHARACTER_COLS} FROM players WHERE id = ?` re-typed 7+ times across `services/characters.ts`, `services/combat.ts`, `routes/characterFieldPatchRoutes.ts` (×3), `routes/combatAddCombatants.ts`, `routes/players.ts` (×3) — column list is already a shared constant, only the lookup wrapper (`getPlayerCharacterRow(db, id)`) is missing.

### Dead code

Genuinely clean. A full `ts-prune` pass found no truly unused exports, no stale commented-out blocks, and no orphaned feature-flag branches. No circular-import risk between `services/*` modules either. Heavy `any`/`as unknown as` casting is rare (7 hits total, mostly in tests).

---

## `shared` (88 files, 7.9k lines)

The headline finding for this package — what's *missing* from it — is the cross-app duplication section above (monster-picker, dice). What follows is duplication and structure *within* `shared` itself.

### Duplicate logic

**[MED] Two near-identical compendium search hooks.** `shared/src/domain/compendium/useItemSearch.ts` and `.../useSpellSearch.ts` both independently implement the same "available rulesets" fetch effect (useItemSearch.ts:72-92, useSpellSearch.ts:44-63), the same debounced-paginated-fetch-with-abort loop (useItemSearch.ts:94-167, useSpellSearch.ts:65-123), and the same `hasActiveFilters`/`clearFilters`/`refresh` trio — only the facet/filter specifics differ. A shared `usePaginatedCompendiumFetch(api, path)` core would remove ~80 duplicated lines and stop the two page-size limits (120 vs 180) from drifting further apart.

**[LOW] Same three-line Zod refinement, copy-pasted 20×.** The `.strict().refine(v => Object.keys(v).length > 0)` idiom appears 20 times across `grandCompendiumSchemas.monster.ts` (lines 85,96,104,125,137,145,155) and `.item.ts`. A `nonEmptyObject(shape)` helper in `grandCompendiumSchemas.shared.ts` collapses all of them.

### Oversized files

**[HIGH] `shared/src/ui/WysiwygNoteEditor.tsx` — 637 lines, the largest file in the package.** Four unrelated concerns share one file:
- Markdown ⇄ HTML conversion (lines 10-145): `escapeHtml`, `renderInlineMarkdown`, `markdownToHtml`, `htmlToMarkdown` — pure string/DOM-tree functions, zero React dependency.
- Selection/DOM utilities (147-246): `selectionRangeInEditor`, `closestInlineFormat`, `unwrapElement`, `findMentionTrigger` — generic contenteditable helpers.
- Mention-autocomplete state machine (326-391, plus dropdown JSX at 586-634): trigger detection, filtering, keyboard nav, insertion.
- The editor component + toolbar UI (248-637).

→ `markdownHtml.ts` and `contentEditableDom.ts` would become independently unit-testable without a DOM; `useMentionAutocomplete.ts` would isolate the trigger/filter/keyboard-nav logic. Right now none of it is testable without importing React.

### Dead code

**[LOW] `shared/src/ui/FieldGrid.tsx` — exported, zero consumers.** Confirmed via full-text search across `web-dm`, `web-player`, and `shared` itself. Safe to delete. Every other `ui/` export checked (ItemListRow, MiniTable, StatusDot, BinderDataTable, etc.) has at least one live consumer.

### Worth noting, not fixing

The API client layer is already doing the right thing — both apps' `services/api.ts` are thin re-exports over `shared/src/api/browserClient.ts`, and the compendium search hooks are legitimate wrappers rather than reimplementations. No `any`/schema-strictness abuse found either. Good precedent to protect when touching this package.

---

## `web-dm` (278 files, 30.4k lines)

### Duplicate logic

**[MED] Binder detail-view shell hand-copied between two record types.** `views/BinderView/ReferenceWorkspace.tsx` (714 lines, 9 record types) and `views/BinderView/MortalWorkspace.tsx` (556 lines) independently reimplement the same detail-page scaffold — accent-bordered header, inline-editable name, visibility toggle, edit/delete row, backlinks panel at the bottom — down to a byte-for-byte duplicated `VisibilityIcon` SVG in both files (`ReferenceWorkspace.tsx:38-44`, `MortalWorkspace.tsx:27-33`). The list-view scaffolding was correctly factored into `components/BinderListTable.tsx`; the detail-view scaffolding wasn't. A shared `BinderRecordDetailShell` would remove roughly 150-200 duplicated lines.

**[MED] A half-finished API migration on `PlayerRow`.** `views/CampaignView/components/PlayerRow.tsx` (211 lines) supports two incompatible prop APIs at once: `PlayersPanel.tsx:73` still passes the old `actions={...}` prop while `INpcsPanel.tsx:160,172` uses the newer `primaryAction`/`menuItems` API, forcing `PlayerRow.tsx:75-76` to branch on `hasLegacyActions`. Finishing the migration (migrate `PlayersPanel.tsx`, delete the `actions` prop and the branch) closes it out.

**[LOW] `ReferenceWorkspace.tsx` avoided copy-paste by becoming a flag matrix instead.** 9 record types are rendered from one file via booleans like `isDeities`, `showLeader`, `showDescription`, `isPlaceType`, `showDescriptionColumn`, `hasMiddleColumn`, `showIcon` (computed at lines 276-281) threaded through ~250 lines of JSX (e.g. 504-607). Not duplication, but a hard-to-follow conditional forest — a per-type config object driving a declarative render would read far better.

### Cross-app candidates

Monster-picker duplication covered above — this workspace's audit independently confirmed it in full. Two more, flagged but not cross-checked yet:
- `web-dm/src/lib/format/ordinal.ts` — generic `ordinal(n)` formatter, no D&D-specific logic.
- `web-dm/src/domain/utils/crParsing.ts` (`toNumberOrNull`, `parseCrToNumberOrNull`, `findNearestValue`) — generic CR-string parsing a player-side monster view would plausibly need too.

(Note: `web-dm/src/utils/compendiumFormat.ts` is already just a re-export shim from `@beholden/shared/domain` — good precedent to follow for the above.)

### Oversized files

**[MED] `views/BinderView/ReferenceWorkspace.tsx` — 714 lines.** Mixes 3 non-trivial subsections (`DeityDomainsSection`, `OrganizationLeaderSection`, `OrganizationMembersSection`, lines 60-265, each with their own fetch/mutate state), list-view rendering (618-713), detail-view rendering (444-616), and data loading/reload logic (315-353). → move the three `*Section` components to their own files; extract `ReferenceListView`/`ReferenceDetailView`; keep `ReferenceWorkspace.tsx` as a thin router (mirrors the shared-shell suggestion above).

**[MED] `views/BinderView/MortalWorkspace.tsx` — 556 lines.** Contains an entire saved-views/localStorage feature (`SavedMortalView`, `persistViews`, `saveView`, `applyView`, lines 47-225), a bespoke `SearchableFilter` combobox (69-102) that duplicates `components/SearchableSelect.tsx` — already imported one line above (line 11) for the other seven filters — plus list/detail rendering. → extract `useMortalSavedViews(binderId)`; replace the custom combobox with `SearchableSelect`/`SearchableMultiFilter`.

**[MED] `views/CompendiumView/panels/MonsterFormSections.tsx` — 509 lines.** Mixes pure data-transform functions (`monsterToForm:50-108`, `buildMonsterPayload:109-200`) with 6 exported section-rendering components (228-509) and two inline editors (`LairEditor`, `SpellReferenceEditor`). → move mapping functions into `monsterFormMapping.ts`; keep this file for rendering only.

**[MED] `drawers/drawers/CombatantConditionsDrawer.tsx` — 462 lines.** Mixes condition business rules (`cycleExpiry:36-42`, hex-ability claiming logic 68-90, caster-repeatability rules 17-33), a debounced-commit state machine (refs 52-56, commit logic from 93), and rendering. → extract `useConditionsDrawerState(drawer)`.

**[MED] `drawers/drawers/NameDrawer.tsx` — 365 lines.** One drawer switches on 6 unrelated `DrawerState` types (declared 14-25) with divergent logic — campaign editing pulls in binder-linking, a full "create new binder" sub-form (233-313), and a color picker; adventure/encounter editing is a one-field rename. Both `submit` (126-173) and the reset effect (47-83) reimplement the same 6-way switch. → split into `CampaignNameDrawer` (binder/color logic) and a generic `RenameDrawer`.

**[MED] `app/App.tsx` — 453 lines, `AppInner` doing too much.** Owns binder CRUD handlers (`handleCreateBinder`/`handleEditBinder`/`handleDeleteBinder`, 79-102), three separate cascading refresh functions (`refreshCampaign:103`, `refreshAdventure:131`, `refreshEncounter:161`), several URL/websocket-syncing effects, and the full route tree/layout. → move CRUD/refresh logic into the existing `store` layer rather than the root component.

**[MED] `views/CampaignView/monsterPicker/hooks/useMonsterPickerState.ts` — 377 lines, one hook doing two jobs.** Manages (a) the monster compendium index/search/filter/pagination (state 43-56, effects 58-141) and (b) per-added-monster override editing via **eight parallel `Record<string, X>` state maps** (`qtyById`, `labelById`, `acById`, `acDetailById`, `hpById`, `hpDetailById`, `friendlyById`, `attackOverridesById`, lines 34-41). → split into `useMonsterIndexSearch` and `useMonsterOverrides`; collapse the eight maps into one `Record<string, MonsterOverrideDraft>`.

### Other

**[MED] Eight parallel state maps instead of one (correctness risk).** Same finding as above (`useMonsterPickerState.ts:34-41`) — every update site has to touch multiple setters in lockstep, a real risk if one is ever missed.

**[MED] Focus-refetch exists on one Binder workspace, not the other.** `MortalWorkspace.tsx:308-323` listens for window focus/visibility changes to catch portrait uploads that happen out-of-band (comment explains: no websocket layer for Binder yet). `ReferenceWorkspace.tsx` has the identical scenario for deity portraits (`uploadBinderReferenceImage:466`) and does **not** have the same refetch. Reads like a real staleness bug, not a style inconsistency.

**[LOW] Bespoke `SearchableFilter` combobox duplicating `SearchableSelect` right next to its import** — see MortalWorkspace finding above.

**[LOW] Debounced-reload-on-typing, no shared hook.** The same 180ms-debounce-then-reload pattern is hand-written independently in `ReferenceWorkspace.tsx:327-330` and `MortalWorkspace.tsx:303-306` (and likely elsewhere). A `useDebouncedEffect` would remove the duplication and the risk of delay values drifting apart.

### Dead code

None found — no commented-out blocks, no stale TODO/FIXME markers, no orphaned files. The `actions`/`hasLegacyActions` branch above is the one piece of code mid-way to becoming dead.

---

## `web-player` (232 files, 40.9k lines)

### Duplicate logic — creator vs. level-up

The character creator and the level-up wizard are two independently-evolved implementations that both parse the same compendium data and both build `characterData.proficiencies`. Some of this was already unified this session (a shared `spellAcquisition.ts`, one canonical `chosenFeatOptions` key scheme) — what follows is what's still split in two.

**[HIGH] Two opposite strategies for building the same `proficiencies` map.** `CharacterCreatorProficiencyUtils.ts:81-595` (`buildProficiencyMap`) rebuilds the entire `ProficiencyMap` from scratch every render by re-walking class/race/background/feat effects. `buildLevelUpPayload.ts:11-340` instead patches deltas onto `char.characterData.proficiencies` category-by-category (lines 231-317), filtering entries by `source !== featSourceLabel` and merging via a bespoke `mergeTaggedEntries`/dedup helper (lines 73-80) that duplicates the intent of creator's `dedupeTaggedItems`. Every proficiency-category edge case — multiclass carry-through (creator lines 534-568 vs payload's `existing*Entries` filtering, lines 36-52) — is maintained twice, with two different mental models. A bug fixed in one (e.g. the documented Wizard-forgets-unprepared-spells fix at payload:268-272) has no guarantee of being applied to the other's equivalent case.

**[MED] `useCreatorChoiceData.ts` and `useLevelUpChoiceData.ts` — near-identical hooks.** Both fetch spell-choice and growth-choice options via `loadSpellChoiceOptions`/`buildGrowthItemLookupBody`/`fetchCompendiumItemsByLookup` (same imports, same effect shapes). Level-up's version (`useLevelUpChoiceData.ts:42-160`) tracks three separate spell-option maps (feat/class-feature/invocation) instead of creator's one merged map, and guards updates with `sameSpellChoiceOptionMap`/`hasKeys` (from `LevelUpHelpers.ts`) where creator (`useCreatorChoiceData.ts:33-101`) uses ad hoc inline equality checks. Strong candidate to collapse into one parameterized hook.

**[LOW] Same "did the selection actually change" guard, two names.** `useCharacterCreatorSanitizers.ts:12-18` defines a local `selectionMapChanged`; `useLevelUpChoiceSelections.ts`/`useLevelUpSelectionSanitizers.ts` import `sameSelectionMap`/`hasKeys` from `LevelUpHelpers.ts`. Same job, two implementations, neither file imports the other's despite both being pure functions with no wizard-specific dependency.

**[LOW] Two parallel type hierarchies for one compendium shape.** `CharacterCreatorProficiencyTypes.ts` (`CreatorClassDetailLike`, `CreatorSpellSummaryLike`, etc.) and `LevelUpTypes.ts` (121 lines: `LevelUpClassDetail`, `LevelUpFeatDetail`, `LevelUpSpellSummary`, etc.) describe the same underlying compendium JSON from two independently-maintained files rather than one shared domain type with view-specific extensions.

**[LOW] Three near-identical locked-selection-id blocks.** `lockedCantripSelectionIds`/`lockedSpellSelectionIds`/`lockedInvocationSelectionIds` in `useLevelUpChoiceSelections.ts:208-244` are three near-identical `useMemo` blocks (reconcile → filter by preparedSpellProgressionGrantedKeys → slice) differing only in which count variable and filter predicate is used — candidate for one parameterized `resolveLockedSelectionIds` helper.

### Oversized files

**[HIGH] Two 500+ line "kitchen sink" hooks — and they're the same sink.** — ✅ Re-scoped and partially completed; see Remediation progress. `useCharacterCreatorDerivedState.ts` (530) and `useLevelUpDerivedState.ts` (586) each mix 15+ unrelated computed-value concerns — class-feature/race-trait effect parsing, 5 near-identical spell-choice-source shapes, skill/tool/language/save proficiency-choice derivation, growth-choice definitions, prepared-spell-progression — behind one call. Concrete split for **both**: extract a `useSpellChoiceSources` hook (the 5 `stepN...SpellChoices` blocks), a `useClassFeatureEffects`/`useRaceTraitEffects` hook, and a `useGrowthAndProficiencyChoices` hook. Doing this for both simultaneously is what would let the creator/level-up duplication above actually get reconciled instead of just relocated.

**[MED] `CharacterCreatorView.tsx` — 716 lines, 9 sequential effects.** Already partly decomposed (hydration/submit/sanitizers live in separate hooks), but still runs 9 back-to-back effects for class/race/bg detail loading and choice-resetting (lines 249-523), including 5 sanitizer-style effects that independently recompute `resolvedScores`/`deriveRaceAbilityBonuses` 3+ times per render pass (lines 414-415, 440-441).

**[MED] `CharacterCreatorSpeciesStep.tsx` (739) and `CharacterCreatorBackgroundStep.tsx` (770).** Both pair a giant prop-typed render function (30+ individually destructured props, e.g. `CharacterCreatorSpeciesStep.tsx:54-137`) with all of its JSX body in one function. Split point: "pick from list + search", "choice resolution" (skills/tools/languages/feat), and "ability score assignment" each have a natural seam given distinct prop clusters.

### Other

**[MED] `CharacterCreatorStepContext.ts` has degraded into an untyped grab-bag.** 97 lines, 60+ fields, threaded into all 11 step render functions — and five fields are explicitly typed `any`/`any[]`: `getStep5ChoiceState` (line 66), `step5ClassFeatChoices` (71), `step5ChoiceState` (77), `growthChoiceDefinitions` (90), `preparedSpellProgressionChoiceDefinitions` (91). TypeScript can't catch a wrong shape reaching any step that reads them.

**[LOW] Duplicate `resolvedScores` computation** — same issue as the `CharacterCreatorView.tsx` finding above.

### Worth noting, not fixing

The step-shell pattern (`StepHeader`, `NavButtons` in `CharacterCreatorParts.tsx`; shared style constants in `CharacterCreatorStyles.ts`) is already properly extracted and reused 52 times across all 10 step files — the "repeated hand-copied shell" concern this audit went looking for turned out to already be solved. The remaining smell is the flat prop list (above), not duplicated markup.

### Dead code

**[LOW] `migrateClassFeatureChoiceKeys` (`ClassFeatureChoiceMigration.ts:10-32`)** — live, single-call-site migration (`CharacterCreatorView.tsx:217-229`) that fuzzy-matches a legacy `classfeature:` key scheme. Not dead, but worth a follow-up: confirm no saved character still lacks the canonical key, then retire the fuzzy-match fallback and its test file.

**[LOW] `CharacterCreatorRaceParseUtils.ts`** — misleadingly named 16-line file containing only equipment-option parsing (`parseStartingEquipmentOptions`), re-exported through `CharacterCreatorUtils.ts:34` and actively used. Not dead, just mis-filed — low-cost rename/relocate.

**[Gap, not a finding]** No exhaustive unused-export sweep (`ts-prune`) was run across all 232 files in this pass — everything manually sampled traced back to at least one call site, but a dedicated tool pass would be needed to close this out with confidence.

---

## Method

Four read-only agent passes, one per workspace, run in parallel; no files modified. The web-dm and web-player passes were each asked to flag cross-app duplication candidates independently; the shared-workspace pass then verified them against both apps directly — three-way agreement on the monster-picker and dice findings is why those are called out first.

Compiled 2026-08-03.
