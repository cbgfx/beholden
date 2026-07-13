# Compendium as the Source of Truth

This document coordinates the removal of hard-coded game rules from Beholden. The compendium should define deterministic game content; application code should evaluate that content consistently.

## Objective

Changing a deterministic rule in the compendium should update existing characters the next time their current data is loaded, without requiring a code change.

Characters should persist only information that cannot be reconstructed safely:

- Player decisions and selections
- Mutable state such as current HP, used resources, conditions, and inventory state
- Manual overrides explicitly entered by a player or DM
- Historical rolls or outcomes that must not be replayed

Characters should not persist deterministic bonuses as permanent copies when those values can be derived from current compendium definitions.

## Current baseline

- Feat details are looked up from the current compendium when a character loads.
- Feat maximum-HP effects now use current feat prose or structured mechanics.
- Runtime `Tough` name checks and hard-coded `level × 2` calculations have been removed.
- Some class, species, equipment, condition, and summary rules still use name-based or numeric fallbacks.
- Creation, character-sheet, Home, campaign, and server normalization calculations are not yet backed by one shared derivation pipeline.

## Six-phase plan

| # | Phase | Outcome | Owner | Status |
| --- | --- | --- | --- | --- |
| 1 | Species rules | Movement and species benefits come from the selected species entry | Unassigned | Not started |
| 2 | Class rules | Class and subclass features use structured compendium effects | Unassigned | Not started |
| 3 | Equipment rules | Armor, shields, weapons, and item effects use item properties | Unassigned | Not started |
| 4 | Conditions and combat rules | Conditions use canonical definitions and a shared evaluator | Unassigned | Not started |
| 5 | Shared character derivation | All screens use one calculation pipeline | Unassigned | Not started |
| 6 | Legacy compatibility removal | Old snapshots and fallbacks are migrated and retired | Unassigned | Not started |

## 1. Species rules

### Current hard-coded behavior

- Species names can be used to infer walking speed.
- Known species have fallback speed values in client and server code.
- Character creation may retain default speed assumptions when compendium data is incomplete.

### Target design

- Read base movement from the selected species compendium entry.
- Represent walking, flying, swimming, climbing, and burrowing movement explicitly.
- Evaluate species traits through structured effects where they modify derived statistics.
- Store only the selected species ID and any player choices.

### Acceptance criteria

- Changing a species' walking speed updates an existing character after reload.
- A custom species works without adding its name to application code.
- Character creation, character sheet, Home, and campaign summaries agree.
- Missing or invalid species data produces a visible validation problem instead of silently guessing from the species name.
- Species-name speed tables and recognition expressions are removed.

## 2. Class rules

### Current hard-coded behavior

- Class names can be used to infer hit dice.
- Barbarian Unarmored Defense and Fast Movement have compatibility fallbacks.
- Ranger Roving and Bard Jack of All Trades include name-based detection.
- Some Rage behavior and progression are implemented as special cases.

### Target design

- Encode deterministic class and subclass features as structured effects.
- Apply effects according to class level, character level, subclass, equipment state, and active conditions.
- Read hit dice and progression exclusively from class compendium entries.
- Keep actions requiring player or DM judgment marked as manual effects.

### Acceptance criteria

- Editing a structured class feature updates an existing character after reload.
- Renamed or custom classes work without code changes when they provide equivalent mechanics.
- Multiclass level context is handled explicitly.
- Creation, level-up, sheet, Home, and campaign summaries agree.
- Class-name hit-die and feature fallbacks are removed.

## 3. Equipment rules

### Current hard-coded behavior

- Shields are assumed to grant a fixed AC bonus.
- Armor categories determine Dexterity behavior through application logic.
- Stealth disadvantage and some weapon properties are inferred from names or categories.
- Inventory may contain copied item statistics that can become stale.

### Target design

- Define armor, shield, weapon, and item mechanics in structured item properties.
- Inventory entries reference compendium item IDs and store only character-specific state such as quantity, equipped state, attunement, notes, and overrides.
- Use one item-effect evaluator in creation previews, character sheets, and summaries.
- Preserve explicitly detached or customized inventory items as local snapshots.

### Acceptance criteria

- Changing an item AC value or restriction updates linked inventory after reload.
- A custom shield bonus works without editing application code.
- Armor Dexterity caps, Strength requirements, and Stealth disadvantage come from item data.
- Missing referenced items are reported and do not silently become a different item.
- Legacy copied items have a defined migration or detached-item policy.

## 4. Conditions and combat rules

### Current hard-coded behavior

