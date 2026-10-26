# Test ownership and conventions

Run `npm test` for all suites, or `npm run verify` for typechecks, lint, tests, production builds, budgets and the production smoke check.

## Ownership

- Server HTTP, SQLite, migration and filesystem contracts belong in `server/src`, next to the route or service.
- Player and DM interactions belong with their application views. Cross-component persistence and reconnect scenarios belong in an integration suite.
- Shared implementation tests currently run through the consuming app that supplies their environment. Pure shared rules and player-facing shared UI are primarily tested in web-player; DM integration remains in web-dm; shared schemas and persistence contracts are tested on the server. Root CI always runs all three.
- A test under web-player may exercise shared behavior used by both apps; its folder is not a claim of exclusive coverage. Avoid copying the same test into each app. Test each app's distinct integration separately.
- Reusable browser test support lives under `shared/src/tests`. It must not be imported by production modules. A separate shared runner can be introduced when it has a concrete ownership or execution benefit.

## React and asynchronous work

Use real React rendering, effects, rerenders and unmounts. `shared/src/tests/renderHook.ts` provides a small real-React hook harness; component tests use createRoot and act. Mock external APIs and transport boundaries instead of React itself. Do not inspect hook slots or invoke effects by their position.

Use deferred promises for request ordering and fake timers for debounce/retry behavior. Keep move and pointer-up in one act when testing React's batching. An editor-preservation test should check DOM identity, expansion and unsaved text, not only a callback count.

Use jsdom for browser-dependent initialization, including storage. Do not silence warnings globally. Keep timer cleanup and root unmounts explicit in UI tests.

## Fixtures and suite size

Use explicit canonical records rather than normalizing every fixture through a production adapter. A malformed-input test should reach the boundary being tested with its malformed fields intact. Native compendium samples are stored in `nativeCompendium.fixtures.ts`; schema samples are in `grandCompendiumSchemas.fixtures.ts`.

Name support modules `*.fixtures.ts`, not `*.test.ts`. HTTP fixtures may register per-worker before/after hooks so each focused test file gets its own database and server. Keep scenario-local setup inside the test or describe block, especially for state mutations.

Split by behavior or boundary rather than an arbitrary line count. Preserve distinct regression cases across splits. Unit, HTTP and interaction tests may cover the same rule for different reasons; compare their contracts before deleting any of them.

## Retiring tests

Remove a test when its supported behavior is deliberately removed, when its target has no production callers and is retired with it, or when stronger coverage demonstrably subsumes the same contract. Preserve migrations while their upgrade paths remain supported. Test counts, line coverage and passing status alone do not establish usefulness.

For critical regressions, temporarily disabling the relevant protection and confirming that the focused test fails is useful evidence. Restore the exact source afterward; this is not a substitute for the full verification command.
