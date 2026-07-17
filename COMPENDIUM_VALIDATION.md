# Grand Compendium Validation

This document proves whether every Grand Schema compendium satisfies the shared schema contract. It does not track or preserve a legacy conversion workflow. Catalogs remain separate importable files; "Grand" names the schema they share, not a merged artifact. Load the core WotC 2024 catalog before add-ons that reference its spell-list registry or equipment. Together, the supplied catalogs cover more than WotC 2024 content.

## North star

The deliverable is the durable canonical schema for exactly eight rule categories:

1. classes
2. species
3. feats
4. items
5. spells
6. class talents
7. monsters
8. backgrounds

The compendium JSON is authored source material and the sole rules source of truth. It is not an intermediate conversion artifact.

### Non-negotiable schema tenets

1. **Cold facts:** every mechanically relevant fact has a typed representation. Runtime code calculates from those facts; it never recovers rules from names or prose.
2. **Compactness:** the canonical representation is the shortest unambiguous typed form. Schema size is never treated as a measure of completeness.
3. **One fact, one home:** a rule is stored once and referenced by stable ID where reuse is intended. Derived values and copied records do not belong in canonical data.
4. **Sparse defaults:** omit values that equal a documented schema default, including false flags, `null`, and empty arrays or objects unless their presence carries meaning.
5. **Defaults are facts, not inference:** an omitted value may resolve only to a universal, documented default. It may not trigger name matching, prose parsing, category heuristics, or fallback rule tables.
6. **No opaque compression:** compactness must not hide independent mechanics in delimited strings, overloaded fields, magic names, or prose. Prefer a small typed object when facts can vary independently.
7. **Overrides only when different:** referenced entities supply their canonical behavior. A record stores an override only when it intentionally differs from that behavior.
8. **Honest manual behavior:** `manual` is reserved for genuine table adjudication, never missing schema coverage.

Category contracts must document their defaults beside their fields. For resources, the global recovery default is `long_rest`; a category should store another recovery timing only when it differs. No runtime consumer may invent an undocumented fallback.

Every schema proposal and completed migration must pass this compactness check:

- Can a field be removed because its value is already the documented default?
- Is the same fact represented anywhere else?
- Can an embedded record be replaced by a stable ID reference?
- Does every remaining wrapper distinguish real mechanical variants?
- Would omission remain deterministic without reading a display name or description?

## Cross-application cold-fact sweep (2026-07-16)

- Removed the retired XML conversion product and its parser/test architecture. Grand JSON is imported directly.
- Removed runtime class-feature prose parsing, legacy string effects, prepared-spell choice inference, background Feat-name inference, and class equipment prose fallbacks from the player.
- Removed server-side guesses for hit dice, species speed, class features, AC, and minimum HP. The server now preserves explicit character facts; canonical player derivation owns rules math.
- Canonical exports now reject non-Grand database blobs instead of rebuilding records from scalar columns or legacy source shapes.
- Removed dead class/species/background converters and the feat/class prose-parser family.
- Removed DM action-text mutation, spell-slot prose parsing, Legendary Resistance name parsing, and spell school/class label parsing.
- Repatriated the shared spell-detail contract and color-alpha utility to `shared` for both applications.
- Verified all ten separate Grand catalogs together: **8,579 records imported with strict schemas and guardrails**.
- Updated character fixture validation to treat the separate catalogs as one logical compendium. Alarion, Diego, Drokkan, Garric, and Torin now validate with **zero unresolved references**.
- Replaced the monster/item/spell editor mutation boundary with strict Grand records. Editors fetch the canonical entry, submit the complete edited fact set, and run the same category schemas and cross-reference guardrails as file imports.
- Deleted the partial-editor preservation merge, parallel display-body schemas/builders, and the unreferenced monster/item/spell `toV2` conversion paths (including action-prose attack recovery). Editing can no longer manufacture mechanics from prose or silently preserve fields that its payload omitted.
- Re-verified the ten independent catalogs after the editor cleanup: **8,579 Grand records imported**, all application typechecks pass, and **291 server + 136 player + 17 DM tests** pass.
- Retired the final Compendium-V2 identity: internal schema files and symbols now use Grand names, `/api/compendium/v2` is removed, and imports require `schema: "grand"` instead of accepting `version: 2`.
- Removed the obsolete `batches: [{ category, entries }]` bundle envelope. Grand files now use either one `category`/`entries` batch or flat top-level category arrays; catalogs remain separate files.
- Removed schema compatibility for prose Feat prerequisites, name-only Background equipment, and duplicate Species `vision`/`resistances` homes. The AI guide and regression fixtures now demonstrate only accepted Grand facts.
- Removed read-time re-normalization/re-compaction of already-validated Grand monster, item, and spell records. Presentation DTOs format stored typed facts only; monster movement, saves, and skill bonuses now retain and consume their typed structures rather than parsing display strings.
- Deleted unused conversion-era helpers (`contentResolution`, `spellNormalization`, trait projection, and blob-pruning modules) and centralized the shared item-detail contract used by DM and player.
- Re-verified all ten independent catalogs together: **8,579 Grand records imported**; Drokkan and Alarion fixtures have zero unresolved references; all 13 Classes/260 levels and 898 resolution-tagged rules validate; **289 server + 136 player + 17 DM tests** and all three application typechecks pass.

This sweep does not authorize compatibility inference to return. Any remaining editor boundary that accepts a display-oriented form must translate explicit fields only and must persist a schema-valid canonical record.

- Every mechanically relevant fact must have an explicit typed representation.
- Display names and prose never imply automatic behavior.
- Runtime code may calculate outcomes from structured facts, but may not recover rules by parsing names or prose.
- `automatic` means the structured record completely describes every automated benefit.
- `mixed` identifies both its structured behavior and the genuinely manual remainder.
- `manual` is reserved for table adjudication, never missing schema coverage.
- A new book is translated directly into this schema by a human or AI and validated against the same contract.
- XML and source-specific conversion behavior are outside the product architecture.

## Canonical schema completion gate

Existing entry validation is evidence, but it does not make a category complete. A category is complete only when its schema expresses its full mechanical vocabulary, its canonical records use that vocabulary, runtime consumers read only those fields, and adding another entry of the same kind requires data rather than category-specific code.

| Category | Mechanical vocabulary complete | Compact/default audit | Canonical data migrated | Runtime guessing removed | Edge cases validated | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Classes | Yes — progression, prepared counts, spell slots/lists, preparation recovery, proficiencies and conditional replacements, resources, scaling rolls, subclass ownership, class talents, Fighting Styles, Weapon Mastery, Expertise, fixed/filtered grants, passive defenses, atomic spell/resource features, stable spell choices, and subclass spellcasting are typed | Yes — overloaded optional records, duplicate/non-rule features, default long-rest declarations, duplicate resources, and non-caster spellcasting shells are gone | Yes — all 13 Classes and 260 levels contain 510 real features, 61 stable subclass options, four explicit branch groups, 34 features with choices, 95 with effects, and 180 explicit prepared-count rows | Yes — canonical class descriptions are display-only; creator, level-up, sheet, spell progression, primary ability, saves, and equipment paths no longer recover mechanics from prose | Yes — schema/corpus/database parity, conditional and filtered proficiencies, cold-effect execution, both typechecks, all server and player regressions pass | **Complete** |
| Species | Yes — the 111-trait inventory's five previously disclosed schema/UI gaps are closed using the shared structured-effect vocabulary; Frost's Chill's target-side rider remains honestly table-resolved under `mixed` | Yes — duplicate top-level `vision` and `resistances` facts were removed from all 16 Species, with guardrails preventing recurrence | Yes — all 111 traits across all 16 Species were re-audited; deterministic mechanics are structured and flavor-only traits remain sparse | Yes — canonical Species traits suppress prose parsing, and creator/character consumers read structured choices, grants, senses, defenses, resources, actions, and movement facts | Yes — schema, import, database parity, API, creator/save/reload, no-inference, and live Playwright checks pass across Wood Elf, Infernal Tiefling, Human, Dragonborn, and Aasimar cases | **Complete** |
| Feats | Yes — identity, prerequisites, choices, grants, uses, spell progressions, passive effects, and honest table-resolved behavior are bounded | Yes — General, ability minimum 13, ability maximum 20, and long-rest recovery are defaults; dead converter metadata and duplicated manual effects are forbidden | Yes — all 277 Feats use canonical categories, 156 choices, 216 typed prerequisites, 74 use pools, 24 spell progressions, and 34 real effects | Yes — creator, level-up, and character derivation consume Feat facts directly; descriptions are display-only | Yes — schema, compactness, references, corpus, Drokkan/Alarion fixtures, runtime no-inference, import, DB parity, and integrity checks pass | **Complete** |
| Items | Yes — every item behavior executed by the application has a typed representation; non-automated adjudication remains honest prose | Yes — sparse defaults, structural discriminators, canonical IDs, and shared effects audited across 1,729 Items | Yes — all deterministic runtime mechanics and 241 passive effects are canonical | Yes — runtime item mechanics never parse names or descriptions | Yes — schema, corpus, runtime, import, and no-inference regressions pass | **Complete** |
| Spells | Yes — access, damage/healing/temp-HP display rolls, attack/save checks, mixed damage types, and cantrip tiers are typed; table-side adjudication remains honest prose | Yes — scalar-or-exception-array `check`, sparse scalar-or-array `effect`, and authored tier rows avoid a spell engine | Yes — all 411 spells use access IDs; 666 rolls and 195 checks are typed | Yes — player-facing spell rows use facts only; no prose parser, hard-coded spell list, or Magic Missile exception remains | Yes — corpus, schema, guardrail, runtime-selection, cantrip-tier, mixed-icon, and database integrity regressions pass; visual browser smoke was unavailable in this session | **Complete** |
| ClassTalents | Yes — identity, kind, rolls, eligibility prerequisites, repeatability, deterministic passive effects, spell-target choices, and nested Origin-Feat choices are bounded; table-executed combat decisions remain honest prose | Yes — one compact discriminated record shape replaces fake spell metadata; repeated selections reuse duplicate stable IDs and one choice array instead of stored instance wrappers; absent defaults and manual-only mechanics are omitted | Yes — all 58 records use stable IDs; all 23 prerequisites, four repeatable Invocations, deterministic passive/grant Invocations, four spell-choice Invocations, and Lessons of the First Ones are typed | Yes — lookup, eligibility, grants, repeatable selection, spell choices, nested Origin-Feat configuration, edit replacement, senses, save modifiers, breathing, and speed read canonical facts without prose recovery | Yes — schema/reference guardrails, source/database exact parity, nested/repeatable persistence regressions, fixture validation, both typechecks, server/player suites, and rule-resolution validation pass | **Complete** |
| Monsters | Yes — displayed attacks, damage/type choices, Multiattack routines, target pressure, recharge/uses, legendary economy, and lair narrative have canonical homes; deliberately table-resolved variable routines remain prose | Yes — sparse scalar-or-array facts, derived averages omitted, no geometry engine, converter labels removed, and non-actions removed from action arrays | Yes — all 562 audited; 1,266 damage components, 330 Multiattacks, 152 areas, 2 target caps, 305 recharge facts, 44 legendary economies, 116 legendary options, and 36 lairs migrated | Yes — action editors, statblocks, spell displays, legendary economy, and encounter estimates consume typed facts only; missing typed damage produces no estimate rather than a prose/CR guess | Yes — strict schemas/references, canonical corpus, DB integrity, compatibility projection, typed DPR regressions, all application typechecks, and all server/player/DM suites pass | **Complete** |
| Backgrounds | Yes — skills, tools, languages, ability choices, fixed/constrained Feats, and equipment are explicit | Yes — fixed Feats are IDs, constrained choices are sparse, shared choices are reused, and default behavior is omitted | Yes — all 57 records migrated; 56 fixed grants reference canonical Feats and Custom Background retains an unrestricted choice | Yes — creator and character views consume typed Background facts and hydrate Feat mechanics from their canonical owner | Yes — schema, corpus, unresolved-reference, conversion, creator, import, and database integrity regressions pass | **Complete** |

No category is marked complete merely because its current records pass the Grand Schema parser. The parser proves shape validity; this gate proves that the shape is sufficient to be the rules authority. The compact/default audit also blocks completion when the schema stores documented defaults redundantly or uses verbosity in place of precise modeling.

### Classes: first audit

The canonical batch contains all 13 Classes and all 260 level rows, with 652 feature records and 211 resource rows. The existing progression work is sound, but it is not yet a cold-fact class model:

- Only 18 features carry any structured effects: 22 legacy `source_*` records in total. The remaining deterministic class behavior is still recovered from feature prose by creator, level-up, and character-sheet consumers.
- No feature uses the schema's `subclass` field. Instead, 472 features are marked `optional`, and subclass ownership is generally embedded in display names such as `Level 3: ... (Gloom Stalker)`. `optional` currently mixes subclass features, actual player choices, Ability Score Improvements, and non-rule onboarding text, so it is not a usable mechanical discriminator.
- Subclass resource ownership is only partly explicit: 84 of 211 resource rows declare `subclass`, while feature ownership declares none.
- Every Class has a `spellcasting` object, including Barbarian; Fighter, Monk, and Rogue receive subclass-derived spellcasting shells. This makes absence of `ability` carry undocumented meaning instead of expressing base-class and subclass spellcasting separately.
- Long-rest recovery is written on 177 resources even though it is the global documented default. Only the 34 short-rest exceptions need storage.
- Runtime code still infers saving-throw proficiency, languages, spell lists and progressions, class choices, Magic Item Plans, and feature effects from names or descriptions. Existing tests even preserve class-prose derivation as expected behavior.

