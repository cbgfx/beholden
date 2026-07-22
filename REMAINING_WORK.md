# Remaining Work

## Multiclassing

The persisted character shape already allows more than one class through `characterData.classes`, but most consumers still assume that `classes[0]` represents the entire character. Multiclass support therefore needs to begin in the data and rules layer before adding the level-up interface.

### 1. Canonical class selections — Complete

Store one entry per class:

```ts
classes: [
  {
    id: "class_fighter",
    classId: "c_fighter",
    className: "Fighter",
    level: 3,
    subclass: "sc_fighter_battle_master"
  },
  {
    id: "class_wizard",
    classId: "c_wizard",
    className: "Wizard",
    level: 2,
    subclass: null
  }
]
```

Establish the invariant that the character's total level is the sum of all class levels:

```ts
character.level = sum(characterData.classes[].level)
```

Implemented shared normalization and regression tests for stable class-entry identities, invalid levels, accidental duplicate entries for the same class, and total-level derivation at the server persistence boundary.

### 2. Multiclass rules in class data — Complete

Expand the Grand Class Schema's existing `multiclass` data to include:

- Ability prerequisites.
- Multiclass armor, weapon, skill, and tool grants.
- Spellcasting contribution: full caster, half caster, third caster, or Pact Magic.
- Class-specific multiclass exceptions.

Implemented typed ability prerequisites, reduced multiclass proficiency grants, full/half/third/Pact Magic contributions, Artificer round-up behavior, and third-caster ownership for Eldritch Knight and Arcane Trickster. Full starting proficiencies and equipment remain distinct from the reduced grants received when a character adds a class after level 1.

### 3. Class-aware progression — Complete

Every progression calculation must use the level of the relevant class entry rather than the character's total level. This includes:

- Class and subclass features.
- Resources and their scaling.
- ASI and feat levels.
- Cantrips, prepared spells, and spells known.
- Invocations, maneuvers, masteries, and expertise.
- Subclass eligibility.
- Hit dice.

Implemented separate total-character and selected-class levels throughout the existing progression path. Class and subclass features, resources, ASIs, spell progression, expertise, invocations, growth choices, subclass gates, and level-up persistence now use class level; proficiency bonus, XP, feat eligibility, and character-wide scaling continue to use total character level. For example, a Fighter 3 / Wizard 2 receives Fighter level-3 progression and Wizard level-2 progression, not level-5 progression from both classes.

### 4. Derive the sheet from every class — Complete

Load canonical details for every class entry and aggregate:

- Class and subclass features.
- Structured effects.
- Resources.
- Proficiencies without duplicates.
- Hit-dice pools grouped by die size.
- Spellcasting sources.

Feature, resource, and choice identities must include a stable class source so identically named features from different classes cannot collide.

Implemented ordered loading of every canonical class detail while retaining the first class as the compatibility/presentation class. The runtime now aggregates class and subclass features, structured effects, class-level resources with class-scoped keys, primary starting proficiencies plus reduced fixed multiclass grants, hit-dice pools grouped by die size, and explicit per-class spellcasting-source records. Each class is evaluated at its own level and subclass, and class feature identities include the stable class-entry ID.

### 5. Multiclass spellcasting — Complete

Implement a dedicated multiclass spellcasting calculation for:

- Combined caster level and shared Spellcasting slots.
- Pact Magic slots kept separate from shared slots.
- Prepared and known spells calculated independently for each class.
- Spellcasting ability, save DC, and attack bonus per class.
- Always-prepared and subclass-granted spells.
- Stable ownership of each learned, prepared, or granted spell.

Replace or extend global class-choice fields such as `chosenCantrips`, `chosenSpells`, `preparedSpells`, and `chosenInvocations` so their entries are scoped to a stable class entry.

Implemented the shared multiclass caster-level table with full, half-down, half-up, and third-caster contributions. A character with only one Spellcasting class retains that class's own slot progression, while multiple Spellcasting classes use the combined table. Pact Magic remains in independently tracked short-rest pools and can coexist with shared slots. The sheet exposes per-class spellcasting ability, save DC, attack bonus, preparation limit, known choices, and Pact ownership. New level-up spell selections are persisted under stable class-entry IDs and class spell/invocation proficiency records carry their owning class source; legacy global fields remain as a primary-class compatibility fallback.

### 6. Multiclass level-up flow — Complete

At the start of level-up, allow the player to:

- Increase an existing class.
- Add a new class.

When adding a class, the flow must:

