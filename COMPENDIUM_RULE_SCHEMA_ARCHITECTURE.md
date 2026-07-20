# Where the compendium's rule schemas should live

Tracks one specific open question carried over from `COMPENDIUM_SOURCE_OF_TRUTH.md`'s "Decisions and open questions": *"Decide whether shared rule schemas belong in the existing shared workspace or in a dedicated domain package."* Split into its own document because resolving it is a real refactor, not a one-line answer, and it shouldn't compete with that document's per-category work log.

This document does not replace `COMPENDIUM_SOURCE_OF_TRUTH.md` (Claude's category work log) or `COMPENDIUM_VALIDATION.md` (the canonical completion gate). It is scoped to one cross-cutting architecture question those two don't own.

## Current state (audited 2026-07-20)

The eight rule categories' Zod schemas — `BackgroundSchema`, `ClassTalentSchema`, `StructuredFeatureEffectSchema`, and the rest — live exclusively under `server/src/services/compendium/grandCompendiumSchemas.*.ts`. They are server-only: nothing outside `server/` imports them.

The `shared` workspace (`@beholden/shared`, consumed by `server`, `web-player`, and `web-dm` alike — 14 server files already import from it, e.g. `shared/src/domain/items.ts`'s `itemModifierBonus`, `shared/src/domain/conditions.ts`'s `hasZeroSpeedCondition`) already holds a `domain/compendium/` folder, but today it's limited to *display* helpers (item search, spell-detail projection, rules-reference text) — not the rule schemas themselves.

The practical consequence: the client never sees the canonical schema. `web-player`'s creator and character-sheet code hand-maintains its own parallel TypeScript shapes for the same facts (`InventoryItem`, `RaceDetail`, `BackgroundLike`, etc. in `CharacterInventory.ts`, `CharacterCreatorTypes.ts`, `backgroundCompaction.ts`) built by eyeballing what the server's API responses currently return. Nothing keeps those two descriptions of "what a background/species/item looks like" in sync except discipline — the exact one-fact-two-homes shape tenet 3 exists to catch everywhere else in this project.

## The decision

**Recommendation: the existing `shared` workspace, not a dedicated package.**

- `shared` already plays exactly this role for other domain logic (conditions, item modifiers, monster helpers) that both server and client need to agree on byte-for-byte.
- Zod is isomorphic — nothing about `StructuredFeatureEffectSchema` or `BackgroundSchema` requires a server-only runtime.
- Server already depends on `@beholden/shared` (real, existing dependency edge, not a new one this would introduce) — moving schemas there doesn't create a new cross-package relationship, just relocates definitions along an edge that already exists.
- A dedicated package would need its own workspace entry, `tsconfig` project reference, and build wiring for no benefit over the folder that already exists and is already imported by all three apps.

Rejected alternative: **a dedicated domain package.** Would only make sense if the rule schemas needed a release/versioning lifecycle independent of `shared`'s other contents (e.g., published externally, or intentionally decoupled so client and server could run different schema versions). Nothing about this project's single-deployment, single-database model needs that; it would be infrastructure for a problem this app doesn't have.

## What "moving" actually means

Not a lift-and-shift. The migration would need to happen per-category, mirroring how Species/Feats/Backgrounds already migrated to cold data one slice at a time in `COMPENDIUM_SOURCE_OF_TRUTH.md`:

1. Move one category's Zod schema (e.g., `grandCompendiumSchemas.background.ts` → `shared/src/domain/compendium/backgroundSchema.ts`), re-export from the server module so no import path breaks mid-migration.
2. Replace that category's hand-maintained client-side type (e.g., `BackgroundLike` in `backgroundCompaction.ts`) with `z.infer<typeof BackgroundSchema>`, or the read-projected subset of it the client actually needs.
3. Delete the now-redundant hand-maintained shape once every consumer reads the inferred type.
4. Repeat per category. Items and Monsters are the biggest (largest schema files, most consumers); Backgrounds or Species are the smallest and are a reasonable first slice to prove the pattern, matching how Species proved the trait-effects pattern in July.

Not started. No schema files have moved. This document exists to hold the decision and the plan, not to claim work done.