The compact implementation order is therefore:

1. **1A — ownership and record roles:** give subclasses and real choices stable typed identities; remove onboarding prose and ASIs from the generic optional-feature mechanism.
2. **1B — class entry facts:** verify proficiencies, equipment, languages/tools, multiclass facts, spellcasting ownership, and stable ClassTalent references.
3. **2A — progression choices and resources:** type fighting styles, subclass selection, expertise/mastery/talent choices, and other level-up decisions; compact default recovery.
4. **2B — deterministic feature mechanics:** inventory and author the bounded effect vocabulary, leaving genuine table resolution as prose.
5. **2C — cold-data cutover:** remove all class name/prose inference, add no-inference regressions and fixtures, migrate the database, and complete the gate only after parity and runtime verification.

This audit changes no class schema or canonical records. Slice 1A is the first implementation boundary.

### Classes: slice 1A — ownership and record roles

- Added a compact subclass registry to each Class: one selection level plus stable `sc_` IDs mapped to display names. All 61 canonical subclass options now have stable identities.
- Replaced parenthetical-name ownership with explicit subclass IDs on every subclass feature and on all 84 subclass resource rows. Schema validation rejects unknown ownership IDs.
- Replaced the overloaded `optional` flag with four explicit choice groups: Cleric Divine Order and Blessed Strikes, plus Druid Primal Order and Elemental Fury. Each stable option owns its complete feature chain, including Cleric's level-14 Blessed Strikes improvement.
- Removed 26 “Becoming a …” onboarding records, 55 duplicate Ability Score Improvement feature records, and 61 redundant `Class Subclass: ...` declaration records. ASIs remain the existing level fact; subclass names live once in the subclass registry. The corpus now contains 510 real feature records and zero `optional` fields.
- The player compatibility boundary derives existing display names and optional-choice presentation from the canonical IDs, preserving existing character selections while later slices move saved choices to IDs.
- Canonical JSON and all 13 configured database Class rows were migrated together. Class progression and Drokkan/Alarion fixtures report zero issues; SQLite integrity is `ok`; 358 server tests, 150 player tests, and both typechecks pass.

Slice 1A deliberately does not claim a cold-data runtime. Class entry facts, resources, deterministic feature mechanics, and name/prose consumers remain assigned to slices 1B–2C.

### Classes: slice 1B — entry facts (in progress)

- Authored `primaryAbility` for all 13 Classes as a scalar, `any`, or `all` requirement. This is also the documented source for the universal multiclass minimum-13 rule rather than duplicating a threshold on every Class.
- Authored the actual multiclass proficiency grants for the ten Classes that grant any. Monk, Sorcerer, and Wizard correctly omit an empty multiclass object.
- Corrected spellcasting ownership: only the nine base spellcasting Classes retain top-level spellcasting. Fighter and Rogue now attach Intelligence/Wizard-list spellcasting specifically to Eldritch Knight and Arcane Trickster; Barbarian and Monk no longer carry meaningless spellcasting shells. Long-rest slot recovery is omitted as the default; only Warlock stores the short-rest exception.
- Linked the three real ClassTalent consumers explicitly: Warlock Invocations, Battle Master Maneuvers, and Sorcerer Metamagic. Counts/replacement progression belongs to slice 2A.
- Promoted the shared structured equipment contract for Class use and wired the player boundary to accept canonical Class equipment options and `class.tools` references.

Starting equipment data is not yet migrated. The source has 13 authored option sets, but the canonical Item catalog has no mundane Spellbook record even though Wizard starting equipment grants one. That must be resolved with the concurrent Item cleanup before all Class equipment can use honest Item IDs; substituting `Book` would violate cold facts. Slice 1B remains open until all 13 option sets resolve and the prose equipment parser is removed.

### Classes: slice 2A — progression choices and resources (in progress)

- Replaced the prose tables for Eldritch Invocations, Battle Master Maneuvers, and Metamagic with compact cumulative `known` progressions on their owning features. Replacement permission is a sparse flag; Battle Master also owns its explicit Strength-or-Dexterity save-ability choice.
- Creator and level-up invocation counts now read the structured progression. Battle Master maneuver totals, gains at the current level, replacement support, and save-ability choice prefer the structured facts rather than reconstructing them from sentences.
- Removed all 177 explicit `long_rest` values from canonical Class resources and the database. Long rest is the documented resource default; the 34 short-rest exceptions remain stored.
- The one-time migration script was removed after updating canonical JSON and all configured Class rows.

- Added one compact feature-choice union for Feats, Weapon Mastery, Expertise, and proficiency choices. Fighting Style is a category-`F` Feat choice rather than a class-specific special case.
- Migrated the real Weapon Mastery progressions for Barbarian, Fighter, Paladin, Ranger, and Rogue; Barbarian alone stores the meaningful melee restriction.
- Migrated Bard, Ranger, and Rogue Expertise grants, including their later-level additions, plus Ranger Deft Explorer languages.
- Migrated Fighting Style choices for Fighter, Champion, Paladin, and Ranger, and the ordinary skill/tool choices from Primal Knowledge, College of Lore, and Student of War.
- Creator Weapon Mastery and Expertise readers now prefer these structured facts and no longer parse prose for canonical records. Canonical JSON and the live database were updated together; the temporary migration was deleted.

The remaining 2A work is the full conditional/fallback proficiency-choice inventory and cutting Fighting Style/proficiency selection off their legacy feature-effect/prose paths. These remain explicit open work rather than being hidden behind a Complete claim.

### Classes: slice 2B — deterministic feature mechanics (in progress)

- Audited the current runtime parser across all canonical Class features. It produced 174 candidate records, including false positives where temporary effects on another creature were mistaken for passive character facts. Migration is therefore deliberately split by verified mechanic family rather than accepting parser output wholesale.
- Replaced every one of the 18 canonical `source_modifier`, `source_special`, and `source_proficiency` string records with real typed effects or removed it when the legacy value was false. Canonical Classes and the live database now contain zero `source_*` effects.
- Corrected Monk Unarmored Movement ownership: the +5 increases formerly attached to Empowered Strikes, Heightened Focus, Disciplined Survivor, and Superior Defense now live on Unarmored Movement with explicit level gates.
- Authored typed AC formulas, speed changes and movement modes, ability-score increases and caps, hit-point scaling, saving-throw/skill/tool proficiencies, and Jack of All Trades' half-proficiency rule for the verified records in this pass.
- Any Class feature carrying typed effects now bypasses prose parsing in creator, level-up, and character-sheet paths. Untyped features retain the legacy fallback until later 2B passes complete their verified migration.
- The one-time migration updated canonical JSON and the configured live database together, then was deleted. All 13 Classes validate; both typechecks, all 361 server tests, and all 151 player tests pass.

2B remains open. The next pass is fixed grants and passive defenses, followed by resources/spell grants and then combat-only/manual classification. The 174 parser candidates are an audit queue, not presumed truth.

#### Class slice 2B-B: fixed grants and passive defenses — complete

- Reviewed all 70 untyped passive-looking parser candidates against their authored feature text. Only 23 features contained fixed character-owned facts safe to migrate in this slice; parser guesses for temporary elixirs, transformations, selected forms, target-only effects, and attack riders were rejected.
- Added fixed Artificer subclass tool/armor/weapon grants, Valor Bard training, Cleric Protector training, and Druid Warden training as typed proficiency facts.
- Added verified passive resistances and condition immunities for Barbarian, Cleric, Fighter, Paladin, Sorcerer, and Warlock features, preserving Rage and aura gates where the rule requires them.
- Added permanent swim/climb movement, Darkvision/Blindsight handling, and Danger Sense's conditional saving-throw advantage where those facts genuinely belong to the character.
- Compound features were not partially typed when doing so would suppress a still-needed spell/resource mechanic. Shadow Arts, Chemical Mastery, Radiant Soul, transformations, and similar records remain assigned to later complete-feature passes.
- Canonical JSON and all 13 live database Class rows were migrated together; the one-time migration and audit artifacts were removed. The corpus now has 38 typed Class features and zero legacy `source_*` effects. Both typechecks, 361 server tests, and 151 player tests pass.

The next 2B pass is resource and spell grants. It must migrate compound features atomically so enabling cold-data consumption never hides a second mechanic from the same feature.

#### Class slice 2B-C: spell and resource grants (in progress)

- Audited spell/resource parser output against the authored Class resource rows and existing `preparedSpellProgression`. Subclass spell tables already have a structured canonical home and were not duplicated into feature effects.
- Migrated 13 complete individual-grant features: Tinker's Magic, Animal Speaker, Beguiling Magic, Blessing of Moonlight, Words of Creation, Druidic, Telekinetic Master, Manipulate Elements, Paladin's Smite, Faithful Steed, Contact Patron, Eldritch Hex, and Spell Breaker.
- Free-cast features now carry their spell grant, exact use formula, recovery link, and resource identity together. Seven redundant fixed resource rows were removed. Long-rest recovery remains the omitted default in effect data as well as level resources.
- Added the missing non-spell half of Druidic as a fixed language grant. Ritual-only casting and fixed spellcasting abilities remain explicit rider facts rather than being inferred from prose.
- Rejected known parser corruption including `Druidic and one`, `Your Arcanum Spell Once`, Fey Wanderer/Clockwork flavor-table rows treated as spells, Telekinetic Adept inventing Mage Hand, and generic phrases treated as spell names.
- Canonical JSON and the live database were migrated together, then the audit and migration artifacts were deleted. The corpus now has 51 typed Class features and 204 remaining level-resource rows. Both typechecks, 361 server tests, and 151 player tests pass.

2B-C remains open for compound spell/resource features such as Shadow Arts, Chemical Mastery, and subclass features whose activated rider must be represented alongside the grant. Mystic Arcanum and spell-choice features also require real choice identities rather than fake spell names.

##### Class slice 2B-C compound pass

- Migrated 11 compound features atomically: Mapping Magic, Restorative Reagents, Chemical Mastery, Superior Atlas, Mantle of Majesty, Star Map, Shadow Arts, Misty Wanderer, Steps of the Fey, Radiant Soul, and Phantasmal Creatures.
- Chemical Mastery now declares its Force-damage rider, Acid/Poison resistances, Poisoned immunity, component-free Cauldron cast, and shared use pool together. The parser's former omission of Poison resistance is fixed.
- Shadow Arts now declares the Darkness cast against the existing Focus pool, both new/existing-Darkvision outcomes, and Minor Illusion with Wisdom spellcasting together.
- Shared and ability-modifier cast pools now live once with their owning feature. Five more duplicate level-resource rows were removed; long rest remains omitted as the recovery default.
- Activated or table-facing riders remain explicit gate/rider facts even when the application does not automate their resolution. This preserves cold facts without pretending the app executes spells or table adjudication.
- The canonical corpus and live database now agree on 62 typed features and 199 level-resource rows. Both typechecks, 361 server tests, and 151 player tests pass.

##### Class slice 2B-C spell-choice pass

- Added a compact stable spell-choice contract: `fc_` identity, one or more stable `sl_` list IDs, acquisition mode, exact or maximum spell level, optional school, replacement permission, new-slot-level growth, and free-cast permission. Omitted count means one.
- Migrated 12 real choices: Primal Lore, Magical Discoveries, Thaumaturge and Magician cantrips, four independent Mystic Arcanum levels, and all four Wizard Savant schools.
- Mystic Arcanum no longer produces the fake spell `Your Arcanum Spell Once`. Its level 6, 7, 8, and 9 choices each own a stable identity and independent once-per-long-rest resource. The single incorrect generic resource row was removed.
- Primal Lore now owns Druidic, its constrained skill choice, and its replaceable Druid cantrip together. Thaumaturge and Magician likewise pair their cantrip choice with the correct Wisdom-based skill bonuses.
- Structured choices feed the existing spell-choice consumer directly and suppress prose parsing even when a feature has no ordinary effects. A regression proves Mystic Arcanum creates both the typed choice and its resource without a parseable sentence.
- Canonical JSON and the live database were migrated together and the one-time script was removed. Both typechecks, 361 server tests, and 152 player tests pass.

##### Class slice 2B-C subclass spellcasting pass

- Added a compact explicit subclass spellcasting progression: sparse rows store only the level where cantrip or prepared counts change plus the actual slot-count array at each level. Ability and stable spell-list ownership remain on the subclass rather than being repeated on every row.
- Migrated all levels 3-20 for Eldritch Knight and Arcane Trickster. Creator and level-up consumers now read their list, cantrip count, prepared count, maximum spell level, and displayed slot array from canonical facts.
- Removed the hard-coded third-caster level thresholds and the feature-prose table parser from the canonical path. Legacy/homebrew records retain their compatibility fallback.
- Arcane Trickster now receives Mage Hand as a fixed typed grant and chooses two other Wizard cantrips at level 3, increasing to three chosen cantrips at level 10. This prevents the required spell from being lost or counted as an extra choice.
- Canonical JSON and the live database were migrated together; the one-time migration script was removed. Both typechecks, all 363 server tests, and all 153 player tests pass.

