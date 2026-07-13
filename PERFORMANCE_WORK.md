# Performance Work Coordination

This file coordinates performance work between Codex and Claude. Update the status and notes in this file when starting or completing an item, and avoid editing files owned by the other active worker.

## Current baseline

- Production builds already use route-level lazy loading, compression, hashed assets, and several manual chunks.
- DM startup currently selects the first campaign and can trigger campaign, adventure, player, NPC, note, treasure, and encounter requests while the user is still on Home.
- The DM drawer chunk was approximately 87 KB gzip in the July 13, 2026 production build.
- The player shell and Home can request `/api/me/characters` concurrently.
- Hashed `/assets/*` files were not served with explicit long-lived immutable caching.

## Six-point execution plan

| # | Owner | Work item | Expected result | Status |
| --- | --- | --- | --- | --- |
| 1 | Claude | Lazy-load DM drawer implementations | Remove the approximately 87 KB gzip drawer chunk from initial Home loading while preserving every drawer | Completed |
| 2 | Claude | Stop eager DM campaign hydration on Home | Avoid campaign/adventure/encounter collection requests until a campaign route needs them; preserve deep links and websocket behavior | Completed |
| 3 | Codex | Cache hashed production assets | Repeat visits reuse versioned JS/CSS for one year without making HTML stale | Completed |
| 4 | Codex | Coalesce duplicate player character bootstrap calls | Player shell and Home share one concurrent `/api/me/characters` request | Completed |
| 5 | Codex | Defer secondary player-shell work | Load the dice calculator only when opened and run the update check during browser idle time | Completed |
| 6 | Codex | Design and implement campaign bootstrap consolidation | Replace the remaining cluster of campaign-route requests with a measured, scoped bootstrap response without over-fetching | Completed |

All six improvements are in scope. Item 6 intentionally follows item 2 because both change the DM campaign-loading boundary; doing them concurrently would create avoidable conflicts and make request-count regressions harder to diagnose.

## Item 6 acceptance criteria

- Capture the request count and transferred payload for Home and a representative campaign route after item 2 lands.
- Consolidate only requests that are always required together on campaign entry.
- Do not include full compendium data or combat data that is owned by route-specific live hooks.
- Preserve granular websocket delta handling and existing mutation refresh behavior.
- Compare request count, total transferred bytes, and time-to-usable campaign screen before and after.
- Add route-level tests for authorization and response shape, plus production browser verification.

## Coordination constraints

- Preserve the existing Last Seen changes currently in the working tree.
- Do not edit Codex-owned files while their status is `In progress`.
- Do not combine unrelated cleanup with performance changes.
- Preserve deep links to campaign, roster, and combat routes.
- Keep websocket scope and campaign selection behavior correct.
- Run `npm run typecheck`, `npm test`, and the relevant production build after changes.
- Record completed work, tradeoffs, and verification results below.

## Phase two

| Improvement | Outcome | Status |
| --- | --- | --- |
| Cancel stale navigation requests | Campaign, adventure, and encounter hydration now abort older requests; aborts never trigger the development fallback retry | Completed |
| Coalesce repeated reads | Added keyed in-flight GET sharing and applied it to websocket list fallbacks; the existing keyed debounce queue remains the first layer | Completed |
| React rerender audit | 23 store consumers inspected; 22 read state and only one is dispatch-only, so a risky selector-store rewrite was not justified without browser profiler evidence | Audited; no rewrite |
| Uploaded image caching | API image URLs now carry `updated_at` versions; versioned image requests receive one-year immutable caching while unversioned requests retain one-hour caching | Completed |
| SQLite ordering | Added expression indexes matching the actual `COALESCE(sort, 9999), updated_at DESC` query order for campaign collections | Completed |
| Bundle regression budgets | CI now enforces 160 KiB DM and 170 KiB Player initial-JS gzip budgets after production builds | Completed |
| Shared request foundation | Shared browser API now supports keyed in-flight reads and correct abort propagation | Completed |

## Completion notes

### Compendium rule source-of-truth follow-up

- Codex removed all runtime `Tough` name checks and hard-coded `level × 2` HP calculations from character creation, level-up, character display, Home normalization, and startup character synchronization.
- Feat maximum-HP bonuses now use a shared evaluator backed by the current compendium prose and structured feat effects. The server importer also derives numeric per-level HP scaling from feat prose instead of assigning Tough's multiplier by name.
- Base `hpMax` no longer absorbs a newly selected feat's deterministic bonus during level-up; derived feat HP remains separate, preventing double application and allowing later compendium edits to recalculate it.
- Verification: full `npm run verify` passes with 412 tests (292 server, 114 player, 6 DM), both production builds, payload budgets, and bundle budgets. Lint retains the existing single DM hook warning and no errors.

