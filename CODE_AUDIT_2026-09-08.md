# Codebase audit — 2026-09-08

## Ninth pass — party currency writes

- Removed the currency popup's independent API call and stale optimistic rollback. Writes now belong to the campaign synchronization controller and apply the server-confirmed balance.
- Currency writes synchronously reject overlapping submissions and invalidate preceding reads. Reads triggered during a write are deferred to a reconciliation fetch after completion or failure. Retired campaign controllers suppress write results.
- The popup remains open with a visible error on failure, preserves its input for retry, and disables editing/dismissal while saving. Popup state is keyed by campaign.
- Added three controller tests for overlapping writes/older reads, failure reconciliation/retry, and completion after campaign disposal.
- Full verification passed: 371 server + 416 Player + 51 DM tests (838 total), typecheck, lint, builds, payload and bundle budgets, and diff whitespace checks. Browser interaction remains untested.
- Further findings requiring their own fixes: character item transfer currently spans separate save/delete requests (not an atomic transfer), and full-character inventory saves still need concurrent-edit analysis. Currency changes above do not solve those paths or multi-client server write conflicts.

## Eighth pass — party inventory read ordering

- Extracted party inventory/currency synchronization from character inventory enrichment into a dedicated hook and independently testable campaign-scoped controller.
- Retired campaign controllers ignore all pending responses. The hook clears inventory, capacity and currency when campaign scope changes or disappears.
- Per-item request ordering prevents a late upsert from restoring a deleted item or replacing a newer update. Different items still update independently.
- Full snapshots overtaken by inventory events are discarded and trigger a debounced reconciliation. Accepted snapshots retire older pending item reads. Currency uses latest-request ordering.
- Kept targeted item reads and the existing debounced full-refresh queue; failed current item reads still fall back to a full refresh. Completed item request tracking is released.
- Seven controller regression tests cover delete/upsert races, independent items, snapshot reconciliation, snapshot/item ordering, currency ordering, disposal, and fallback.
- `npm run verify` passed: 371 server + 413 Player + 51 DM tests (835 total), typecheck, lint, builds, payload and bundle budgets. Initial gzip JS remains DM 157.85 KiB and Player 156.03 KiB. `git diff --check` passes. No browser/live-WebSocket smoke testing performed.
- Scope: these guards cover synchronization reads, not every optimistic mutation callback or server-side concurrent-write conflict.

## Seventh pass — Binder inline drafts

- Replaced duplicated campaign/NPC inline-editor state and save handlers with `useRichTextDraft`.
- Background value refreshes no longer replace an active draft. A successful save closes the editor only if its draft still matches the submitted text; typing during the request remains available for another save.
- Save failures now show an alert and preserve the draft. A synchronous guard prevents duplicate submissions and cancellation during an active save; completion after unmount does not update editor state.
- Campaign workspace state is keyed by Binder/campaign identity, and NPC note editors by Binder/record identity, preventing drafts from carrying into another record. This is not a complete audit of the enclosing NPC reload lifecycle.
- Added four controlled-hook regression tests. `npm run verify` passed: 371 server + 406 Player + 51 DM tests (828 total), typecheck, lint, builds, payload and bundle budgets. `git diff --check` passes. No manual browser testing in this pass.
- Campaign-scoped inventory response ordering remains an inspection target from pass six.

## Sixth pass — asynchronous saves and refreshes

- Character creation now clears catalog choices on ruleset changes and ignores results from retired requests. Slow responses for the previous ruleset cannot replace the current class/race/background/feat lists; campaign loading also ignores results after cleanup.
- Extracted shared profile submission into `useProfileSave`. Account, password, and display forms share a synchronous in-flight guard; closing the view aborts the request and suppresses late account/token updates. This does not roll back a save already received by the server.
- Fixed the shared debounced refresh queue: synchronous callback exceptions no longer leave it permanently busy, and cleanup cancels timers and prevents queued follow-up work after unmount.
- Inventory refresh callbacks now return their promises so the queue tracks actual completion. Failed item refreshes no longer pass an Error object as a timer delay.
- Added eight controlled-hook regression tests covering catalog switching/clearing, competing profile saves, cleanup, retry, synchronous refresh failures, coalescing, and unmount.
- `npm run verify` passed: 371 server + 406 Player + 47 DM tests (824 total), typecheck, lint, production builds, payload budgets, and bundle budgets. Initial gzip JS: DM 157.85 KiB, Player 156.03 KiB. No manual browser testing in this pass.
- Further inspection targets: campaign-scoped inventory responses and Binder campaign draft/save lifecycle. These are not covered by the fixes above.

## Fifth pass — behavioral regressions and bounds