##### Class slice 2B-C conditional replacement and resource closeout

- Improved Illusions now stores Minor Illusion as a fixed known spell and one stable Wizard-cantrip fallback choice guarded by `ifKnown: "Minor Illusion"`. Creator and level-up show the fallback only when the character already knows the fixed grant; its sound-and-image and Bonus Action rider remains explicit on the grant.
- Audited all 355 otherwise-untyped features through the current runtime parser. Only 57 produced non-narrative candidate mechanics; the other 298 are already honest table-resolved prose and require no invented structure.
- Closed the remaining resource family: sixteen real resource features now carry fixed or ability-modifier maxima, sparse recovery exceptions, restore behavior, and stable keys. Second Wind deliberately remains in its existing level progression rather than being duplicated as an incomplete fixed grant.
- Removed the stale fixed Bloodthirst and Chilling Retribution counters; both rules actually use an ability modifier. Canonical resource effects now express that fact directly.
- The post-migration candidate queue is 41 features. These are now a finite verification list covering proficiencies, passive/combat effects, and several known parser false positives—not an open-ended class corpus.
- Canonical JSON and all configured Class rows match exactly: 83 typed features, 13 spell choices, and 196 level-resource rows. SQLite integrity is `ok`; both typechecks, all 364 server tests, and all 154 player tests pass.

The next pass verifies the 41 remaining candidates family by family. Once each is either typed or explicitly retained as manual prose, canonical Class records can disable prose parsing entirely.

##### Class slice 2B-D proficiency and passive verification

- Structured class proficiency choices now enter the same effect pipeline as other canonical choices. Their authored option arrays survive into creator and level-up UI instead of expanding silently to every option in the category.
- Migrated Battle Ready atomically: Martial-weapon proficiency, Intelligence attacks with magic weapons, and its Spellcasting Focus rider now live together. Added the missing `magic_weapon` filter to the bounded weapon vocabulary and verified it against the item's typed magic flag.
- Migrated Blessings of Knowledge's Artisan's Tools choice and constrained two-skill Expertise choice. Migrated Thieves' Cant as one fixed language plus one unrestricted language choice.
- Kept Unfettered Mind and Training in War and Song open. The former needs a saving-throw choice only when Intelligence proficiency is already owned; the latter needs a compound property filter for its exact weapon set. Flattening either into an unconditional choice or display string would violate cold facts.
- Reviewed 24 remaining passive parser candidates against their complete feature text. Seven genuine owner-side features were migrated atomically: Rage, Rage of the Gods, Circle Forms, Improved Circle Forms, Nature's Ward, Stormborn, and Aura of Protection.
- Rage now includes its gated resistances, scaling Strength damage, Strength check/save Advantage, and spell/Concentration restriction. Nature's Ward preserves its land-dependent resistance as a real choice bundle rather than granting every listed resistance.
- Rejected target-only and temporary-state parser mistakes, including Blessing of the Trickster, Envenom Weapons, Twinkling Constellations, Revelation in Flesh, Bladesong, and other transformation benefits that the parser had treated as permanent.
- Canonical JSON and the database agree on 92 typed features, 13 spell choices, 196 level-resource rows, and 329 genuinely untyped/manual features. The runtime candidate queue is now 31. SQLite integrity, both typechecks, all 364 server tests, and all 156 player tests pass.

Next is the remaining spell/combat candidate audit, followed by the two disclosed proficiency edge cases and the final no-prose cutover.

### Class slice 2E — cold-data cutover and spell progression

- Every canonical Class feature now suppresses prose parsing, including intentionally manual features. Descriptions remain complete player-facing rules text but can no longer manufacture effects.
- Added compact level facts for prepared-spell counts (180 populated rows), base spell-list ownership, and prepared-spell change recovery. Removed the prepared-count table parser, cantrip sentence parser, spell-list sentence parser, hard-coded third-caster thresholds, and rest-change sentence parser.
- Slot-growth spellbook choices now read the existing typed `perNewSlotLevel` choice rather than parsing Savant descriptions. Primary ability and saving-throw proficiencies read their canonical fields; starting equipment has no feature-prose fallback.
- Migrated Favored Enemy's always-prepared/free-cast link, Unfettered Mind's fixed Intelligence-save proficiency, and Training in War and Song's skill choice plus a typed melee/martial/property filter. The latter is saved with the character and evaluated against Item facts, not its display label.
- The audit exposed and fixed a critical plumbing bug: arbitrary typed Class effects were previously converted to narrative entries instead of being executed. Class effects now use the same verbatim typed-effect path as Species/Feat effects. The Unarmored Defense regression deliberately uses non-mechanical prose and proves the canonical effect alone drives AC.
- Unfettered Mind's exceptional replacement is fully typed: Intelligence is granted automatically; when it was already proficient, creator/level-up shows the five eligible replacement saves and persists the selected proficiency. No generic manual-proficiency editor is needed for this rule.

Canonical JSON and the configured live database were migrated together. Server typecheck and 364 tests pass; player typecheck and 157 tests pass. The temporary migration and audit files were deleted.

#### Class post-cutover resolution audit

- Re-ran the canonical resolution validator after the cross-category prose-removal pass. It found three Monk features still labeled `mixed` without structured mechanics: Empowered Strikes, Heightened Focus, and Superior Defense.
- All three are activated or table-selected combat behavior that Beholden displays but does not execute. They are now honestly `manual`; no incomplete pseudo-effect was invented merely to satisfy validation.
- Canonical JSON and the configured database remain byte-equivalent for all 13 Classes. `validateRuleResolution.ts` reports 898 rules and zero issues; SQLite integrity is `ok`; the server suite passes 337 active tests with 21 retired-XML conservation tests skipped.
- A follow-up audit still owns any surviving Class UI compatibility readers for Magic Item Plans, languages, hit dice, and starting equipment. A compatibility fallback may not read canonical Class prose; each path must consume typed Class facts or be proven unreachable for canonical records before the gate is considered final.

#### Class table-side note templates

- Magic Item Plans deliberately remain table-resolved. Modeling every eligible item and open-ended rarity/category rule would add a large cross-category contract for one feature without improving Beholden's actual table workflow.
- Added one compact generic `noteTemplate` fact to Class features. Replicate Magic Item creates a `Plans Known` player note containing four editable plan lines and the later Artificer plan-growth reminder.
- Note templates use stable `nt_` IDs. Character creation adds a missing template once; level-up merges missing templates into the current note list; neither path overwrites player-edited text.
- This is generic note plumbing rather than an Artificer-name exception. Duplicate template IDs within a Class are rejected by the schema.
- Canonical JSON and the configured database agree exactly for all 13 Classes; SQLite integrity is `ok`; rule-resolution validation reports 898 rules and zero issues. The server suite passes 339 active tests with 21 retired-XML tests skipped, and the player suite passes all 164 tests.

### Feats: slice 1A â€” identity and choices

- Classified all 277 Feats explicitly: 173 General, 61 Origin, 32 Epic Boon, and 11 Fighting Style.
- General is the documented default and is omitted. Exceptional categories use compact canonical codes: `O`, `E`, and `F`. API consumers receive expanded labels without inspecting names or prerequisite prose.
- Audited all 156 choice records across seven choice kinds. Choice IDs are unique within their Feat, every internal choice and spellcasting-ability reference resolves, and `known_cantrip` is validated as an explicit replacement target.
- Added strict schema and import guardrails for category vocabulary, duplicate choice identities, and unresolved internal references.
- Applied the category migration to the canonical JSON and all 277 configured development-database Feats. SQLite integrity remains `ok`.
- Prerequisite strings remain unchanged. Their typed vocabulary and removal of the player-side prerequisite parser are the next Feat slice; this slice does not pretend that work is complete.

### Feats: slice 1B â€” prerequisites

- Replaced all 216 canonical prerequisite strings with typed facts. Zero prerequisite strings remain in canonical JSON or the configured database.
- The bounded vocabulary covers minimum level, one-of and all-of ability thresholds, class, spellcasting/Fighting Style features, armor/weapon training, specific Feat ownership, any/none-of Feat sets, Eberron approval, and the corpus's two cross-kind OR requirements.
- A bare number is the compact level-only form. Ability minimum 13 is the documented default and is omitted.
- Level-up now evaluates and displays canonical prerequisite facts. The former Feat prerequisite text parser was removed; owned Background, Species, class-choice, and level-up Feat IDs participate in eligibility.
- Native import rejects prerequisite prose and unresolved Feat references. Translation compatibility may still parse a legacy string shape before canonical import, but it cannot enter canonical storage through the guarded native path.
- Migrated all 216 configured database records transactionally. Full canonical preview recognizes 3,123 replacements with zero additions or reference failures; SQLite integrity remains `ok`.

### Feats: slice 2A — passive character facts

- Audited the 88 stat-facing effects that the player could recover from Feat prose. The audit exposed unsafe guesses (including Poisoner being treated as poison resistance and Soul Drinker losing its Necrotic resistance), so parser output was not accepted as migration data.
- Authored compact cold facts for the bounded, unambiguous passive group: movement modes and bonuses, maximum Hit Points, senses, and armor training.
- Migrated 19 Feat records in the canonical JSON and configured development database: 13 typed effects and 6 armor-training grants. Replaced legacy `bonuses` wherever its fact moved to `effects`.
- `Tough` is now honestly `automatic`; mixed Feats remain mixed because their other table-resolved benefits are still described in prose.
- Conditional defenses, roll modifiers, and attack behavior are deliberately reserved for the next reviewed slice. Feat prose parsing therefore remains enabled until those remaining facts are migrated and validated.

### Feats: slice 2B — reviewed combat facts

- Reviewed every defense, modifier, attack, and Armor Class candidate produced by the old Feat prose parser against the authored description. Parser output was rejected where it changed the rule: Poisoner and Spellfire Adept ignore a target's resistance rather than granting resistance to the character; Soul Drinker grants both Cold and Necrotic resistance; Mythal Touched's AC is a temporary random reaction outcome rather than a passive bonus.
- Authored twelve compact combat-fact records covering unconditional damage/condition defenses, Initiative bonuses, and weapon-gated attack behavior. Existing Fighting Style facts were retained and stripped of redundant summaries and per-effect resolution flags.
- Conditional rules that the current effect gate cannot apply honestly remain table-resolved prose: Bloodied defenses, reaction-activated resistance, Concentration-only saves, ally-proximity saves, and random temporary AC. They were not weakened into unconditional effects.
- Removed all narrative and manually resolved pseudo-effects from all 277 Feats. Canonical Feat mechanics now contain 34 real effects and zero copied descriptions, effect summaries, or per-effect resolution boilerplate.
- Migrated canonical JSON and all 277 configured database records. SQLite integrity is `ok`; the complete 355-test server suite and server typecheck pass.

### Feats: slice 2C — cold-data cutover and compactness completion

- Feat ability increases now read `grants.abilityIncreases` and `choices` directly. Added only the two missing choice facts: `maximum: 30` on Epic Boon ability choices and `split: true` for Ability Score Improvement's alternative two +1 selections; maximum 20 remains the omitted default.
- Long-rest recovery is now the documented Feat-use default and is omitted. The canonical catalog has 74 use pools with zero explicit `long_rest` values; only five exceptional recovery timings are stored.
- Authored fixed-spell counters for all nine Fey-Touched, Shadow-Touched, and Vampire Touched variants. Existing spell choices and the 24 prepared-spell progressions remain in their own canonical fields rather than being duplicated as effects.
- Every applied Feat now suppresses prose parsing. HP, ability scores, resources, spells, proficiencies, defenses, movement, senses, AC, and attacks derive only from canonical mechanics; descriptions remain complete display/table text.
- Removed the converter-only `baseName`, `variant`, `modifierDetails`, and `notes` fields from the schema and all 277 records. These fields had no runtime readers and duplicated names, descriptions, grants, uses, or effects.
- Canonical JSON and database Feat rows match exactly; SQLite integrity is `ok`. Drokkan and Alarion fixtures report no issues. All 355 server tests, 150 player tests, and both typechecks pass.

### Monsters: first schema gap

The current monster schema stores basic attack facts (`toHit`, range/reach, damage formula, and damage type), but the DM difficulty calculation still parses action prose and guesses from Challenge Rating when those calculations fail. It currently infers:

- average damage from `Hit:` sentences;
- Multiattack counts and referenced attack names from prose;
- area/burst behavior from words such as `cone`, `line`, `radius`, and `sphere`;
- recharge/burst weighting from description text;
- a complete fallback DPR from a hard-coded Challenge Rating table;
- a flat legendary-action damage multiplier.

Those are rules and encounter-model inputs, not presentation concerns. The canonical monster action vocabulary therefore still needs explicit typed representations for damage components and averages, action sequencing/Multiattack composition, target shape/count, usage/recharge, and legendary action cost/economy. The difficulty consumer must then use those facts exclusively. Until that migration and consumer replacement are complete, Monsters remains **Not started** in the completion gate despite passing the existing Grand Schema validator.