- Specific conditions set speed to zero or apply fixed speed penalties.
- Incapacitation and concentration interactions are encoded in server transitions.
- Exhaustion and some Rage interactions use fixed calculations.
- Player and DM surfaces can interpret condition behavior separately.

### Target design

- Add canonical structured condition definitions.
- Use a shared condition evaluator for derived modifiers and restrictions.
- Keep the server authoritative for applying, expiring, and removing combat state.
- Store condition instances separately from their definitions: source, duration, stacks, ownership, and expiry remain mutable state.

### Acceptance criteria

- Player sheet and DM combat derive the same result from the same condition.
- Editing a deterministic condition modifier updates active characters safely.
- Concentration ownership and expiry remain server-authoritative and fully tested.
- Condition definitions cannot execute arbitrary code.
- Existing combat transition regression tests continue to pass.

## 5. Shared character derivation

### Current hard-coded behavior

- Creation, level-up, character sheet, Home, campaign mirrors, and server normalization perform overlapping calculations.
- Stored derived summaries can become stale until a character sheet synchronizes them.
- Compatibility paths may calculate the same statistic differently.

### Target design

Create one deterministic character-derivation pipeline whose inputs are:

- Current character selections and mutable state
- Current class and subclass entries
- Current species and background entries
- Current feats and choices
- Current linked equipment and inventory state
- Current conditions and manual overrides

Its outputs should include ability scores, maximum HP, AC, movement, initiative, saves, skills, senses, defenses, resources, and other display summaries.

### Acceptance criteria

- Creation preview, saved character, Home card, campaign card, and character sheet produce identical derived values.
- The evaluator is deterministic, side-effect free, and covered by fixture tests.
- APIs can batch-load all required compendium references without N+1 requests.
- Mutable state is not overwritten when deterministic maximums change.
- Compendium revisions invalidate or bypass stale derived caches.

## 6. Legacy compatibility removal

### Current hard-coded behavior

- Older characters can rely on inferred names, copied statistics, and stored derived summaries.
- Removing fallbacks immediately could change or temporarily hide values for legacy characters.

### Target design

- Audit existing character records for missing or unresolved compendium references.
- Provide a dry-run migration report before changing records.
- Preserve player decisions and detached custom content.
- Recalculate only deterministic derived data.
- Remove obsolete fields and fallback logic after migration coverage is confirmed.

### Acceptance criteria

- Migration is idempotent and can be previewed before it writes.
- A database backup and rollback procedure are documented.
- Unresolved references are listed for manual resolution.
- No player choices, current HP, inventory state, or manual overrides are lost.
- Name-based and numeric compatibility fallbacks are removed only after production data passes the audit.

## Implementation sequence

Recommended order:

1. Species rules
2. Class rules
3. Equipment rules
4. Shared character derivation
5. Conditions and combat rules
6. Legacy compatibility removal

The shared derivation phase should follow initial species, class, and equipment modeling so it is built around the intended structures. Condition migration follows after the non-combat evaluator is stable because combat state carries higher operational risk.

## Coordination rules

- Claim a phase or bounded subtask in the table before editing it.
- Record important files and design decisions in the work log below.
- Do not modify files owned by another active worker without coordinating first.
- Keep each phase independently testable and suitable for its own commit.
- Do not combine schema expansion, data migration, and fallback deletion in one irreversible step.
- Preserve stable compendium IDs whenever definitions are edited.
- Add a regression test showing that a changed compendium value reaches an existing character.
- Run the full verification pipeline before marking a phase complete.

## Required verification per phase

- Relevant parser and effect-evaluator unit tests
- Character derivation fixture tests
- Server authorization and migration tests where applicable
- `npm run typecheck`
- `npm run lint`
- `npm test`
- Production builds
- Manual browser checks of creation, Home, character sheet, and affected DM views
- Database backup before applying any production migration

## Work log

### Completed groundwork

- Codex: Removed runtime Tough name checks and hard-coded `level × 2` feat HP calculations.
- Codex: Added shared feat maximum-HP effect evaluation using current compendium prose or structured mechanics.
- Codex: Kept base HP separate from deterministic feat bonuses during level-up.
- Verification: Full repository verification passed with 412 tests, production builds, and budget checks. One existing unrelated DM hook lint warning remains.

### Active work

No phase is currently assigned.

### Decisions and open questions

- Decide whether shared rule schemas belong in the existing shared workspace or in a dedicated domain package.
- Define how linked compendium items differ from intentionally customized detached items.
- Decide whether derived summaries are calculated on every read or cached with a compendium revision.
- Determine how compendium revisions are identified and propagated to already-open clients.
- Define administrator UX for unresolved legacy references and invalidated player choices.