- Fixed an infinite rejection-sampling loop for dice with more than 2^32 sides. The shared evaluator now rejects expressions over 4,096 normalized characters, nesting beyond 64 levels, and more than 10,000 total dice per expression. Invalid input still returns zero.
- Corrected a regression introduced by the earlier calculator deduplication: calculators again retain negative results and floor each division. HP inputs retain their existing nonnegative/final-rounding behavior. Both modes use one parser.
- Fixed virtual-list ranges when a filter shrinks results below the saved scroll position. Empty results no longer retain a large spacer; short results are visible immediately. Normal large lists still render a bounded window.
- Replaced the update-submit state guard with a synchronous ref guard, closing the interval before React rerenders. Failed updates release the guard for retry.
- Added seven regression tests: oversized dice/counts, nesting, calculator/HP semantics, filtered list shrinkage, empty lists, bounded rendering, and repeated update requests before rerender.
- `npm run verify` passed: 371 server + 398 Player + 47 DM tests (816 total), clean typecheck/lint, builds, payload budgets and bundle budgets. Initial gzip JS: DM 157.85 KiB, Player 155.99 KiB. Browser interaction has not been manually exercised in this pass.

## Fourth pass — completed

- Removed both calculator-local dice parsers in favor of the established shared dice engine.
- Consolidated DM/Player update checking and guarded update submission against repeat requests.
- Reduced Knip findings to intentional public facade types and semantic icon aliases; removed the stale forwarding module and accidental exports it identified.
- Added cancellation/stale-result protection to feat lists, Binder identity, Binder dashboard/health, Binder global search, campaign mentions, and admin campaign/member loads. Previously several rejected promises were unhandled and older searches or Binder IDs could overwrite newer state.
- Added visible failure states to Binder identity saves and admin/Binder resource loads.
- Shared Binder resource loading between dashboard and health views.
- Final clone scan at this stage reports 54 lines (0.05%) across two presentation similarities; forcing those together would add a broad prop abstraction without removing behavior.

## Third pass — completed

- Shared DM/Player monster-browser data loading, filters, pagination, facets and alphabetical indexing through `useMonsterBrowser`; DM editing remains isolated. Facet responses now also respect aborts.
- Shared the complete account settings form while retaining app-specific theme adapters. Validation, password cleanup, text preview and save errors now have one implementation.
- Both dice calculators now use the existing shared, strict dice-expression engine. Removed two private arithmetic/dice parsers that disagreed with the rest of the application.
- Shared update-check/update-start state between DM and Player and prevented repeated update requests while one is already running.
- Removed the stale nested DM lockfile (`@beholden/web`, React 18, router 6). The repository is an npm workspace and the root lockfile is authoritative.
- Removed the unused monster-picker forwarding file, an unused DM icon, unused service/type forwarding exports, and made eleven internal helpers private instead of exposing accidental APIs. Public compendium facade types, inventory types, and semantic icon aliases remain intentionally exported.
- Fixed stale requests in the character feat picker and Binder identity drawer. Binder identity save failures and admin campaign/user loading failures are now visible instead of becoming unhandled or silent rejections.
- Exact-clone scan now reports 54 duplicated lines (0.05%) in 672 files. The two remaining matches are presentation-shell/prop-shape similarities and should only be extracted when the component boundary improves clarity.

## Second pass — completed

This section supersedes first-pass findings 1, the authentication-context part of 2, the treasure-row part of 3, and 4 below.

- Fixed the WebSocket fallback/reconnect race in a React-independent connection owner. Only the current socket can deliver events; retired sockets have their handlers detached; timeout/error/close share one retry path. Cleanup cancels pending timers. Reconnects resolve the current token again. Five fake-socket/timer regression tests cover fallback, queued stale events, double failure events, cleanup, and refreshed tokens.
- WebSocket subscriptions now depend on stable subscribe/setScope callbacks, avoiding unnecessary resubscription and duplicate scope sends when connection status changes.
- Consolidated auth contexts into `shared/src/ui/AuthContext.tsx`. Revision guards and effect cleanup prevent stale verification/login responses from overwriting logout or a newer session. Player now follows DM's behavior of clearing a token only on 401/403 rather than on transient network errors. Context values are memoized. Four deferred-response tests cover these paths.
- Extracted shared combat list/detail SQL projection and row mapping into `server/src/routes/combat/mergedCombatant.ts`, preserving the existing single joined query and permission middleware. A route test confirms identical list/detail responses for both player and monster rows. Correction: the original finding was read projection/mapping duplication, not combat initialization.
- Extracted `TreasureRow` for both standalone treasure and combat carried-loot panels. Quantity, award, removal, and click propagation now have one implementation; panel-specific drawer behavior remains explicit. Two action regression tests added.
- Full verification passed after all changes: 371 server + 391 Player + 47 DM tests = 809, clean typecheck/lint, builds, payload budgets, and bundle budgets. DM initial JS: 157.36 KiB gzip; Player: 154.65 KiB gzip. `git diff --check` passes.
- Exact-clone scan now reports 255 duplicated lines (0.24%) in 671 files with unchanged thresholds, down from 406 after the first pass. This does not measure semantic duplication or runtime speed.