#### 2026-07-14 corpus audit

The 562-monster canonical corpus contains 1,634 ordinary actions, including 348 Multiattacks and 194 actions with structured recharge data, plus 196 legendary-action entries. The apparent damage gap is smaller than the action prose suggests: 989 of 1,830 ordinary-plus-legendary entries already carry converter-produced `attacks` rows, and those rows contain 1,213 usable damage components. However, they encode facts as pipe-delimited strings such as `Cold Damage||10d8`, mix real components with redundant aggregate rows, omit explicit averages, and are typed by the schema as arbitrary strings. They are therefore an intermediate conversion artifact, not a canonical mechanical vocabulary.

The first Monster slice replaced that string protocol with compact typed damage components owned by the action: `{ roll, type }` for one component and an array only for multiple components. Averages are deliberately not stored because they are deterministic arithmetic from `roll`. The migration produced 1,259 typed components across 977 action/trait entries in all 562 canonical monsters and the development database. Legacy `attacks` strings and the duplicate `attack.damage`/`attack.damageType` fields are gone from canonical data; the screen boundary reconstructs its older display shape temporarily. Multiattack composition, target shape/count, and legendary economy remain separate slices so damage normalization does not grow into an encounter engine.

The Multiattack slice added compact same-monster action references: `routine` steps use either `use` or `choose`, omit a count of one, and may declare an optional use; `replace` records explicitly permitted substitutions. The schema rejects broken and recursive references. Canonical JSON and the development database now contain 330 structured routines: 87 include action choices, 10 include an optional action, and 60 include replacement rules. Eighteen routines deliberately remain prose-only rather than expanding the vocabulary: 11 summon-style variable counts and 7 uncommon whole-routine alternatives or conditional count changes. These are table-resolved by design, not missing automatic data.

The target-pressure slice added only `area: "cone" | "line" | "sphere" | "cube" | "emanation"` and a sparse numeric `targets` cap. One-target actions omit both; exact dimensions, creature filters, and swallowed capacity stay table-facing prose. The migration found 151 direct area actions and exactly two real selected-target caps (both three targets), while excluding nested spell/ray descriptions and swallow capacity. Encounter difficulty now reads these canonical fields and no longer searches action prose for geometry words; focused DM regressions prove that prose alone cannot trigger target pressure.

The recharge slice compacted the previous converter-shaped `{ kind, source, minimumRoll, uses, period }` object into three factual forms: `{ roll: 5 }`, `{ uses: 3, period: "day" }`, or `{ period: "long_rest" }`. All 305 corpus facts migrated (137 roll recharge, 165 limited-use entries, 3 rest recoveries), with zero legacy `kind`/`source`/`minimumRoll` fields remaining. Encounter difficulty now weights burst availability only from the structured object; words such as “Recharge” and “Breath Weapon” in prose no longer alter the result.

The final outgoing-damage review separated actual missing rolls from 104 entries that merely mention incoming damage, resistance, Evasion, triggers, or table adjudication. Eight reviewed gaps were authored, including fixed rolls missed by the old converter and compact damage-type choices such as `type: ["acid", "cold", "fire", "lightning", "thunder"]`. Animated Object's size- and summoner-dependent formula remains deliberately table-resolved rather than adding a variable-expression language.

Legendary audit found zero costed options in this 2024 corpus. Forty-four repeated “Legendary Actions (3/Turn)” headers and 36 lair essays were incorrectly stored inside the action array. Canonical monsters now store `legendaryUses`, 116 actual `legendaryActions`, and a separate sparse `lair` narrative collection. There are no header pseudo-actions or `category: "lair"` escape hatches left. This completes the Monster schema/data contract; encounter-difficulty's remaining prose/CR estimator is explicitly deferred by user decision and therefore keeps the overall runtime-guessing cell partial.

### Spells: first schema audit

The canonical spell batch contains 469 records, but only 411 are spells with a school and casting data. The remaining 58 records belong to the separate canonical `ClassTalents` category, referenced by Classes or Feats as appropriate:

- 28 Eldritch Invocations;
- 20 Battle Master maneuver options;
- 10 Metamagic options.

`ClassTalents` is their catalog and identity boundary; Classes and Feats consume those records by stable ID. They cannot remain fake level-0 spells, and they must not be deleted before their consumers use the new category.

The 411 real spells have strong presentation metadata: every record has level, school, casting time, range, components, and class labels. Of those, 396 have a duration, 171 have structured rolls, 171 are marked Concentration, and 32 are Rituals. The current shape is nevertheless insufficient as a rules authority:

- `rolls.description` is an untyped display label such as `Fire Damage`, `Heal`, or `Add to Roll`; the player must parse that label to choose an icon/color and identify damage type;
- attack-roll versus saving-throw resolution is absent, as are save ability and what happens on a successful save;
- the current UI inconsistently automates variation: character-level cantrip progression is legitimate derived behavior but is currently parsed from prose; spell-slot upcasting and extra projectiles are player choices, while Magic Missile alone receives name-specific aggregation;
- 15 persistent or special-duration spells omit `duration` because the schema has no honest value for their duration;
- the former `classes` strings mixed base spell-list eligibility with qualified subclass/domain eligibility and had no stable identity. Across the real spells, 298 of 1,412 relationships are qualified lists on 164 spells;

Eligibility remains Spell-owned so new spells can join a base or subclass list in the spell record and filtering remains a Spell-table query. Automatic level grants remain Class-owned because level, preparation, and limit behavior are progression facts. The two relationships are intentionally distinct rather than duplicated.

Runtime inspection confirms the schema gaps are active bugs, not theoretical completeness concerns. `CharacterSpellShared.ts` parses damage dice, damage type, saving throws, cantrip scaling, and slot scaling from descriptions and hard-codes Magic Missile by name. Spell-selection utilities also infer damage and attack-roll eligibility from prose or hard-coded spell-name lists.

The existing roll tables are useful canonical material and should be normalized rather than discarded. Examples already encode Fire Bolt's character-level rows and Fireball's slot-level rows. They do not, however, express kind/type independently, and repeated-projectile spells store only one projectile's roll. Twenty-four special-purpose rolls also prove that `rolls` cannot be globally redefined as damage: Bless/Bane/Guidance modifiers, Confusion behavior, Teleport outcomes, Time Stop turns, and similar player-facing dice remain legitimate generic rolls.

#### Proposed compact Spell slices

1. **Boundary and ownership — complete:** `ClassTalents` owns all 58 class-option records. Spell-list eligibility uses Spell-owned stable access IDs, while automatic level grants remain Class-owned progression facts.
2. **Typed player display:** preserve generic `rolls` and add only enough structure to render damage and healing without parsing labels—for example a damage type/icon or a healing marker. Temporary HP remains manual unless the player table begins applying it automatically. Add attack/save method and save ability because the player already displays those columns.
3. **Cantrip progression and manual variation boundary:** character-level cantrip progression remains automatic because character level is known and requires no player choice. Store its level rows as cold facts and select the highest applicable row: Fire Bolt becomes `2d10` at level 5, and Toll the Dead's normal roll becomes `2d8`. Conditional alternatives remain player-resolved from text, so an injured target changes Toll the Dead to `2d12` without requiring the app to model target HP. Spell-slot upcasting and additional projectiles also remain in text for player resolution. Magic Missile displays one dart's `1d4+1`; remove its name exception and all prose-based scaling parsers.
4. **Runtime cutover:** make combat/display consumers read only those facts, delete spell-description parsers and damage-spell name lists, then add no-inference regressions.
5. **Exceptional mechanics:** audit conditions, areas, movement, special durations, upcasting, and conditional rolls only against behavior the application actually executes. Preserve their complete rules text, but do not build a universal spell simulator or encode facts solely to automate decisions intentionally left to players.

The first audit established the migration boundary before implementation. Slice 1A applies that boundary without yet changing the Spell mechanics schema.

#### Spell slice 1A: ClassTalents boundary — complete

- Added the strict `ClassTalentSchema`, discriminated by `invocation`, `maneuver`, or `metamagic`; fake spell level, school, casting, class-list, and tag fields do not exist in this category.
- Moved 28 Eldritch Invocations, 20 Battle Master Maneuvers, and 10 Metamagic options from Spells into a dedicated `classTalents` batch. A one-time migration replaced the legacy punctuated spell IDs with canonical `ct_` IDs (for example, `ct_invocation_agonizing_blast`) across the source, catalog rows, and stored character JSON.
- Added dedicated persistence, native import/export/preview support, admin category support, and `/api/class-talents/search`.
- Character creation and level-up now load Invocations from ClassTalents. Generic Maneuver and Metamagic choice consumers route their list requests to the same catalog by kind.
- Removed the spell-search exclusion code that hid class options with `classes LIKE` checks. Spell search now contains only spells.
- Importing ClassTalents deletes legacy spell-table rows with the same IDs, making the category move a one-time database migration rather than a permanent alias map. Import guardrails reject future class-talent tags in a Spell batch.
- Migrated the configured development database to 411 spells and 58 class talents. The canonical document validates as eight rule batches with 3,123 total records.

#### ClassTalent slice 1A: prerequisites and repeatability

- Audited all 58 records: 23 Invocations have authored prerequisites and four are explicitly repeatable. Maneuvers and Metamagic options have no eligibility prerequisites in this corpus.
- Added sparse typed facts for minimum level, prerequisite ClassTalent ID, and damaging-cantrip capability. `attack_damage` is distinct from generic `damage`, fixing Repelling Blast eligibility without a name exception.
- Creator and level-up now consume these facts from the ClassTalent API. Removed the Invocation prerequisite prose parser and all Pact/name matching from eligibility.
- Import guardrails reject unresolved ClassTalent prerequisite IDs. Canonical JSON and the configured database were migrated together; the temporary migration was deleted.

#### ClassTalent slice 1B: direct Invocation effects

- Added the shared structured-effect vocabulary to ClassTalents without adding spell-shaped duplicate fields.
- Migrated 13 Invocations whose deterministic behavior fits existing runtime facts: 12 at-will/free spell grants and Witch Sight's Truesight.
- Creator, level-up, and character-sheet paths now consume `effects` directly and suppress Invocation prose parsing. Descriptions remain display/table-reference text.
- Corrected the character sheet's Invocation lookup: stable `ct_` IDs now resolve through the ClassTalent catalog rather than the Spell endpoint.
- Deliberately left choice-bearing, conditional-combat, familiar, Pact Weapon, and other table-resolved riders out of this slice; no misleading partial automation was authored.

#### ClassTalent slice 1C: persistent Invocation spell choices

- Migrated Agonizing Blast, Eldritch Spear, Repelling Blast, and Pact of the Tome to stable, typed `spell_choice` effects.
- Added compact spell-choice filters for damage, attack roll, ritual, and already-known spells. Option loading reads spell rolls/checks and stable IDs; it no longer infers these requirements from labels, notes, or spell prose.
- Invocation subchoices reuse the existing persisted `chosenFeatOptions` map under stable `invocation:<choiceId>` keys. Pact of the Tome records its three cantrips and two level-1 rituals as separate choices.
- `select` distinguishes choosing an existing spell as an Invocation target from learning/preparing a new spell, so Agonizing Blast-style choices do not create duplicate spell grants.
- Repeatable copies persist as duplicate stable ClassTalent IDs. Their existing stable choice key stores the required number of distinct targets, avoiding a larger instance-wrapper schema when no per-copy state exists beyond the choice.

#### ClassTalent slice 1D: Origin-Feat choice contract

- Lessons of the First Ones now declares one stable `feat_choice` effect restricted to the Origin category; its description is no longer the only home of that requirement.
- Persistent ClassTalent choices require a non-empty, unique `choiceId`, whether they select a Spell or a Feat. Import guardrails reject ambiguous choice storage contracts.
- This slice deliberately stops at the fact boundary. The next slice connects `lessons_origin_feat` to the real Feat catalog, creator/level-up picker, `chosenFeatOptions`, and the character's applied Feat IDs without treating Feats as Spells.

#### ClassTalent slice 1E: Lessons Origin-Feat consumer

- Lessons of the First Ones now opens a dedicated Feat choice sourced from its typed `feat_choice` effect. Eligibility reads the Feat catalog's canonical category and offers only Origin Feats; labels are display data while persisted values remain stable `f_` IDs.
- Creator and level-up store the selection under `invocation:lessons_origin_feat`. Save promotes the selected ID into the existing `extraFeatIds` pipeline, so the character sheet loads and applies the canonical Feat record rather than copying mechanics into the Invocation.
- Level-up cannot confirm while the selected Invocation's Feat choice is incomplete. Replacing or removing Lessons removes its formerly granted Feat and stale choice without deleting unrelated extra Feats.
- The choice derivation, eligibility filter, stable persistence, unrelated-Feat preservation, removal path, and edit-mode replacement have regressions. A visual browser smoke was unavailable in this session and is not claimed.
- Choice-bearing Origin Feats expose their ordinary nested proficiency, list, spellcasting-ability, and spell choices. They enter the same canonical Feat application pipeline as every other Feat; Invocation code does not copy or reinterpret their mechanics.