- Codex: hashed files under DM `/assets` and player `/player/assets` now receive `Cache-Control: public, max-age=31536000, immutable` through Express. HTML and non-hashed static files retain the existing revalidation behavior.
- Codex: `fetchMyCharacters()` now coalesces concurrent calls while a request is in flight. The player shell uses the same function as Home, removing the duplicate startup request without retaining stale results after completion.
- Codex verification: `npm run typecheck`, `npm test` (407 tests), and `npm run build` passed. Lint passed with one pre-existing `CombatantConditionsDrawer.tsx` hook dependency warning and no errors.
- Codex: the player dice calculator is now a dynamic chunk loaded only when opened, and the update check is scheduled with `requestIdleCallback` (with a timed fallback). The player entry chunk decreased from 65.51 KB to 64.52 KB gzip; the 1.81 KB gzip calculator chunk is deferred. Player typecheck, all 112 player tests, player production build, and repository lint passed (same pre-existing warning only).
- Codex: applied the same secondary-shell deferral to the DM UI. Name Generator, Dice Calculator, Deck of Many Things, and Bastions are separate on-demand chunks, and the DM update check runs during browser idle time. The DM entry chunk decreased from 32.61 KB to 9.48 KB gzip. DM typecheck, all 6 DM tests, and the DM production build passed.
- Codex item 6 groundwork: added a server regression test proving hashed DM/player assets remain immutable while HTML does not. The test is part of the normal server suite.
- Codex item 6 groundwork: optimized note summary routes to select only list fields instead of reading and materializing full note text that the response discarded.
- Codex item 6 groundwork: replaced treasure-summary N+1 compendium lookups with one indexed `LEFT JOIN`, while leaving full-detail hydration unchanged. Server typecheck and all 290 server tests passed after these changes.
- Codex item 6: added `GET /api/campaigns/:campaignId/bootstrap` and switched DM campaign hydration to it. The response contains only the five collections always loaded together: adventures, players, iNPCs, campaign note summaries, and campaign treasure summaries. Adventure-specific and combat data remain route/live-hook owned.
- Codex item 6 measurements on the representative local campaign: Home now makes 2 initial data requests totaling 1,279 uncompressed JSON bytes. Campaign hydration changed from 5 requests totaling 3,432 bytes to 1 request totaling 3,488 bytes (56 bytes of envelope overhead). Local round-trip time was 12.08 ms; the main benefit is avoiding four additional authenticated network round trips on remote connections.
- Codex item 6 verification: added authorization, missing-campaign, and stable response-shape coverage. Full typecheck, 409 tests (291 server + 112 player + 6 DM), lint (one pre-existing hook warning only), and both production builds passed. Production HTTP behavior was measured directly; in-app browser automation was unavailable because its sandbox handshake failed.
- Codex phase-two verification: the complete `npm run verify` pipeline passes: typecheck, 409 tests, both production builds, payload budgets, and initial-bundle budgets. Lint has the same single pre-existing `CombatantConditionsDrawer.tsx` hook warning and no errors. Current initial JS is 144.13 KiB gzip for DM (160 KiB budget) and 155.58 KiB for Player (170 KiB budget).
- Claude item 2: `AppInner` in `web-dm/src/app/App.tsx` still runs `refreshAll()` (meta + campaign list + `autoSelectFirstCampaign`) unconditionally on mount, but the effects that fetch a campaign's adventures/players/iNPCs/notes/treasure (`refreshCampaign`), its adventure's encounters/notes/treasure (`refreshAdventure`), and an encounter's combatants (`refreshEncounter`) are now gated behind a new `onCampaignRoute` flag (`Boolean(matchCampaignExact || matchCampaignSub)`, from the existing route matchers). `autoSelectFirstCampaign` still runs so Home/TopBar can show a campaign link, but that no longer implies a data fetch. Direct links, refresh, and back/forward all still work because the existing route-param-sync effect (unchanged) sets `selectedCampaignId` from the URL before/independently of the gate, and the gate re-evaluates whenever `onCampaignRoute` flips true, so re-entering a campaign route always re-fetches even if `selectedCampaignId` didn't itself change. Roster/combat routes match via the existing `matchCampaignSub` pattern, and websocket scoping (`useAppWebSocket`, `useWsScope`) was untouched — it still tracks `selectedCampaignId`/`selectedAdventureId`/`selectedEncounterId` regardless of route, matching prior behavior.
- Claude item 1: `web-dm/src/drawers/registry.tsx` now lazy-loads each of the 13 drawer implementation modules individually via `React.lazy(() => import(...))`, wrapped by a small `lazyDrawer()` helper that also renders the shared `Drawer` shell (title/close/footer) so the implementation's hooks and the shell mount together per drawer type. Prop types for each lazy wrapper come from `Parameters<typeof X>[0]` on `import type` bindings, so no drawer-implementation code is pulled in just for typing. `DrawerHost.tsx` wraps the selected drawer's element in `<React.Suspense>` (keyed by the same per-type/per-id key the old `DrawerWrapper` used) with a `DrawerLoadingFallback` that renders the real `Drawer` shell with a "Loading…" body — so the drawer's title and Close button are present immediately, only the body/footer are deferred. All 15 `DrawerState` variants are still covered by the same exhaustive `switch` in `getDrawerRegistration`, unchanged from before except each branch now returns a JSX element instead of calling the drawer function directly.
  - **Chunking gotcha:** the first attempt kept `vite.config.ts`'s existing `manualChunks` rule that bucketed all of `/src/drawers/` (including the now-eager `DrawerHost`/`registry` glue) into one `dm-drawers` chunk. Because that rule also swept in the 13 (now dynamically-imported) implementation files, Rollup still had to ship the whole bucket eagerly — no size change at all. Narrowing the rule to `/src/drawers/drawers/` only fixed the glue/implementation split but still produced one 263 KB monolithic async chunk (all 13 drawers bundled together) with a stray static `import` from `index.js`, because forcing 13 otherwise-independent dynamic-import targets into a single named chunk defeats Rollup's own splitting. The fix was to remove the manual bucket for `/src/drawers/` entirely and let Rollup's automatic per-module splitting take over — it now emits one small chunk per drawer (roughly 0.5–9.7 KB gzip each, e.g. `SpellBookDrawer` 0.51 KB, `INpcDrawer` 2.97 KB), none of them referenced from `index.html`'s `modulepreload` list or statically imported by `index.js`.