Still open: account form submit/presentation duplication, monster-browser presentation, other small clone groups, classification of remaining exported-only declarations, and deeper character workflow decomposition. Real-browser/iPad and live-network smoke tests remain outstanding; the new regression tests use controlled hooks/sockets and actual HTTP routes.

## Scope and limits

Repository-wide static scans of server, shared, DM and Player source; targeted manual review of flagged code, request effects, profile settings, drag ordering, and WebSocket transport. This is not a claim that every source line or interactive workflow was manually verified. Existing uncommitted version, dependency, DM display and drag styling changes were preserved.

Tools: existing Knip configuration; exact-clone scan with minimum 20 lines / 150 tokens (tests and icon directories excluded); TypeScript, ESLint, existing test suites, production builds and payload/bundle budgets. Clone thresholds miss smaller and structurally similar duplication.

## Implemented

- Consolidated identical DM/Player WebSocket implementations into `shared/src/ui/webSocket.tsx`. Existing service files re-export the same API. Transport behavior is unchanged; future fixes have one implementation.
- Fixed shared pointer reorder persistence: the latest order is now written synchronously to a ref, so releasing before a render/effect flush cannot save an older order. Secondary mouse buttons no longer start dragging; unchanged final orders avoid redundant saves.
- Added three regression tests covering batched move/release, cancellation/no movement, and secondary-button handling. Tests use a deferred-render hook harness, not a browser.
- Player Binder requests now ignore stale responses and clear previous loading errors/data. Loading no longer discards URL-selected records, preserving refresh/deep-link navigation.
- Linked Mortal statblock requests use scalar link dependencies, eliminating the hooks warning without reloading because a parent constructs a new link object.
- Both profiles share text-scale preview cleanup: leaving without saving restores the saved scale. Failed display saves now show an error rather than reject without UI feedback.
- Removed six confirmed unreferenced style helpers: inventory stepper, spell-charge button, character add button, creator small button, home export icon button and compendium row action button. Removed their unused imports; made the internally used panel-header style helper private.

Removed source remains recoverable from Git history. No application data or images were removed.

## Remaining findings / next priorities

1. **WebSocket lifecycle needs focused transport tests.** The existing fallback path can open a replacement socket while the old socket's `onclose` still schedules a reconnect and clears `socketRef`. Handlers close over the mutable `ws` variable. Follow-up: per-connection identity guards, one fallback/reconnect owner, and fake-socket tests for timeout/error/close/unmount sequences. The consolidation intentionally preserves this behavior rather than silently changing network semantics without those tests.
2. **Authentication and account forms remain duplicated.** The clone scan confirms matching auth contexts and profile submit logic. Extract an injected shared account controller, keeping app-specific redirects and theme presentation at the edges. Add authentication/logout and failed-save tests before combining context ownership.
3. **Monster browser and treasure row presentation repeat substantial blocks.** Candidates: both `MonsterBrowserPanel` implementations, `TreasurePanel` and `MonsterCarriedLoot`. Extract row/filter presentation with explicit permissions/actions; do not accidentally expose DM editing controls to players.
4. **Combat route initialization repeats about 32 lines.** `server/src/routes/combat/core.ts` has duplicated creation/initialization paths. A shared initialization helper merits route-level regression coverage for both paths before extraction.
5. **Large character workflows remain modularization candidates.** Creator background/species steps, derived sheet state and level-up choice assembly have different responsibilities. Split by rules/data preparation versus presentation; preserve creator rebuild versus level-up delta semantics. File size alone is not evidence of wasted runtime work.
6. **Initial DM bundle has little headroom:** 157.16 KiB gzip against a 160 KiB budget. Keep feature-only imports out of eager shared barrels. This pass does not claim measurable runtime speedups; its strongest gains are fewer maintenance copies and corrected request/drag behavior.
7. **Remaining Knip results need classification, not blanket deletion.** Internal image/auth helpers are used locally even though their exports are unused. Shared icon pairs are semantic aliases. DTO/barrel exports and compatibility WebSocket type exports were retained. Knip is therefore not clean; it reports 11 unused-export file groups, five exported-type groups and three duplicate alias groups.

## Verification

- `npm run verify`: passed, including clean typecheck and lint, 370 server + 382 Player + 45 DM tests (797 total), builds and both budget checks.
- `git diff --check`: passed (Git emits Windows line-ending normalization notices).
- `npm audit --omit=dev`: zero reported production dependency vulnerabilities.
- Exact-clone scan: 703 duplicated lines / 0.65% before shared transport extraction; 406 / 0.38% after, under the same thresholds. Final scan covered 669 files. These are source-maintenance metrics, not bundle savings.
- Browser/iPad interaction and live WebSocket reconnect behavior were not exercised during this pass.