#### ClassTalent completion pass

- Repeatable Invocations can be selected more than once in creator and level-up flows. A compact duplicate-ID representation preserves copy count, while fixed spell/Feat choice counts scale with that count and require distinct selected targets.
- Devil's Sight, Eldritch Mind, and Gift of the Depths now author their persistent sheet facts as typed senses, saving-throw advantage, breathing, and equal-to-Speed swim movement effects.
- Maneuvers, Metamagic, Pact/familiar behavior, and conditional combat riders remain descriptive table rules because Beholden displays them but does not execute their decisions. This is an intentional boundary, not missing canonical automation.
- The canonical source and configured database contain the same 58 ClassTalent records byte-for-byte after JSON parsing; SQLite integrity is clean. Character fixtures accept their one-time canonical ID migration, and the 898-rule resolution audit reports no issues.

#### Spell slice 1B: stable spell-list access — complete

- Replaced 1,412 display-name relationships on all 411 spells with compact `access` arrays containing stable `sl_` IDs. The 41 display labels are declared once in sparse `spellLists` registries on the nine spellcasting Classes.
- Base and qualified eligibility remain on Spells. Automatic/always-prepared level grants remain Class progression facts; eligibility does not pretend to encode grant level or preparation behavior.
- Ordinary creator and level-up filtering sends the stable access ID and queries only `compendium_spells`. The server retains display-label resolution for compatibility and renders the existing Classes line from the Class registry.
- Adding a future spell to Light Domain now requires only `"sl_cleric_light_domain"` in that spell's `access`. Adding or changing an automatic domain grant remains an explicit Class progression edit.
- Import guardrails reject unresolved access IDs. The canonical source and development database contain 411 spells, 41 registered lists, 1,412 resolved access links, and zero legacy `classes` arrays.

#### Spell slice 1C: player-facing roll facts — complete

- Added sparse roll `effect` tokens for the thirteen damage types plus `healing` and `temp_hp`. Generic tables, damage reduction, mixed damage, and player-choice damage retain their labels instead of being falsely classified.
- Added compact `check`: normally one of `attack`, `str`, `dex`, `con`, `int`, `wis`, or `cha`; only the three real dual-check exceptions use an array.
- Migrated 666 display roll rows and 195 spell checks. Twenty-eight mixed-damage rows carry compact type arrays so the UI shows every relevant icon. Toll the Dead authors its normal `1d8`, `2d8`, `3d8`, and `4d8` character-level rows; the injured-target d12 remains in text for player resolution.
- Player spell rows, item spell rows, drawers, and spell-choice filters now consume typed facts. Removed prose damage/save/scaling parsing, hard-coded damage-cantrip name lists, and the Magic Missile name exception. Magic Missile displays its honest per-dart `1d4+1`; slot upcasting and projectile counts remain player-resolved from full text.
- Repaired all eighteen broken `%0` spellcasting-modifier placeholders to the canonical `SPELL` token and added an import guardrail against recurrence. All typed cantrips have complete level 0/5/11/17 rows.
- Re-imported all 411 Spells into the configured development database. It contains 666 typed rolls and 195 typed checks; SQLite integrity is `ok`.

### Backgrounds: canonical ownership — complete

- Audited all 57 Backgrounds. Every record already carries explicit skills, tools, ability-score options, and structured starting equipment; Custom Background is the only unrestricted Origin Feat choice.
- Removed 56 embedded Feat copies from Background records and replaced them with exact canonical Feat IDs. Every reference resolved uniquely by the embedded feat's exact catalog name.
- Added compact constrained choices as `featChoice: { count, from: [featIds] }`, allowing Ravenloft-style named choices without copying Feats or opening the entire Origin catalog.
- Background detail loading now resolves fixed Feat IDs through the Feat catalog before character creation or derived-feature display. Constrained creator choices filter by the authored IDs.
- Import guardrails reject unresolved fixed or constrained Feat references. Strict schema rejects embedded Feat objects, preventing ownership duplication from returning.
- The canonical Background batch fell from approximately 163 KB to 80 KB, a 51% reduction. The configured development database contains 57 Backgrounds, 56 fixed Feat references, zero embedded Feat objects, and passes SQLite integrity.

### Items: schema inventory

The initial item audit found the following mechanics reconstructed from names, broad type strings, or description prose. The slices below close every runtime case:

- weapon mastery assignment and mastery text;
- armor category, shield identity, weapon identity, ranged identity, ammunition identity, staff identity, and wearable/equippable behavior;
- stealth disadvantage when the explicit field is absent;
- charge maximums, charge recovery, spell costs, and last-charge consequences;
- item-granted spells, their casting ability, save/attack behavior, and activation costs;
- container capacity, extradimensional weight behavior, and bundled pack contents;
- Adamantine critical-hit protection and similar defenses;
- ammunition compatibility and linked-ammunition behavior;
- special item effects parsed through the general feature-prose parser.

The penultimate Item schema therefore needs these typed mechanical groups:

| Group | Required facts |
| --- | --- |
| Classification | canonical item kind, equipment slot/usage, armor category, weapon category, ranged/melee, ammunition type |
| Weapon | damage components, properties, mastery assignment, range, ammunition compatibility |
| Armor | base AC, Dexterity rule/cap, Strength requirement, stealth rule, shield bonus/identity |
| Uses | maximum charges/uses, activation cost, recovery timing/formula, depletion consequence |
| Spell access | exact spell IDs, charge cost or free uses, cast level, casting ability, save DC/attack bonus source |
| Container | whether the item creates a container, whether contents contribute to carried weight, bundled item IDs and quantities |
| Effects | typed ability/check/save/AC/speed/defense/action effects with explicit gates and durations |
| Consumable | explicit consumption only where the application executes it; otherwise honest manual rules and ordinary quantity tracking |

Initial corpus measurements: 1,729 items; 775 weapon records; 288 armor records; 595 records with generic modifiers; 171 descriptions mentioning charges; approximately 98 descriptions coupling spells and charges; and roughly 744 weapon descriptions carrying mastery prose. These counts are audit inputs, not proof that every match is a distinct mechanic.

#### Item slice 1: weapon mastery — complete

- Added canonical `weapon.mastery`, restricted to Cleave, Graze, Nick, Push, Sap, Slow, Topple, and Vex.
- Migrated 744 item records in `WotC_2024_only.json`; zero invalid values and zero mastery-bearing descriptions remain without the structured field.
- Propagated mastery through item projection, lookup, character creation, inventory enrichment, and combat/inventory displays.
- Deleted the runtime description parser and hard-coded weapon-name-to-mastery table.
- Added schema rejection for invented mastery values, corpus validation for missing structured mastery, and a runtime regression proving names/descriptions cannot override the canonical fact.
- Re-imported all 1,729 canonical items into the configured database. Spot checks: `i_longsword.weapon.mastery = "Sap"`; `i_adamantine_club.weapon.mastery = "Slow"`.

The Adamantine Club spot check exposed a real defect in the deleted inference table: it guessed `Nick` from the base weapon name while the authored record assigns `Slow`. This slice is therefore both a schema improvement and a correctness fix. Items remains **In progress** until the remaining typed groups above are complete.

#### Item slice 2: uses and spell access — in progress

This group is deliberately split so charge tracking does not become coupled to spellcasting:

1. **2A — use pools:** maximum, recovery, and last-use outcomes.
2. **2B — charged spell access:** spell ID, charge cost, cast-level override, and casting-stat/DC override for the item spell tables consumed by the player.
3. **2C — direct and bound spell access:** non-table spell grants, per-spell daily uses, random spell sets, stored/bound spell templates, and scroll/tattoo spell choices.

The initial corpus audit found 171 charge-bearing item records. Their maximums are not uniformly fixed numbers: 56 records use a rolled initial maximum (`1d8+1` or `1d3`), while the remainder use fixed maximums from 1 through 50. Recovery also has materially different behavior:

- 110 recover charges, usually a partial formula at the next dawn;
- 61 have no recovery and permanently consume their finite charges;
- 30 describe a special outcome when the last charge is expended;
- 17 contain a spell-to-charge-cost table currently parsed by the player at runtime.

The compact contract for 2A is:

- a scalar `uses` value represents the maximum and receives the documented `long_rest`/full-recovery default;
- an object is used only for a rolled maximum, partial recovery, no recovery, or a last-use outcome;
- no-recovery pools must say so explicitly because resetting them on a Long Rest would change the rule;
- recovery timing is omitted when it is the default, while a recovery amount is stored only when it is not “all”;
- depletion outcomes are typed and present only on the items that have them.

The accepted representation is `uses: maximum` for the default full Long Rest recovery. Exceptional pools use `uses: { max, recover?, depletion? }`: `recover` is a formula or `false`, and `depletion` is either an unconditional typed outcome or a compact d20 outcome map. Maximum and recovery amounts accept a positive integer or a compact dice formula. The object form is rejected when it adds no information beyond the scalar default.

##### Item slice 2A: use pools — complete

- Migrated all 171 charge-bearing records in `WotC_2024_only.json`; zero descriptions mentioning charges remain without canonical `uses`.
- Classified all 30 last-charge rules as destruction, becoming mundane/losing properties, or conditional recovery. No item-name lookup is used.
- Added strict validation for fixed and rolled maximums, partial and absent recovery, d20 outcomes, sparse object requirements, and invalid formulas/results.
- Propagated `uses` through item storage projection, list/lookup/detail APIs, inventory selection, inventory enrichment, and player-owned copies.
- Deleted charge-maximum parsing from item descriptions. Fixed pools initialize directly; rolled initial pools are rolled once and persisted on the owned item.
- Long Rest now follows the canonical recovery fact: default pools refill, partial pools regain their formula up to maximum, and `recover: false` pools remain depleted.
- Re-imported all 1,729 canonical items into the configured development database. Spot check: Wand of Magic Missiles has `{ max: 7, recover: "1d6+1", depletion: { destroy: 1 } }`.
- Verified the strict seven-batch document parses with 1,729 items and exactly 171 structured use pools. Server tests: 319 passed. Player tests: 133 passed.

##### Item slice 2B: charged spell access — complete

- Added compact `spells`, keyed directly by canonical spell ID. A scalar value is the charge cost; an object appears only for level-based cost, cast-level, maximum level, per-spell DC/attack, use count, or a real restriction note.
- Added sparse item-level `spellcasting`: `"character"` uses the wielder's spellcasting values; an object stores fixed DC/attack values. Per-spell values override the item default.
- Migrated all 17 authored spell-charge tables into 96 validated spell-ID links. Zero table rows failed resolution and zero spell-charge tables remain without structured data.
- Correctly scoped fixed values: Wand of Orcus uses item spell DC 18 rather than its unrelated attunement DC 17; Orb of Dragonkind stores DC 18 only on Scrying.
- Preserved level variants such as Staff of Power's level 5 Fireball and Lightning Bolt, variable cost such as Staff of Healing's Cure Wounds, and textual restrictions only where the restriction changes access.
- Propagated spell access through item projection, list/lookup/detail APIs, inventory selection/enrichment, and player-owned copies.
- Deleted player parsing of item spell tables and name-based spell lookup. The player now fetches spell details using the canonical IDs.
- Added import guardrails rejecting unresolved item spell IDs and editor round-trip tests preserving `spells` and `spellcasting`.
- Re-imported all 1,729 items into the development database. Strict document validation and guardrails pass. Server tests: 322 passed. Player tests: 134 passed.

##### Item slice 2C: direct and dynamic spell access — complete

- Audited every remaining item description mentioning casting instead of bulk-matching spell names. False positives such as “cast iron,” cast-off dragon scales, curse-removal instructions, and spell-triggered drawbacks remain prose because they do not grant spell access.
- Migrated 74 direct-grant items to 155 canonical spell-ID links, including free casting, per-spell uses, rolled uses, fixed or character casting values, cast levels, upcasting, and restrictions that materially change access.
- Added compact `spellTemplate` variants for spells selected when the item is created (`bound`), spells loaded into an item (`stored`), eligible spells chosen at use time (`choice`), and explicit die/range spell outcomes (`random`). A scalar template is standard; an array is permitted only when an item genuinely combines mechanics.
- Migrated 25 dynamic records: Enspelled items, all Spell Scroll tiers, spell-storing items, class-list cantrip items, Hat of Many Spells, Thayan Spell Tattoo, Tome of the Stilled Tongue, Cube of Summoning, Necklace of Prayer Beads, and Wand of Wonder.
- Random spell results are cold facts keyed by roll range. Nested tables use a second template with an explicit `when` link; the runtime never scrapes the item description to discover outcomes.
- Propagated templates through storage projection, item list/lookup/detail APIs, inventory selection, enrichment, and player-owned copies. Import guardrails validate every fixed and random spell ID.
- Re-imported the strict seven-batch source into the configured development database: 3,123 total records, including all 1,729 items. Spot checks: Hat of Many Spells and Wand of Wonder each preserve two templates; Ring of Elemental Command (Fire) preserves four exact spell links.
- Strict document validation passes for all 3,123 entries. Server and player typechecks pass; item/schema server tests pass.