- Claude verification: `npm run typecheck`, `npm test` (408 tests: 290 server + 112 player + 6 web-dm), and `npm run build:web-dm` all passed.
  - Baseline (this session, Codex's items 3–5 already applied, Claude's items 1–2 not yet applied): `dm-drawers` chunk 267.07 KB / 87.18 KB gzip, always present in `index.html`'s `modulepreload` list. True initial payload (entry + all modulepreloaded chunks) = 165.42 KB gzip.
  - After: no `dm-drawers` (or any other drawer) chunk appears in `index.html` at all; each of the 13 drawer implementations is its own small on-demand chunk fetched only when that drawer type is first opened. True initial payload (entry + all modulepreloaded chunks) dropped to 148.64 KB gzip — a ~17 KB gzip (~10%) reduction versus the baseline above, on top of the qualitative win of the ~87 KB of drawer code no longer being fetched at all until a drawer is opened. (Total build output also grew a few KB overall because shared UI code that was previously duplicated across the eager entry and the forced `dm-drawers` bucket is now correctly deduplicated into one shared chunk used by both — this is expected and is reflected in the initial-payload number above, which is the number that matters for Home's load cost.)
  - Not verified this session: a live browser click-through of drawer open/save/close and the Home→campaign network-request sequence. No browser-automation tooling (chromium-cli, an existing Playwright setup) was available in this environment, and installing one felt too invasive to do unilaterally in a shared working tree with Codex's concurrent, uncommitted changes. The route-gating and lazy-loading logic was verified by full code read-through (including the `autoSelectFirstCampaign`/route-matcher interaction and the Suspense/key structure) plus the automated checks above; a manual browser pass is recommended before shipping.

## Claude pre-commit review of Codex's items 3–6 + phase two

Ran a full recall-biased review (typecheck, 409 tests, both prod builds, payload + bundle budgets, lint, plus 5 independent finder passes + manual source verification) across all of Codex's uncommitted work before the user committed it. Note: the user committed this work (bundled with an unrelated compendium fix) as `e494898 "Pushing new Tough and spoeed boosts"` while this review was still in progress, so the items below need follow-up commits rather than pre-commit fixes.

**Confirmed bugs — need a Codex fix:**

1. **Versioned image URLs get written back into DB columns that expect clean paths.** `dbConverters.ts`'s `readVersionedImageUrl` bakes `?v=<updated_at>` into every `imageUrl` the API returns. Two write-back sites treat that return value as a clean path and store it verbatim: `characters.ts:514/533` (`POST /api/me/characters/:id/assign` writes `char.imageUrl`, from `rowToCharacterSheet`, into `players.image_url`), and `exportImportHelpers.ts:35,148` (campaign import writes the exported `campaign.imageUrl`/`player.imageUrl`, from `rowToCampaign`/`rowToCampaignCharacter`, into `campaigns.image_url`/`players.image_url`). Each subsequent read appends another `&v=...` on top since the stored value already contains `?`, so the column pollutes further with every assign or import cycle and permanently bakes in whatever `PUBLIC_API_ORIGIN` was set at that moment. Fix needs a "clean path" accessor (e.g. read `row.image_url` directly, or a helper that strips the query before any DB write) used at both sites instead of the versioned converter output.
2. **Note list views lost title inference.** The `view=list` fast path added in `notes.ts` (lines ~98, ~136) selects `title` raw via SQL and skips the `titleFromNoteText`/`readNoteState` fallback (`dbConverters.ts` lines 167–187) that infers a display title from the note body when the stored title is still the default `"Note"`. `campaignBootstrap.ts`'s `readNoteSummaries` (line 63) duplicates the same query and has the identical gap. Any note relying on auto-inferred titles now shows literally "Note" in the campaign/adventure notes list and in the bootstrap payload (now the primary path on every campaign load), while the note's own detail view still shows the correct inferred title. Fix needs the list query to either also select `text` and run inference in JS, or replicate the inference logic in SQL — whichever preserves the original "don't materialize full note text for list views" intent from the item-6 groundwork note above.
3. **Portrait cache-version is tied to the whole row's `updated_at`, not the image itself.** `readVersionedImageUrl` uses the same `updated_at` that combat HP/condition/override edits bump (~10 UPDATE statements across `combat.ts`/`players.ts`/`characters.ts`). During active combat this forces a full portrait re-download on nearly every action instead of a cheap 304, working against the immutable-caching goal for exactly the highest-churn entities. Needs either a dedicated image-version column/timestamp separate from the row's general `updated_at`, or falling back to plain etag/lastModified revalidation for these specific rows.

**Lower priority, not blocking (left as-is):**

4. `apiCoalesced()` (`shared/src/api/browserClient.ts`) doesn't dedupe against plain `api()` calls to the same URL — a narrow race where `App.tsx`'s adventure-open fetch can still duplicate a websocket-triggered `apiCoalesced` fetch to the same endpoint. Real but rare (needs two DMs/concurrent tabs hitting the same adventure at the same moment).
5. `useLastCharacter` (`web-player/src/app/AppShell.tsx`) lost true request cancellation on unmount when it switched to the shared `fetchMyCharacters()` dedup promise — investigated and this is actually correct behavior, not a bug: aborting a *shared* in-flight promise on one consumer's unmount would incorrectly cancel it for every other consumer relying on the same coalesced request. Left alone.

### Codex follow-up fixes for the pre-commit review

- **Versioned image write-back fixed:** added `cleanStoredImageUrl()` and used clean storage values for campaign/player imports and character-to-campaign assignment. Local uploaded URLs are reduced back to their path, repeated `v` parameters are removed, and `PUBLIC_API_ORIGIN` is no longer persisted into local image columns.
- **Image-specific cache versions added:** campaigns, players, and user characters now have an additive, idempotently migrated `image_updated_at` column. Existing portraits are backfilled once from `updated_at`; converters version image URLs from `image_updated_at`; only upload, delete, import, and character-image copy paths update it. HP, condition, override, and other row edits no longer invalidate portrait URLs.
- **Note title inference restored:** registered the existing note-title inference as a deterministic SQLite function and used it in campaign/adventure compact note queries and campaign bootstrap. SQL returns only the resolved title and summary fields to Node, so list responses do not materialize full note bodies.
- **Regression coverage:** added tests for clean imported image paths, image-version migration idempotence/backfill, image versions remaining independent of general row updates, and inferred bootstrap note titles.
- **Optional coalescing race:** deliberately deferred; it remains lower priority and was not mixed into these blocking fixes.
- **Verification:** `npm run typecheck`, all 415 tests (295 server + 114 player + 6 DM), `npm run build:web-dm`, `npm run build:web-player`, and `npm run check:bundle-budgets` pass. Initial JS remains 144.21 KiB gzip for DM and 155.67 KiB for Player, under the 160/170 KiB budgets.

**Claude fixed directly (small, contained UI fixes):**

- **Tool modals lost their internal state on close/reopen.** `ToolsBar.tsx` and `AppShell.tsx` switched from always-mounted-with-toggled-visibility to conditionally-mounted (`{open === id && <Modal .../>}`) when lazy-loading the tool modals, so each modal's own `useState` was destroyed on every close. Worst case was `DeckOfManyThingsModal`, which re-shuffled a fresh deck (losing track of drawn cards) on every reopen. Fixed by tracking an `everOpened` set (DM) / `diceEverOpened` flag (player): each modal now mounts lazily on its *first* open (still triggering the dynamic import only then) and then stays mounted, with `isOpen` toggling visibility exactly like before lazy-loading — preserving both the on-demand chunk loading and the original state-persistence behavior. Verified: `npm run typecheck` (web-dm + web-player), both test suites (6 DM + 114 player), both production builds, and `npm run check:bundle-budgets` (144.21 KiB DM / 155.67 KiB Player, both still under budget) all pass.