- Check its multiclass prerequisites.
- Show and apply only its multiclass proficiency grants.
- Exclude starting equipment.
- Add the class at level 1.
- Apply its level-1 features and choices.
- Use its hit die for the HP increase.
- Recalculate shared and Pact Magic spell slots.
- Preserve choices and progression belonging to every existing class.

Implemented an explicit level-up target selector for advancing any owned class or adding a class at level 1. Adding a class validates the ability prerequisites of both the destination class and every owned class, blocks confirmation when any requirement fails, applies only fixed and chosen reduced multiclass proficiencies, and never grants starting equipment. The selected class controls its hit die, HP choice, subclass gates, features, resources, spell choices, and class-scoped spell ownership. Persistence updates only the selected class entry or appends a stable new entry, preserving every other class and its choices; the completed character sheet then recalculates shared and Pact Magic slots through the multiclass spellcasting engine.

### 7. Character-sheet presentation - Complete

Update the character header, class display, features, resources, hit dice, and spellcasting panels to represent all class entries clearly while retaining a primary class for presentation where needed.

Complete. The sheet header now lists every class, level, and resolved subclass name while retaining the primary class for single-value presentation defaults. Multiclass features and resources identify and group their owning class, hit dice are displayed and persisted as separate die-size pools, and multiple spellcasting classes receive distinct ability, save DC, attack bonus, preparation, and Pact Magic summaries alongside their shared multiclass slots.

### 8. Verification

Add end-to-end regression characters covering at least:

- Fighter 3 / Wizard 2.
- Paladin 5 / Sorcerer 3.
- Warlock 2 / Bard 4.
- A non-spellcasting multiclass.
- A multiclass with two subclasses.
- A character that fails a multiclass prerequisite.

Verify creation, repeated level-ups, editing, export/import, rests, resources, spell preparation, and the final character sheet for each representative character.

Complete. A dedicated multiclass regression suite now covers Fighter 3 / Wizard 2, Paladin 5 / Sorcerer 3, Warlock 2 / Bard 4, a non-spellcasting multiclass, two independently resolved subclasses, and failed multiclass prerequisites. The suite exercises class-owned sheet features and resources, per-die hit-dice pools, shared and Pact Magic slots, repeated advancement of different classes, prepared-spell ownership, JSON export/import normalization, and rest recovery.

## 5e Full Support

### How to handle `WotC_5e_only.json`

`compendium/WotC_5e_only.json` is now the canonical source of truth for the 5e rules bundle and the file used for compendium import. It is intentionally gitignored because the data file does not need to be deployed with the application, but **gitignored does not mean generated, disposable, or replaceable from the XML**.

`compendium/WotC_5e_only.xml` was a one-time migration input. Its classes and subclasses have been converted, reconstructed, enriched, and validated into the JSON. Do not regenerate the canonical JSON from the XML: doing so would discard completed Grand Schema enrichment and restore known conversion defects. Once any remaining XML-only facts have been deliberately migrated and audited, the XML and its conversion-only tooling may be archived or removed.

From this point forward:

1. Start every 5e content change from the current canonical `compendium/WotC_5e_only.json`.
2. Make targeted Grand Schema changes directly or use a JSON-to-JSON migration that is safe against the current canonical file.
3. A migration must write to a temporary output first and must not assume the old XML shape.
4. Run the relevant dedicated validators, the independent subclass audit where applicable, strict Grand Schema validation, and the full test suite.
5. Only after validation passes, replace the canonical JSON with the temporary output.
6. Import the canonical JSON through the Compendium Import screen. The server does not read this file from disk at runtime.

The existing XML conversion and enrichment scripts document the migration that produced the canonical JSON. They are not a recurring rebuild pipeline unless they are first made idempotent and explicitly rewritten to accept the current canonical JSON without duplicating or erasing facts.

Never overwrite `WotC_5e_only.json` with raw XML conversion output, an intermediate migration stage, or a failed validation result. The current local JSON has completed the original migration pipeline and is ready to import. Remaining work below must advance this JSON rather than reconstruct it from the XML.

The original XML conversion exposed 1,794 authored rules: 1,776 were `manual`, 18 were `mixed`, and none were fully automatic. All 1,249 class features were initially manual and lacked structured effects or choices. These figures describe the original conversion only, not the current canonical JSON. Subclass features were flattened into their base classes, which would grant incompatible subclass features simultaneously. The completed stages below progressively repaired that converted data.

### Current canonical audit