Slice 2 is complete. Item completion remains **In progress** because classification, containers, typed effects, and consumables are separate mechanical groups.

#### Item slice 3 audit: structural classification — no duplicate taxonomy required

The 1,729-item corpus confirms that the existing mechanical shape already classifies weapons and armor compactly:

- `weapon` exists on 775 records and is itself the weapon discriminator. `type` then supplies the only non-derivable mode: 541 Melee Weapons, 222 Ranged Weapons, and 12 Staff weapons.
- Weapon `properties` already carry the orthogonal rules: `M` is Martial, `F` Finesse, `L` Light, `T` Thrown, `A` Ammunition, `V` Versatile, `2H` Two-Handed, and so on. All 484 records whose proficiency begins with `martial` have `M`; no Simple weapon has `M`. Therefore a second `weapon.category` field would duplicate an existing cold fact.
- `armor` exists on 288 records and is itself the armor discriminator. Existing `type` values are exact mechanical categories: 61 Light, 122 Medium, 93 Heavy, and 12 Shields. Every armor record has canonical AC data. A second armor category or shield boolean would be redundant.
- Range cannot classify the weapon mode because Thrown melee weapons have range and Darts are Ranged Weapons with the Thrown property. The authored `type` distinction must remain authoritative.
- `equippable` cannot be derived only from `weapon` or `armor`: 315 equippable records are rings, wands, rods, worn wondrous items, and similar gear. It remains a legitimate sparse UI/use fact until equipment slots are modeled.

The audit found data repairs, not a missing classification schema:

- Three weapon records lack damage: Holy Avenger Javelin, Staff of Charming, and Vicious Greataxe.
- Thirteen unique/artifact weapons lack their base-weapon proficiency identity even though twelve still declare Martial through `M`. This affects proficiency matching, not simple-versus-martial classification.
- Repulsion Shield is the sole shield missing `proficiency: "shield"`; its `type: "Shield"` still classifies it correctly.

Decision: do not add `kind`, `weapon.category`, `weapon.mode`, `armor.category`, or `isShield`. Repair the incomplete records, make runtime helpers read `weapon`/`armor`, `type`, and `properties`, and remove name/description fallbacks. New schema fields are justified only for facts the current structure cannot express, such as ammunition compatibility, container behavior, or consumption.

##### Item slice 3A: structural weapon and armor classification — complete

- Repaired 27 canonical records. All 775 weapons now have authored damage and base proficiency identity; all 12 Shields have shield proficiency.
- Added complete quarterstaff mechanics to eleven magic staffs that previously depended on a runtime “Staff” convention: `1d6`/`1d8`, Bludgeoning, Versatile, Topple, and `simple, quarterstaff`.
- Repaired Holy Avenger Javelin (`1d6`) and Vicious Greataxe (`1d12`), plus thirteen unique/artifact base-weapon identities used for proficiency checks.
- Weapon detection now requires authored damage. Armor and Shield detection use their exact canonical `type`; names no longer turn an item into armor, a shield, or a weapon.
- Martial/Simple, Finesse, Light, Heavy, Thrown, Versatile, Two-Handed, and related filters read only the canonical property codes. Crossbow and bow filters read the authored base proficiency rather than display names.
- Magic weapon proficiency matching now uses the canonical base identity, so proficiency with Longswords applies to Sword of Kas without guessing from “Sword.”
- Removed default staff damage, wearable-name dictionaries, description-based Stealth disadvantage, name-based Shield detection, and type/name-based generic weapon detection.
- `equippable` is now the sole wearable fact for non-weapon/non-armor items. Torch/offhand handling and ammunition identity remain explicitly deferred to the usage/compatibility slice because the current schema cannot yet express them without a name fallback.
- The migration performs a corpus completion check even though the general schema remains permissive enough to accept partial third-party/conversion input. The canonical source itself has zero missing weapon damage, weapon proficiency, or shield proficiency records.

##### Item slice 3B: ammunition compatibility and held usage — complete

- Removed the unused `AF` property. It occurred on zero records and duplicated the meaning of `A`; ammunition weapons now use only `A` plus an exact `weapon.ammo` family.
- Added one compact six-value ammunition vocabulary: `arrow`, `bolt`, `energy-cell`, `firearm-bullet`, `needle`, and `sling-bullet`. The family appears as `weapon.ammo` on ammunition weapons and top-level `ammo` on ammunition stacks.
- Migrated all 209 `A` weapons and all 47 `Ammo` items. The completion audit reports zero missing families, zero invalid families, and zero remaining `AF` properties.
- Compatibility is exact family equality. Linking, the ammunition picker, and combat bonus consumption no longer infer compatibility from item names or broad ranged-weapon status; stale incompatible links are ignored.
- Added sparse `usage: "held"` for the one fact not represented by weapon, armor, or equippable structure. Torch is currently the sole held-usage record, replacing its name-based offhand exception.
- Strict validation passed for all 3,123 canonical entries. Server typecheck and 330 tests pass; player typecheck and 145 tests pass. The 1,729-item batch was reimported into the configured development database successfully.

#### Item slice 4: containers and bundles — complete

Capacity limits remain rules text for players and DMs; the application does not police pounds, liquid volume, cubic volume, or specialized quiver slots. The canonical schema stores only the two facts that change inventory behavior: whether an item creates a container and whether that container ignores the weight of its contents.

##### Item slice 4A: bundled packs — complete

- Added compact `bundle: { container, items }`, where `container` is one canonical item ID and `items` is an item-ID-to-quantity record. The container cannot also appear among the contents.
- Migrated all seven authored packs: Burglar's, Diplomat's, Dungeoneer's, Entertainer's, Explorer's, Priest's, and Scholar's. Every referenced container/content ID resolves against the canonical item batch.
- Deleted runtime parsing of pack descriptions, loose plural normalization, and name-created contents. Adding a pack now fetches its declared IDs, creates the declared Backpack or Chest container, and adds contents with stable compendium identity.
- Import guardrails now reject unknown bundle container or content IDs. Strict validation passes for all 3,123 entries; server typecheck and 331 tests pass; player typecheck and 144 tests pass.
- Reimported the complete 1,729-item batch into the configured development database.

##### Item slice 4B: container behavior — complete

- Added sparse `container: true` and `ignoreWeight: true`. `ignoreWeight` is valid only on a declared container and is omitted for ordinary containers.
- Migrated 20 real storage items. Bag of Holding, Heward's Handy Haversack, Portable Hole, and Quiver of Ehlonna are the four containers whose contents do not contribute to carried weight.
- Adding any declared container now creates its inventory container directly from canonical data. Removed the Bag of Holding name expression and its hardcoded special case.
- Deliberately rejected capacity fields and a specialized 4C schema: pounds, gallons, cubic feet, compartment counts, and accepted-object limits remain visible in item descriptions but are not application-enforced mechanics.
- Strict validation passes for all 3,123 entries; server typecheck and 333 tests pass; player typecheck and 144 tests pass. Reimported all 1,729 Items into the configured development database.

#### Item slice 5: passive effects and consumable boundary — complete

- Reused the shared `StructuredFeatureEffectSchema`; Items do not have a parallel effect language. Added sparse `effects`, `resolution`, and `resolutionNotes` fields.
- Audited all 1,729 descriptions through the former runtime parser. It produced 339 candidates, including proven false positives: summoned-creature immunities, permanent tome/deck outcomes, spell access already represented by canonical IDs, and AC bonuses already represented by armor/modifier fields. Those were not blindly migrated.
- Migrated 241 verified passive effects across 231 Items: equipped ability-score floors, damage resistances, wearer condition immunities, senses, movement modes, check advantages, and all eight Adamantine critical-hit protections.
- Item ability scores, defenses, senses, speed, and related derived behavior now consume only canonical `effects`. Deleted item-prose effect parsing, Adamantine name/text recognition, and ability-score sentence parsing.
- Existing inventory copies heal `effects` from their canonical item ID through the normal inventory lookup path. Picker, character creation, treasure awards, storage projection, and list/lookup/detail APIs preserve the field.
- Consumables do not receive a redundant blanket schema. Spell items already declare `consume: true`; finite item pools use `uses`; ordinary Potion/consumable quantities remain player-driven. Effects the application does not execute automatically remain manual description rules rather than pretending to be structured automation.
- Added a regression proving item prose alone cannot change a character's ability scores. Strict validation passes for all 3,123 records; all 1,729 Items reimport successfully. Server typecheck and 334 tests pass; player typecheck and 145 tests pass.

**Items completion decision:** all five canonical gate dimensions are satisfied. A new Item can define every application-executed mechanic through data without item-name code or runtime prose parsing. Capacity policing and automatic adjudication of bespoke magic-item actions are deliberately outside the product behavior, not missing inference fallbacks.

## Source under review

- File: `C:\Users\cellu\Dropbox\D&D\App Files\WotC_2024_only.json`
- Format: valid JSON
- Categories: monsters, items, spells, class talents, classes, species, backgrounds, and feats
- Total entries: 3,123
- Policy: preserve stable IDs and player choices; do not silently merge records based only on display names

## Validation sequence

| # | Validation | Outcome | Status |
| --- | --- | --- | --- |
| 1 | Duplicate IDs and names | Every ID is unique; same-name records are classified explicitly | Complete |
| 2 | Broken references | Spell, item, class, subclass, species, background, and feat references resolve | Complete |
| 3 | Class progression | Levels, spell slots, feature ownership, and choice counts are coherent | Complete |
| 4 | Parser coverage | Deterministic rules have structured effects or an explicit manual designation | Complete |
| 5 | Character fixtures | Existing characters retain choices and derive expected statistics and features | Complete |
| 6 | Import guardrails | Corrupt mechanical terms and unresolved references fail validation visibly | Complete |
| 7 | Production readiness | Full verification, dry-run import, backup, deployment, and smoke tests pass | Import complete against the local database (2026-07-14) — see below. Production deployment not started. |

## Step 1: Duplicate IDs and names

Completed against the cleaned JSON.

| Category | Entries | Duplicate IDs | Duplicate names |
| --- | ---: | ---: | ---: |
| Monsters | 562 | 0 | 0 |
| Items | 1,729 | 0 | 4 |
| Spells | 411 | 0 | 0 |
| Class talents | 58 | 0 | 0 |
| Classes | 13 | 0 | 0 |
| Species | 16 | 0 | 0 |
| Backgrounds | 57 | 0 | 0 |
| Feats | 277 | 0 | 0 |
| **Total** | **3,123** | **0** | **4** |

### Same-name item records

These are not ID collisions. Each record has a distinct stable ID and represents text from a different source book.

| Name | Primary ID and source | Alternate ID and source | Classification |
| --- | --- | --- | --- |
| Potion of Healing | `i_potion_of_healing` — Player's Handbook (5.5e), p. 228 | `i_potion_of_healing_2` — Dungeon Master's Guide (5.5e), p. 288 | Same mechanics; DMG record adds a roll and flavor sentence |
| Prosthetic Limb | `i_prosthetic_limb` — Dungeon Master's Guide (5.5e), p. 290 | `i_prosthetic_limb_2` — Forgotten Realms: Heroes of Faerûn, p. 133 | Same base mechanics; setting record adds free pricing and setting prose |
| Spell Scroll (Cantrip) | `i_spell_scroll_(cantrip)` — Player's Handbook (5.5e), p. 228 | `i_spell_scroll_(cantrip)_2` — Dungeon Master's Guide (5.5e), p. 305 | DMG record contains additional casting and spellbook-copying rules |
| Spell Scroll (Level 1) | `i_spell_scroll_(level_1)` — Player's Handbook (5.5e), p. 228 | `i_spell_scroll_(level_1)_2` — Dungeon Master's Guide (5.5e), p. 305 | DMG record contains additional casting and spellbook-copying rules |

### Step 1 decision

- Keep all eight records and their existing IDs.
- Treat IDs—not names—as authoritative references.
- Name-only lookup must not silently select one of these records.
- Import and UI lookup should either use an exact ID or present the source when duplicate names exist.
- Do not append source text to the canonical display name; source is separate metadata.

## Step 2: Broken references

The first reference pass validates explicit spell IDs, structured prepared-spell names, embedded background feats, internal feat-choice links, spell-list class labels, and background equipment labels.

### Valid reference groups

- All 56 embedded background feats resolve to a catalog feat by normalized name.
- All feat `dependsOnChoiceId` and `spellcastingAbilityFromChoiceId` values resolve inside their owning feat.
- All 41 spell-list labels resolve to either a base class or a subclass/land variant present in that class definition.
- Monster spell IDs and structured prepared-spell names resolve after the repairs below.

### Repaired structured references

The live JSON was corrected in place for 29 deterministic reference defects:

- Added `s_fireball` to the Vampire Infernalist's `Fireball (level 4 version)` reference.
- Rejoined compound prepared-spell names that had been split into separate fake spells:
  - `Protection from Evil and Good`
  - `Create Food and Water`
  - `Detect Evil and Good`
  - `Locate Animals or Plants`
  - `Conjure Minor Elementals`
- Removed nine `*` footnote markers from Knowledge Domain structured spell names while leaving the prose intact.

