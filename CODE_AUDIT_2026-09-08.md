# Codebase audit — 2026-09-08

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