Verified directly against `compendium/WotC_5e_only.json` on 2026-07-22. Refresh this section whenever a content pass changes these categories; do not carry historical counts into remaining-work claims.

- 13 classes and 1,269 class features: 480 base-class features and 789 subclass features.
- Base-class resolutions: 150 `automatic`, 29 `mixed`, and 301 `manual`.
- Subclass resolutions: 3 `automatic`, 3 `mixed`, and 783 `manual`; 8 subclass features currently contain supported structured mechanics.
- 18 species and 296 traits: 278 `manual` and 18 `mixed`. Those 18 traits contain 56 legacy `source_modifier` records.
- 106 backgrounds; none currently has structured starting equipment.
- 249 feats: 34 have no mechanics, and 53 have mechanics without grants.

### Completed enrichment stages

1. **Canonical base-class metadata and spellcasting.** The completed base-class enrichment supplies primary abilities, multiclass prerequisites and reduced proficiencies, full/half/Pact Magic contributions, canonical spell-list access, spell-slot tables, cantrip progression, known-spell progression, Expertise, Metamagic, Invocations, and Wizard spellbook acquisition for all 13 classes. It also removes accidental base Fighter and Rogue spellcasting.
2. **2014 prepared-spell formulas.** Grand Schema and the creator, level-up flow, and character sheet support ability modifier plus class level, or ability modifier plus half class level, rather than storing knowingly incorrect fixed preparation counts.
3. **Base cornerstone mechanics.** The completed cornerstone enrichment adds structured Rage defenses, Strength advantages, and Rage damage; full Sneak Attack scaling; full Second Wind scaling; and validates Wild Shape, Ki, Action Surge, Lay on Hands, Sorcery Points, and Pact Magic resource/progression data.
4. **Independent validation.** The base-class and cornerstone validators passed against temporary enriched outputs, followed by Grand Schema validation, during the one-time XML migration. Future work validates JSON-to-JSON changes against the canonical file.

5. **Subclass reconstruction.** The completed subclass reconstruction covers 115 subclasses across all 13 classes, scopes their features and resources, and gives Eldritch Knight and Arcane Trickster independent third-caster progression. The migration-time audit reported zero unknown subclass references and zero XML/JSON alignment mismatches. Current regression coverage verifies the reconstructed ownership. Every subclass feature now has an explicit resolution classification; mechanical automation remains largely outstanding as quantified in the current canonical audit above.
6. **Canonical class choices and 2014 Fighting Styles.** The creator and level-up flow now consume explicit Grand Schema class choice groups instead of guessing choice cardinality from the number of optional features. Fighter, Paladin, and Ranger receive exclusive Fighting Style groups with structured automatic effects, Blessed Warrior and Druidic Warrior cantrip choices, and Superior Technique maneuver selection.
7. **Shared Unarmored Defense and Extra Attack rules.** Barbarian and Monk now use the existing Grand `armor_class/base_formula` effect used by 5.5e. Multiclass derivation keeps only the first Unarmored Defense acquired and retains only the strongest Extra Attack progression instead of stacking duplicate class or subclass features.
8. **Shared Channel Divinity pool.** Cleric and Paladin retain all class- and subclass-owned Channel Divinity options, but multiclass sheet derivation coalesces their counters into one pool using the highest explicitly granted use count instead of adding or duplicating uses.
9. **Base-class exclusive choices.** The 5e base-class enrichment now represents Warlock Pact Boons as one four-option class choice. Ranger's Favored Enemy/Favored Foe, Natural Explorer/Deft Explorer, Primeval Awareness/Primal Awareness, and Hide in Plain Sight/Nature's Veil pairs are explicit mutually exclusive choices, preventing both the original and optional replacement features from being granted together.
10. **Additional base-class mechanics.** Both Primal Knowledge gains are typed Barbarian-skill proficiency choices. Ranger's Deft Explorer (Canny) now records one Expertise choice and two language choices; Favored Enemy and its improvements record their associated languages while leaving the creature choice explicitly table-entered. Primal Awareness grants its five spells at the correct Ranger levels and tracks one independent slot-free cast of each spell per Long Rest.
11. **Persisted table-facing selections.** Grand class features now have a compact reusable `selection` choice for finite, non-proficiency decisions. Creator and level-up store these selections in the existing `chosenFeatureChoices` character state. Ranger Favored Enemy and Natural Explorer choices, including their level 6/10/14 improvements, now expose and persist the authored creature-type and terrain options without treating them as proficiencies.
12. **Authentic 2014 maneuver catalog.** A dedicated enrichment pass adds the 16 Player's Handbook and 7 Tasha's Cauldron maneuvers as ruleset-scoped `classTalents`, without reusing their 5.5e counterparts. Battle Master receives cumulative 3/5/7/9 maneuver acquisition, replacement support, STR-or-DEX save ability, 4/5/6 short-rest superiority dice, and d8/d10/d12 scaling. Martial Adept selects two maneuvers from the same catalog and tracks its independent d6 superiority die.
13. **Structured base-feature classification.** Base Spellcasting/Pact Magic, Ability Score Improvement, Fighting Style selection, Expertise, Metamagic, and Eldritch Invocation acquisition now report `automatic` when their typed Grand Schema progression or choices fully drive character creation and level-up. This removes false manual-work counts without pretending that the selected talent's table effects are automated.
14. **ASI-level cantrip replacement.** Typed `replace: true` class cantrip choices now unlock one existing cantrip in the level-up picker while preserving the class's total cantrips known. Cleric and Druid Cantrip Versatility are automatic; the cantrip branches of Bardic, Sorcerous, and Eldritch Versatility are structured while their other replacement branches remain table-managed.
15. **Fighter maneuver replacement.** Fighter's seven Martial Versatility features now carry a typed one-maneuver replacement fact. At those ASI levels, a Battle Master can exchange one known maneuver without changing the total known or replacing more than the feature permits. The features remain `mixed` because Fighting Style replacement is not yet structured.
16. **First structured subclass features.** Barbarian's Mindless Rage (Path of the Berserker) and Bear (Path of the Totem Warrior) are automatic condition-immunity and damage-resistance-while-raging effects, matching the shape already used by base Rage. Eagle (Path of the Totem Warrior) and Druid's Nature's Ward (Circle of the Land) are mixed: their flying-speed grant, poison immunity, and elemental/fey-only charm and fright immunity are structured, while Eagle's fall-if-unsupported clause and Nature's Ward's disease immunity remain table-managed pending vocabulary this app doesn't have yet (no fall/hover simulation, no disease-immunity effect type).