Post-repair verification reports zero unresolved monster spell IDs and zero unresolved prepared-spell names.

### Repaired background equipment

Background equipment originally contained 337 name-based labels, including 116 that strict name matching could not resolve. These included:

- Reordered catalog names, such as `Traveler's Clothes` versus `Clothes, Traveler's`.
- Plural or quantity labels, such as `Daggers`, `Arrows`, `Torches`, and `Rations (3 days' worth)`.
- Descriptive variants, such as `Book (history)` and `Holy Symbol (reliquary)`.
- Player-choice placeholders, such as `Gaming Set (same as above)`, `Artisan's Tools (same as above)`, and `Musical Instrument (same as above)`.
- Compound choices, such as `Arcane Focus (Crystal or Wand)`.
- One malformed equipment label, `Waterskin 26 GP`, which appears to have merged an item and currency value.

These labels are no longer resolved with fuzzy matching at runtime. The canonical representation distinguishes:

- An exact item reference: stable item ID plus quantity.
- A reference to a prior player choice: an explicit choice key.
- A choice among item IDs: a structured item-choice list.
- Currency: a separate currency entry.
- A deliberately custom/detached item: an explicit local snapshot.

All 337 entries have now been converted to those explicit forms and validate without name guessing.

#### Background-equipment migration dry run

The deterministic equipment transformer now classifies all 337 structured background-equipment entries without fuzzy runtime lookup:

- Exact and normalized catalog references become `{ kind: "item", itemId, quantity, sourceLabel }`.
- `same as above` tool, gaming-set, artisan-tool, and musical-instrument entries become `choiceRef` records tied to `background.tools`.
- Generic Holy Symbol and Arcane Focus selections become explicit `itemChoice` records containing valid candidate item IDs.
- `Waterskin 26 GP` becomes a Waterskin item plus a separate 26 GP currency entry.
- All 390 affected item IDs are rewritten to their future canonical IDs inside the transformed document.
- Zero equipment labels remain unclassified in the dry run.

The transformed JSON was written on 2026-07-14 after the application schema, character-creation consumer, choice validation, and regression tests supported `itemId`, `choiceRef`, and `itemChoice`. The strict native importer validates all 3,123 entries.

### Canonical ID migration scope

The Step 2 migration intentionally covers **item IDs only**. This keeps the equipment cutover bounded and avoids rewriting unrelated character choices during the same migration.

- 390 item IDs currently contain punctuation and will be converted to lowercase underscore-only canonical IDs.
- Existing live references to those item IDs must be rewritten in the same one-time migration.
- No permanent alias map will remain after the live database and compendium have both migrated successfully.

#### Item-ID dry run

The canonicalization dry run completed against the cleaned JSON and the configured local Beholden database:

- 1,729 item records inspected.
- 390 item IDs require rewriting.
- Zero canonical-ID collisions.
- Zero invalid result IDs.
- Three affected database storage locations:
  - `compendium_items.id`: 390 exact IDs.
  - `compendium_items.data_json`: 390 embedded IDs.
  - `user_characters.character_data_json`: 11 embedded item references.
- No affected local party-inventory or treasure references were found in this dry run.

The configured local database migration was applied transactionally on 2026-07-14. It changed 390 item primary keys and embedded records plus 11 item references across five character JSON documents. A post-migration dry run reports zero remaining old item IDs. Any separately hosted production database must still run the same dry run and one-time migration; local counts must not be assumed to represent that database.

The following non-item ID cleanup is explicitly **deferred and not complete**:

| Category | IDs requiring canonicalization | Deferred phase |
| --- | ---: | --- |
| Monsters | 16 | Monster/encounter compendium migration |
| Spells | 93 | Class and spell-rule migration |
| Species | 8 | Species source-of-truth phase |
| Backgrounds | 14 | Background schema migration |
| Feats | 196 | Class/feat source-of-truth migration |
| Classes | 0 | No current ID cleanup required |
| **Deferred total** | **327** | **Not completed by Step 2** |

Those categories must not be marked canonical merely because item IDs are clean. Each later migration must:

- Rewrite all live references in the same transaction or controlled cutover.
- Verify that no old IDs remain in relational columns or JSON payloads.
- Re-import and validate the compendium with aliases disabled.
- Record completion in this document.

## Step 3: Class progression

Completed against all 13 classes and all 260 class levels.

The repeatable validator now checks:

- Exactly one ordered level record for each level 1 through 20.
- Class hit dice.
- Starting skill- and tool-choice counts.
- Ability Score Improvement ownership, including the Fighter and Rogue exceptions.
- Full-caster, half-caster, and Warlock Pact Magic slot progression at every level.
- Duplicate feature IDs inside a class.
- Agreement between a feature's `Level N:` name and the level record that owns it.
- Absence of base-class spell slots on non-casters.

Three deterministic defects were repaired:

- Fighter/Banneret `Level 18: Inspiring Gommander` was stored under level 15. It is now correctly named `Level 15: Inspiring Commander`.
- Artificer/Alchemist `Chemical Mastry` is now `Chemical Mastery`.
- Artificer level 19 incorrectly carried `abilityScoreImprovement: true` in addition to its Epic Boon feature, unlike the other classes. The stray ASI marker was removed.

Post-repair results: 13 classes, 260 levels, zero progression issues, and a successful strict import of all 3,123 compendium entries. The same three changes were applied transactionally to the configured local database; its verification dry run reports zero remaining changes.

## Step 4: Parser coverage

Completed for every canonical class feature, species trait, and feat.

The repeatable resolution validator inspected 1,040 rules:

| Resolution | Rules |
| --- | ---: |
| Manual | 688 |
| Mixed | 343 |
| Automatic | 9 |

Results:

- Every rule has one of the three supported resolution declarations.
- Every `automatic` or `mixed` rule has structured mechanics: effects, resources, scaling rolls, prepared-spell progression, spell grants, or feat mechanics.
- Zero rules are silently unclassified.
- Zero `automatic` or `mixed` declarations lack a structured payload.

`manual` does not mean the rule is permanently finished or incapable of future automation. It means the current compendium explicitly tells the application not to infer deterministic behavior from prose. Those rules can be promoted individually to `mixed` or `automatic` as structured evaluators are added without weakening this guardrail.

## Step 5: Character fixtures

Completed using the exported Drokkan Skarvulf and Alarion Veilborne characters that originally exposed the level-up preservation defects.

The repeatable fixture validator checks:

- Class, species, background, feat, spell, and linked-item references against the migrated compendium.
- Legacy item references after applying the one-time canonical item-ID transformation.
- Stored class hit die and class skill-choice count.
- Continued eligibility of every retained class skill.
- Every required base-class and selected-subclass feature through the character's current level.
- Drokkan's Medium Armor training from the Barbarian source, level-5 Fast Movement speed, and equipped Medium Armor AC.
- Alarion's unarmored AC and level-6 Wizard HP calculation.

Fixture results:

| Character | Level | Required class/subclass features | Linked compendium items | Spell references | Chosen feats | Issues |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Drokkan Skarvulf | 7 | 13 | 10 | 0 | 2 | 0 |
| Alarion Veilborne | 6 | 10 | 7 | 27 | 1 | 0 |

The audit initially exposed a malformed canonical record rather than a stale character choice. Drokkan correctly stored `f_great_weapon_master`; the sole compendium record had been unnecessarily renamed to `Great Weapon Master - PHB 2024`, producing the one-off ID `f_great_weapon_master_-_phb_2024`. The source XML contains no competing record requiring that distinction. The canonical feat is now restored to `Great Weapon Master` / `f_great_weapon_master` in the JSON and configured database, and Drokkan's original choice resolves directly. No runtime alias was added.

## Step 6: Import guardrails

Completed for native preview, multi-category document import, and single-batch native documents. The low-level `importNativeCompendiumBatch` helper remains an internal seed/conversion primitive; user-facing imports go through document validation.

Imports now fail visibly before writing when they contain:

- Explicit monster spell IDs, feature/feat spell grants, or prepared-progression spell references that resolve to neither an incoming nor an existing spell. Legacy name-only monster annotations remain display text rather than pretending to be canonical references.
- Background equipment item IDs or item-choice IDs that resolve to neither an incoming nor an existing item.
- Legacy name-only background equipment; canonical native imports require an explicit `itemId`.
- Unknown class skill names.
- Unknown spell-list or spell-school filters in structured spell choices.
- Known mojibake/replacement characters and corrupted mechanical tokens.

Preview uses the same guardrails as import. Multi-category imports validate the entire bundle before the transaction starts, and regression tests verify that a later unresolved reference leaves earlier valid batches unwritten.

The first corpus run found an older parser defect: feat grants split `Purify Food and Drink` and `Detect Poison and Disease` at the conjunction. The parser now protects compound spell names, with regression coverage. Six canonical records containing twelve broken fragments were repaired in the JSON and configured database.

Post-repair, the complete 3,123-entry canonical bundle passes strict schema validation and all import guardrails against the configured database: 3,123 recognized replacements and zero unresolved references.

## Step 7: Production readiness (import against the local database, 2026-07-14)

The user ran the real import through the web-dm Compendium admin panel (native preview → native import) against their local database, deliberately: "if stuff breaks, now is the time to fix it." A manual backup of `beholden.db` plus its `-wal`/`-shm` sidecar files was taken immediately before, per the "no automatic backup exists" finding below.

**Codex's post-import report:** SQLite integrity OK, foreign-key check OK, all 3,123 source entries present with no missing/extra IDs, no name mismatches, no malformed stored JSON, class progression clean (13 classes, 260 levels), rule-resolution validation clean (1,040 rules), Drokkan/Alarion fixtures pass, item-ID dry run reports zero remaining changes.

**Independently verified (Claude), directly against the live database:**

- Table counts now match the cleaned corpus exactly, including spells: monsters 562, items 1,729, spells 469 (previously 628 — the extra ~159 were legacy 2014-edition spells from Xanathar's/Tasha's/Eberron/etc. still sitting in the table pre-import; those are gone now), classes 13, species 16, backgrounds 57, feats 277.
- `PRAGMA integrity_check` returns `ok`.
- `r_warforged` exists with `speed: 30`, `size: "M"`.
- **Not yet done, and not mentioned in Codex's report:** the 8 punctuated species IDs (`r_elf,_drow`, `r_elf,_high`, `r_elf,_wood`, `r_gnome,_forest`, `r_gnome,_rock`, `r_tiefling,_abyssal`, `r_tiefling,_chthonic`, `r_tiefling,_infernal`) flagged in Step 2's deferred-ID table are still present unchanged after the import — the import brings in new *content*, it does not perform the separate, still-outstanding species-ID canonicalization.

