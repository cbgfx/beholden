# Remaining Work

This file tracks current work only. Completed implementation history belongs in Git.

## Current status

- Multiclassing is complete across persistence, prerequisites, progression, spellcasting, level-up, character-sheet presentation, export/import, rests, and regression coverage.
- World Actions and player-facing Engaged Enemies are complete.
- Compendium bundle import remains the supported workflow; users must not be required to import one category at a time.
- The 2014 XML migration is complete. All future 5e work advances the canonical JSON.

## Canonical 5e data

`compendium/WotC_5e_only.json` is the canonical 2014 rules bundle and is intentionally gitignored. The server does not read it directly at runtime; it is imported through the Compendium Import screen.

`compendium/WotC_5e_only.xml` was a one-time migration input. Never regenerate or overwrite the canonical JSON from the XML, raw conversion output, an intermediate migration stage, or a failed validation result.

For every content change:

1. Start from the current canonical JSON.
2. Make a targeted edit or use an idempotent JSON-to-JSON migration.
3. Write migrations to temporary output first.
4. Run applicable content validators, the subclass audit when relevant, strict Grand Schema validation, and the full application verification suite.
5. Replace and import the canonical file only after validation passes.

### Audit snapshot

Verified against the canonical JSON on 2026-07-22. Refresh these counts after content passes.

- 13 classes and 1,269 class features: 480 base-class and 789 subclass features.
- Base classes: 183 `automatic`, 24 `mixed`, 273 `manual`.
- Subclasses: 32 `automatic`, 42 `mixed`, 715 `manual`; 74 subclass features contain supported structured mechanics.
- 18 species and 296 traits: 52 `automatic`, 26 `mixed`, 218 `manual`.
- 18 mixed species traits still contain 56 legacy `source_modifier` records.
- 48 backgrounds, all with structured starting equipment.
- 249 feats: 7 `automatic`, 12 `mixed`, 22 without mechanics, and the remainder with incomplete grants.
- 77 class talents: 23 maneuvers and 54 Eldritch Invocations.

## 5e automation backlog

### 1. Class and live-play gaps

- Eldritch Versatility needs a way to revisit a specific earlier Mystic Arcanum choice at levels 12, 16, and 19.
- Cantrip Formulas needs an every-Long-Rest replacement action on the live character sheet, not another creator or level-up choice.
- Free-form selections such as Favored Enemy's specific humanoid peoples remain player notes.
- Validate representative level 1–20 characters for every class before the live 5e bundle import.

### 2. Subclass features

Continue converting genuinely mechanical subclass prose into supported effects, choices, resources, rolls, and scaling. Leave table-adjudicated behavior `manual`.

Priority clusters:

- Remaining proficiency-choice variants that require either/or categories.
- Divine Strike and Potent Spellcasting, after safe consumers and gates exist.
- Extra Attack, after the runtime can display or consume attack count.
- Circle of the Land terrain spell tables and Genie patron spell tables, both requiring nested choices.

The six campaign-priority builds have already been audited from levels 1–20. Their remaining manual features are blocked by missing vocabulary or are intentionally table-managed.

### 3. Species traits

Review the remaining 218 manual traits, ignoring pure lore such as Description, Age, and Alignment.

Mechanical priorities:

- Dragonborn Breath Weapon, using its 2014 ancestry/save/shape/recharge rules.
- Gnome Cunning, Relentless Endurance, Savage Attacks, and Sunlight Sensitivity.
- Stone's Endurance and Healing Hands-style activated abilities.
- The 56 legacy `source_modifier` records in mixed traits.

### 4. Feats

Continue through the 22 feats without mechanics and feats with incomplete grants.

Known blockers:

- Savage Attacker: no reroll vocabulary.
- Dual Wielder: no weapon-state-gated AC bonus.
- Mage Slayer: no triggered reaction attack or short-radius save-advantage gate.
- Metamagic Adept: feats cannot yet grant class-talent choices.
- Strixhaven Initiate: spell choices do not yet support verified literal named-spell option pools.

Physical-combat feats still needing review include Crossbow Expert, Sharpshooter, Great Weapon Master, Polearm Master, Sentinel, Shield Master, Charger, Mounted Combatant, and Dungeon Delver.

## Missing runtime vocabulary

Do not mark a feature automatic merely because its data shape exists. Confirm that a runtime consumer exists and that its gate accurately scopes the effect.

Known gaps include:

- Extra Attack count.
- Expanded critical-hit range.
- Resource-spend and target-specific gates for conditional attack/damage bonuses.
- Generic cantrip damage ability modifiers.
- Healing amount modifiers and maximized healing dice.
- Triggered/reaction attacks and turn-scoped conditional advantages.
- Disease and magical-sleep immunity.
- High-altitude acclimation, carrying-capacity categories, and armor-donning restrictions.
- Blindsense distinct from blindsight.
- Check floors based on raw ability score.
- Regaining resources from specific roll outcomes.
- Several narrative or complex features, including most College of Glamour abilities.

`gate.notes` is descriptive unless a consumer explicitly recognizes its value. Never use prose-only notes as a mechanical gate.

## Compendium import performance

Complete:

- Large compendium uploads spool to temporary disk and clean up on success or failure.
- Preview stages validated bundles behind a 15-minute, unguessable, single-use token.
- Import reuses the staged preview instead of uploading and parsing the bundle twice.
- Category and ZIP exports stream SQLite rows rather than retaining category-sized arrays or JSON strings.
- Opt-in compressed-wire egress logging is available through `BEHOLDEN_LOG_EGRESS=true`; query strings are omitted.

Remaining:

1. Measure a real deployment during import/export and identify any unexpectedly large post-import routes. Set `BEHOLDEN_LOG_EGRESS_MIN_BYTES=0` only for short diagnostic sessions.
2. Consider incremental JSON parsing only if disk-backed uploads and preview reuse still leave unacceptable peak memory. Preserve cross-category validation and atomic transactions.

## Release gate

Before replacing canonical data or publishing a release:

1. Run dedicated content validators and strict Grand Schema validation.
2. Run `npm run verify`.
3. Confirm representative 2014 and 2024 characters still create, level, edit, rest, export/import, and render correctly.
4. Recalculate audit counts when canonical content changes.
