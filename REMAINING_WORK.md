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

The converted `WotC_5e_only.json` is structurally valid Grand Schema content, but the tracked generated file is not yet safe to import for character creation. The audit found 1,794 authored rules: 1,776 are `manual`, 18 are `mixed`, and none are fully automatic. All 1,249 class features were initially manual and lacked structured effects or choices. Subclass features were flattened into their base classes, which would grant incompatible subclass features simultaneously.

### Completed enrichment stages

1. **Canonical base-class metadata and spellcasting.** `enrich-wotc-5e-base-classes.mjs` supplies primary abilities, multiclass prerequisites and reduced proficiencies, full/half/Pact Magic contributions, canonical spell-list access, spell-slot tables, cantrip progression, known-spell progression, Expertise, Metamagic, Invocations, and Wizard spellbook acquisition for all 13 classes. It also removes accidental base Fighter and Rogue spellcasting.
2. **2014 prepared-spell formulas.** Grand Schema and the creator, level-up flow, and character sheet support ability modifier plus class level, or ability modifier plus half class level, rather than storing knowingly incorrect fixed preparation counts.
3. **Base cornerstone mechanics.** `enrich-wotc-5e-cornerstones.mjs` adds structured Rage defenses, Strength advantages, and Rage damage; full Sneak Attack scaling; full Second Wind scaling; and validates Wild Shape, Ki, Action Surge, Lay on Hands, Sorcery Points, and Pact Magic resource/progression data.
4. **Independent validation.** The base-class and cornerstone validators pass against a temporary enriched compendium, followed by Grand Schema validation. The tracked `WotC_5e_only.json` remains untouched until every enrichment stage is ready.

5. **Subclass reconstruction.** `enrich-wotc-5e-subclasses.ps1` reconstructs 115 subclasses across all 13 classes, scopes their features and resources, and gives Eldritch Knight and Arcane Trickster independent third-caster progression. Its independent audit reports zero unknown subclass references and zero XML/JSON alignment mismatches. Five integration regressions pass as part of the 302-test server suite. Eighty-six features remain explicitly unclassified for later mechanical review rather than being assigned by guesswork.
6. **Canonical class choices and 2014 Fighting Styles.** The creator and level-up flow now consume explicit Grand Schema class choice groups instead of guessing choice cardinality from the number of optional features. Fighter, Paladin, and Ranger receive exclusive Fighting Style groups with structured automatic effects, Blessed Warrior and Druidic Warrior cantrip choices, and Superior Technique maneuver selection.
7. **Shared Unarmored Defense and Extra Attack rules.** Barbarian and Monk now use the existing Grand `armor_class/base_formula` effect used by 5.5e. Multiclass derivation keeps only the first Unarmored Defense acquired and retains only the strongest Extra Attack progression instead of stacking duplicate class or subclass features.
8. **Shared Channel Divinity pool.** Cleric and Paladin retain all class- and subclass-owned Channel Divinity options, but multiclass sheet derivation coalesces their counters into one pool using the highest explicitly granted use count instead of adding or duplicating uses.
9. **Base-class exclusive choices.** The 5e base-class enrichment now represents Warlock Pact Boons as one four-option class choice. Ranger's Favored Enemy/Favored Foe, Natural Explorer/Deft Explorer, Primeval Awareness/Primal Awareness, and Hide in Plain Sight/Nature's Veil pairs are explicit mutually exclusive choices, preventing both the original and optional replacement features from being granted together.
10. **Additional base-class mechanics.** Both Primal Knowledge gains are typed Barbarian-skill proficiency choices. Ranger's Deft Explorer (Canny) now records one Expertise choice and two language choices; Favored Enemy and its improvements record their associated languages while leaving the creature choice explicitly table-entered. Primal Awareness grants its five spells at the correct Ranger levels and tracks one independent slot-free cast of each spell per Long Rest.

### Remaining work

1. Add an authentic 5e maneuver talent catalog, then structure Battle Master and Martial Adept acquisition with the existing `talent.kind: "maneuver"` contract. The source XML references a Maneuvers spell list but contains no maneuver definitions; do not substitute the existing 5.5e records because their rules text and mechanics differ.
2. Structure remaining base-class choices and mechanics, including spell and talent replacement, favored enemy and Natural Explorer terrain selections, and other progression choices not yet represented. These selections need persisted replacement/free-form choice support rather than misleading pseudo-proficiencies.
3. Convert subclass mechanics from reference prose into effects, choices, resources, rolls, and scaling rules. Only genuinely table-adjudicated behavior should remain `manual`; review the 86 deliberately unclassified features alongside this pass.
4. Review the 18 retained species and convert the 278 manual traits plus 18 legacy `source_modifier` traits into supported structured effects and choices.
5. Review all 106 backgrounds and 249 feats. Backgrounds need starting equipment and remaining structured benefits; thirty-four feats currently have no mechanics, and another fifty-three have mechanics without grants. Prioritize common PHB and spell-granting feats.
6. Run base-class, cornerstone, and subclass enrichment sequentially into a disposable output, followed by all dedicated validators, the independent subclass audit, Grand Schema validation, and the full test suites.
7. Validate representative level 1–20 characters for every class before importing the 5e bundle into the live compendium.