**Real gap Codex surfaced, confirmed independently:** the import makes the compendium data-complete, not mechanically authoritative. Of 1,040 total rules, 688 are `manual` (no structured effects — the application cannot apply them automatically) and 343 are `mixed`; only 9 are fully `automatic`. Concretely verified against Warforged: all 9 of its traits (Constructed Resilience, Integrated Protection, Sentry's Rest, Specialized Design, Tireless, etc.) are `manual` — the compendium has the correct prose, but nothing computes the +1 AC, poison resistance, or other mechanics from it. This is by design for genuinely GM-adjudicated content, but for deterministic mechanics like Integrated Protection's flat AC bonus it's a real, in-scope gap for Phases 1–2 of `COMPENDIUM_SOURCE_OF_TRUTH.md`'s "Target design" (which explicitly call for species traits and class features to be "structured effects," not just correctly-read prose) — not something invented by this import.

Production deployment (a separately hosted database, if one exists) has not been attempted; this section covers only the local database.

## Resolved: application-layer item modifier/AC bug (not a data problem)

Found while discussing this document, 2026-07-14; fixed the same day once the item-ID migration below reached the local database. This was **not** a defect in `WotC_2024_only.json` — the compendium data for magic items was already correct and structured. It was a Beholden application bug in how that data was consumed, discovered while reviewing item records.

**Confirmed against the live local database** (`beholden.db`, `compendium_items` table):

```
Shield              -> armor.ac: 2
Shield +1           -> armor.ac: 2, modifiers: [{category:"bonus", value:"ac +1"}]
Studded Leather Armor    -> armor.ac: 12
Studded Leather Armor +1 -> armor.ac: 12, modifiers: [{category:"bonus", value:"ac +1"}]
Longbow +1                -> modifiers: [{"ranged attacks +1"},{"ranged damage +1"}]
```

The base value and the enchantment bonus are already two separate, structured fields. Nothing needs to change in the data. The bug is that four independent server/client consumers each re-derive item stats from this shape, and only one of them does it correctly:

| Location | Bug |
| --- | --- |
| `server/src/routes/compendium/items.ts` (`mapLookupRow`, ~line 72) — bulk item lookup used by character creator + inventory sync | Reads `ac`/`dmg1` correctly via `itemFromV2()`, but drops `modifiers` from the response entirely |
| `server/src/routes/compendium/items.ts` (list/search endpoint, ~line 260) | Same — drops `modifiers` |
| `server/src/routes/treasure.ts` (DM "Award Treasure" endpoint, ~line 274) | Does its own raw `JSON.parse` instead of going through `parseStoredCompendiumEntry`/`itemFromV2`, and reads `data.ac`/`data.dmg1` at the wrong nesting level (real path is `data.armor.ac`/`data.weapon.damage`). Every piece of armor or weapon ever awarded via DM treasure currently gets `ac: null`, `dmg1: null` — live, currently-active bug, independent of the modifiers question |
| Client (`web-player/src/views/character/CharacterViewDerivedState.ts`) | Shield AC is a hardcoded flat `+2` (line ~246) that never looks at the item at all. Armor AC uses the item's base `ac` but never adds a modifier bonus. Weapon attack/damage bonus (`CharacterCombatPanels.tsx` ~line 313) works around all of this by regexing `+1` out of the item's **name** instead of reading `modifiers`, which is already sitting there |

`GET /api/compendium/items/:itemId` (single-item detail) is the one place `modifiers` survives end-to-end today, but only to render as description text in the compendium browser — nothing programmatic reads it.

**Fix applied, 2026-07-14 (Claude), after the local item-ID migration landed:**

1. `shared/src/domain/items.ts` — added `parseItemModifierBonus(modifiers, target)`, a general-purpose parser for the compendium's `{ category, text: "<label> <+/-N>" }` modifier shape. Not limited to AC/weapon bonuses — the same live database was found to carry ~30 modifier categories (ability scores, skills, saves, initiative, spell attack/DC, proficiency bonus, etc.), so the helper takes an arbitrary target label rather than hardcoding five cases. Only AC and weapon attack/damage are wired up to a consumer today; the rest are available to future work for free.
2. `server/src/routes/compendium/items.ts` — both the bulk lookup (`mapLookupRow`) and the list/search endpoint now include `modifiers` in their responses; previously computed by `itemFromV2()` and silently dropped.
3. `server/src/routes/treasure.ts` — the "Award Treasure" handler now routes through `parseStoredCompendiumEntry("items", ...)` instead of raw `JSON.parse`. This also fixed a second, previously-undocumented bug: it was reading `data.ac`/`data.dmg1` at the wrong nesting level (the canonical shape nests these under `armor`/`weapon`), so every armor/weapon piece ever awarded via DM treasure got `ac: null`, `dmg1: null` regardless of the modifiers question.
4. Client — `CharacterViewDerivedState.ts`'s hardcoded shield `+2` and armor AC calc now add `parseItemModifierBonus(item.modifiers, "ac")` on top of the base value. `CharacterCombatPanels.tsx`'s weapon attack/damage bonus now reads `weaponAttackModifierBonus`/`weaponDamageModifierBonus` (new, in `CharacterInventory.ts`) instead of regexing `+N` out of the item's name — these check both a generic ("weapon attacks") and melee/ranged-specific ("ranged attacks") modifier label, since the compendium data uses either depending on the item.
5. Write paths that place a new item into a character's inventory — treasure award, starting equipment (`CharacterCreatorEquipmentUtils.ts`), and the manual item picker (`CharacterInventoryPickerModal.tsx`) — now all carry `modifiers` onto the stored `InventoryItem`, consistent with how `ac`/`dmg1`/etc. are already copied at add-time (this codebase's existing pattern for item stats — not a live compendium lookup on every read). The itemIndex-based healing effect in `useCharacterInventorySync.ts` (which already backfills missing `ac`/`dmg1` on existing items when the inventory panel loads) now backfills `modifiers` the same way.
6. Known limitation, not fixed today: items already in a character's inventory from *before* this change will show 0 magic bonus until something re-saves that item (the healing effect populates it locally the next time the inventory panel loads, but only persists on the character's *next* unrelated inventory action — equip, edit, etc.). No forced backfill migration was run. If this matters in practice, revisit.
7. Verification: `tsc --noEmit` clean on `server`/`web-player`/`web-dm`. Full suites green — server 303 tests, `web-player` 124 tests (2 new: a shield+armor magic-bonus AC test, a weapon attack/damage modifier-bonus test), `web-dm` 6 tests.

## Incoming book conversion

The remaining split XML book folders under `compendium/` have reproducible Grand Schema JSON patch bundles under `compendium/JSONs/`. Eberron was removed from this workflow because its records, including Warforged and Artificer content, are already incorporated into `WotC_2024_only.json`; generating a second Eberron bundle would create duplicate/replacement hazards.

| Book | Entries | Spell-list stubs resolved | Conversion warnings | Import status |
| --- | ---: | ---: | ---: | --- |
| Forgotten Realms: Heroes of Faerun | 153 | 41 | 0 | Discarded after audit: already canonical; patch contained unsafe/formatting artifacts |
| Lorwyn: First Light | 16 | 0 | 0 | Discarded after audit: already canonical; all differences were semantically equivalent |
| Ravenloft: The Horrors Within | 18 | 47 | 0 | Structurally clean; production import waits for constrained background feat choices |

The Forgotten Realms and Lorwyn patches were subsequently audited field-by-field against the canonical JSON. Forgotten Realms contained malformed duplicate spell-list labels, partial class records that would erase core progression, and formatting-only feat changes. Lorwyn's seven differences normalized to identical content. The one useful Forgotten Realms delta—structured Tough mechanics embedded in Flaming Fist Mercenary and Rashemi Wanderer—was preserved directly in the canonical JSON before both redundant bundles were deleted. Ravenloft was minimized from 66 records to 18 genuine additions: one monster, two items, four backgrounds, and eleven real feats. Its 44 unsafe base-spell/class replacements and four fake choice-sentence feats were removed; two parser false positives were corrected. It passes strict schema plus Step 6 guardrails with no replacements, unresolved references, or same-name/different-ID duplicates. Production import remains intentionally blocked because the four backgrounds require a constrained choice between a named feat and Dark Gifts, while the current creator models only an unrestricted Origin feat choice. That representation is deferred to the active Source of Truth work rather than introducing a competing schema in parallel.

The converter treats each folder as a patch against the base XML. Empty `<spell>` records in class files are spell-list membership declarations, not standalone spells; all declarations are resolved against complete spell records before strict validation. Existing canonical records are patched rather than blindly replaced. Ravenloft's four previously ignored feat roll fields now have a typed canonical `mechanics.rolls` representation and regression coverage.

## Work log

- 2026-07-16: Closed the final four no-inference follow-ups. Monster action editing and legendary uses now consume typed attack/economy facts; class level-up ownership uses explicit subclass IDs; generic feature prose parsing and its nine parser modules were deleted; Feat spellcasting-ability choices and feature resources consume canonical fields only. Verification: 13 Classes / 260 levels, 898 classified rules, Drokkan and Alarion fixtures, all three typechecks, 339 passing server tests (21 retired-corpus skips), 136 player tests, and 17 DM tests, with zero failures.

- 2026-07-14: Completed Feat prerequisite slice 1B. Migrated all 216 prerequisite strings to compact typed facts in canonical JSON and the configured database, removed player-side prerequisite prose parsing, wired owned Feat IDs into eligibility, and added native guardrails for prose and unresolved Feat references.
- 2026-07-14: Began the Feat source-of-truth pass. Completed identity/category and choice-link migration across all 277 Feats, using omitted General as the compact default and `O`/`E`/`F` for exceptions; added strict guardrails and migrated the configured database. Prerequisites and effects remain explicitly open.

- 2026-07-13: Cleaned deterministic OCR corruption in the live JSON.
- 2026-07-13: Completed duplicate-ID and duplicate-name audit.
- 2026-07-13: Found no ID collisions. Classified four same-name item pairs as legitimate source variants and lookup hazards.
- 2026-07-14: Began cross-reference validation and repaired 29 deterministic spell-reference defects in the live JSON.
- 2026-07-14: Confirmed feat-choice links, embedded background feats, and class/subclass spell-list labels resolve.
- 2026-07-14: Identified 116 unresolved background-equipment labels requiring explicit item, choice, or currency references.
- 2026-07-14: Bounded the immediate canonical-ID migration to 390 item IDs. Explicitly deferred 327 non-item IDs across monsters, spells, species, backgrounds, and feats.
- 2026-07-14: Completed the item-ID dry run with 390 mappings, zero collisions, and 11 local character references requiring migration.
- 2026-07-14: Completed an in-memory migration dry run for all 337 background-equipment entries with zero unclassified labels; live JSON write remains gated on application support.
- 2026-07-14: Added application support for explicit background item IDs, prior-choice references, and concrete item choices, including save validation and regression coverage.
- 2026-07-14: Migrated the canonical JSON: 390 item IDs and all 337 background-equipment entries. Strict import validation passed for all 3,123 entries.
- 2026-07-14: Applied the item-ID rewrite transaction to the configured local database. The verification rerun found zero remaining changes.
- 2026-07-14: Completed class-progression validation across 13 classes and 260 levels. Repaired two feature-name/ownership defects and one stray Artificer ASI marker in both the canonical JSON and configured local database.
- 2026-07-14: Claude — resolved the application-layer item-modifier/AC bug (see "Resolved" section above) now that the item-ID migration has landed locally. Also fixed a related, previously-undocumented bug in the same code path: the treasure-award endpoint was reading item AC/damage at the wrong JSON nesting level, so DM-awarded armor/weapons always lost their stats. No data migration; existing inventory items self-heal on their next save.
- 2026-07-14: Completed parser-coverage validation across 1,040 rules. Every rule is explicitly classified and every non-manual rule has structured mechanics.
- 2026-07-14: Completed Drokkan and Alarion character-fixture validation with zero remaining issues. Removed the erroneous one-off Great Weapon Master display suffix and restored its canonical `f_great_weapon_master` ID in JSON and the configured database.
- 2026-07-14: Generated strict provisional JSON patches for Forgotten Realms, Lorwyn, and Ravenloft. Eberron was deliberately excluded after confirming it is already part of the canonical WotC bundle.
- 2026-07-14: Completed native import guardrails for unresolved spell/item references, explicit equipment IDs, mechanical vocabulary, spell filters, and corruption markers. Repaired twelve compound-spell fragments across six canonical records; the full 3,123-entry preview now passes.
- 2026-07-14: Finished incoming-book conversion validation. Added typed feat-roll preservation, resolved every spell-list annotation, prevented same-name ID duplication against live, and passed guarded previews for all 235 generated patch entries with zero warnings.
- 2026-07-14: Audited the Forgotten Realms and Lorwyn patches against canonical data and discarded both. Preserved the only useful delta (structured embedded Tough mechanics) in canonical data; rejected partial class replacements, malformed duplicate class labels, and formatting-only churn. Ravenloft remains as the sole import bundle.
- 2026-07-14: Audited Ravenloft field-by-field and reduced it from 66 records to 18 additions. Removed 44 unsafe replacements and four fake choice feats, corrected two false-positive grants, encoded the four background feat choices with their recommended selections, and added guardrails for partial classes, normalized spell-list duplicates, fake catalog feats, and non-ability saving-throw grants.
- 2026-07-14: Documented an application-layer item-modifier/AC consumption bug (not a data defect) found during COMPENDIUM_SOURCE_OF_TRUTH.md discussion. Deferred until the item-ID migration above lands; see "Deferred" section.
- 2026-07-14: Claude — while re-verifying test status after the background-equipment migration landed, found `backgroundEquipment.test.ts` failing against `buildEquipmentItems()` (`CharacterCreatorEquipmentUtils.ts`). Root cause: the new structured `{ kind: "item", itemId, quantity }` consumer correctly calls the pre-existing `pushItem()` helper, which splits weapon quantities into separate quantity-1 rows rather than stacking (e.g. `{ itemId: "i_dagger", quantity: 2 }` produces two Dagger rows, not one at quantity 2). This is not new breakage — it's pre-existing behavior the new test's expectation didn't account for. Confirmed the split is load-bearing: there is no stack-splitting UI anywhere in the inventory panel, so it's the only way starting gear like "2 Daggers" ends up as two independently-equippable items (e.g. for dual-wielding). Decision: keep the split, update the test's expectation to match (two `quantity: 1` Dagger entries). No production code changed. Verified: full `web-player` suite green (27 files / 121 tests).
- 2026-07-14: The user ran the real native import of the cleaned corpus against their local database via the web-dm admin panel, after Claude took a manual backup (`beholden.db` + `-wal`/`-shm`, no automatic backup mechanism exists). Codex reported the import clean: SQLite integrity OK, FK check OK, all 3,123 entries present, zero mismatches, fixtures pass. Claude independently re-verified directly against the database (table counts including spells now match the cleaned corpus exactly, `integrity_check` OK, `r_warforged` present and correct) and confirmed one thing Codex's report didn't mention: the 8 punctuated species IDs from Step 2's deferred table are still unmigrated post-import (the import adds content, it doesn't perform that separate ID cleanup). See Step 7 above for full detail. Codex also surfaced a real, larger gap: 688 of 1,040 rules are `manual` (no structured effects at all, not just correctly-read prose) — confirmed against Warforged, all 9 of its traits are `manual`, so the app cannot yet apply its own Integrated Protection AC bonus or similar deterministic mechanics. This is squarely `COMPENDIUM_SOURCE_OF_TRUTH.md` Phase 1/2 territory and larger in scope than anything closed in this document's history so far — tracked there, not here.