## Compendium import performance

Bundle import remains the supported workflow; splitting the canonical bundle into manual per-category imports is not an acceptable requirement.

1. **Complete.** Compendium preview/import uploads now spool to temporary disk storage and are deleted after successful import, successful preview, invalid JSON, or schema/guardrail failure. Other small/image upload flows retain their existing memory-backed behavior. This removes the simultaneous in-memory upload-buffer copy while preserving atomic bundle validation and import.
2. Measure large responses with opt-in per-route egress logging and identify the source of post-import/export traffic before changing payload contracts.
3. Reuse a recently validated preview during import, or eliminate duplicate preview parsing when the exact same file is submitted.
4. Stream category export rows into the ZIP rather than materializing and stringifying a complete category document in memory.
5. Evaluate incremental/streaming JSON parsing only if disk-backed uploads and preview reuse do not reduce peak memory enough; cross-category reference validation and atomic transactions must remain intact.

### Remaining work

1. Finish remaining base-class choices and mechanics. Add typed replacement selectors for Expertise, Metamagic, Fighting Styles, Pact Boons, Mystic Arcanum, and dependent Invocations to complete Bardic, Martial, Sorcerous, and Eldritch Versatility. Fighter maneuver replacement is complete; Paladin and Ranger Martial Versatility only need their Fighting Style branch. Cantrip Formulas still needs an every-Long-Rest replacement action rather than a one-time level-up choice. Free-form details such as the two specific humanoid peoples selected by Favored Enemy remain player-entered notes.
2. Convert the 783 manual subclass features from reference prose into effects, choices, resources, rolls, and scaling rules. Only genuinely table-adjudicated behavior should remain `manual`; recalculate this count after each pass.
3. Review the 18 retained species and convert the 278 manual traits plus the 56 legacy `source_modifier` records contained by 18 mixed traits into supported structured effects and choices.
4. Review all 106 backgrounds and 249 feats. Backgrounds need starting equipment and remaining structured benefits; thirty-four feats currently have no mechanics, and another fifty-three have mechanics without grants. Prioritize common PHB and spell-granting feats.
5. Advance the canonical `WotC_5e_only.json` with targeted or idempotent JSON-to-JSON migrations. Run every applicable dedicated validator, the independent subclass audit, Grand Schema validation, and the full test suites before replacing or importing the canonical file. Never rebuild it from the XML.
6. Validate representative level 1–20 characters for every class before importing the 5e bundle into the live compendium.
