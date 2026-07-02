# V2 Current Status

Reconciled against the implementation and full development corpus on 2026-06-30.
This document supersedes the original combat-content and player-options audits
that initiated the V2 work.

## Current guarantees

- All nine compendium categories have strict canonical V2 schemas.
- Every entry in every development XML corpus converts, validates, imports,
  exports, and round-trips through canonical storage.
- Unknown XML fields fail closed instead of disappearing silently.
- The primary corpus conserves every top-level source entry.
- Canonical-only fields survive legacy-compatible API reads and edits.
- Existing canonical rows receive idempotent startup backfills.
- Export All produces a ZIP containing all nine editable category batches.

## Reconciled combat-content findings

The former high-impact monster, item, and spell losses are resolved and covered
by corpus contracts:

- Monsters preserve alignment, ancestry, lore description, initiative, passive
  perception, NPC status, recharge data, legendary/lair categories, explicit
  attacks, spellcasting, and spell references.
- Items preserve detail, range, Strength requirements, rolls, attunement
  requirements, and distinct same-name entries.
- Spells preserve roll formulas and their scaling level/description.
- Spells normalize school names, casting-time units, range units, durations,
  source citations, and class lists. Earlier V2 exports are normalized during
  import, including removal of `School: ...` pseudo-classes.
- Decks and bastions have strict schemas and fixtures, although the WotC 2024
  source does not contain representative entries for those categories.

## Class consumer audit

| Area | Canonical V2 | Player consumer |
|---|---|---|
| Spellcasting ability | Preserved | Used for class spell and feature scaling |
| Starting wealth | Preserved | Informational; starting inventory comes from equipment choices |
| Saving throw, skill, armor, weapon, and tool proficiencies | Structured | Used by character creation |
| Levels, spell slots, resources, and recovery | Structured | Used by creation, sheet, and rests |
| Feature rolls and prepared-spell progression | Structured | Displayed and used by progression choices |
| Feature modifier/special/proficiency elements | Typed legacy envelopes | Recognized mechanics are applied; unknown semantics become narrative/reference data |

Remaining class edge cases:

- Every top-level class description is preserved in `descriptions[]`; the first
  remains available as `description` for compact displays.
- Resource reset values other than `S` and `L` fail closed with a clear import
  error instead of silently becoming long rest.
- Not every bespoke feature paragraph is automatically executable. This is
  intentional where table adjudication is required; Beholden is not a dice
  resolver.

## Species consumer audit

| Area | Canonical V2 | Player consumer |
|---|---|---|
| Size, speed, vision, resistances | Structured | Used by creation and derived sheet state |
| Spellcasting ability | Preserved | Applied to species spell features |
| Skill/tool/language/feat choices | Structured | Used by character creation |
| Trait rolls and prepared-spell progression | Structured | Displayed and used by progression |
| Trait modifiers, specials, and proficiencies | Preserved as typed fields | Runtime behavior primarily comes from the trait prose parser |
| Resolution | Automatic/manual/mixed metadata | Visible on player feature entries |

The last row is preserved without data loss, but it is not a universal automatic
execution contract. Current WotC mechanics such as Dwarven Toughness and
Integrated Protection are handled from deterministic prose; adjudicated traits
remain player-facing features.

## Background consumer audit

| Area | Canonical V2 | Player consumer |
|---|---|---|
| Skills, tools, languages, ability choices, and feats | Structured | Used by character creation |
| Trait mechanics and prepared-spell progression | Structured | Displayed and consumed like species traits |
| Starting equipment description | Preserved verbatim | Display fallback |
| Starting equipment choices | Structured option/entry data | Used for selection, compendium lookup, quantities, currency, and initial inventory |

All 38 primary-corpus backgrounds containing A/B packages produce both
structured options. Backgrounds with no package or free-form custom purchasing
rules retain prose only because no deterministic item package exists.

## Feats

All 239 primary-corpus feats carry an explicit conservative resolution:

- 9 automatic
- 10 manual
- 220 mixed

Unreviewed feats remain mixed until deliberately promoted. Manual and mixed
effects remain visible and never invoke a dice resolver.

## Closure status

V2 is closed for data-model and migration purposes:

- Unsupported recovery semantics fail closed.
- Multiple class descriptions are lossless.
- Class features and species/background traits carry conservative resolution
  metadata, shown on the player feature list.
- Authenticated canonical detail endpoints convert both V1 and V2 stored rows
  to V2 on read.
- Character creation, level-up, and character-sheet feature loading now use the
  canonical class/species/background endpoints through one client adapter.

Legacy detail routes remain temporarily available for DM forms and older
clients during rollout. Removing those compatibility routes is post-migration
cleanup, not a prerequisite for converting live data.
