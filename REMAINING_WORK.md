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

**Fixed 2026-07-23:** the first real import attempt (via the Compendium Import screen) failed the server's guardrails, revealing two pre-existing bugs neither caused by, nor caught by, any of this file's own content validators:

1. The XML→JSON conversion had double-encoded punctuation throughout the canonical JSON — UTF-8 bytes for em dashes, curly quotes, and bullets got decoded as Windows-1252 (e.g. `•` stored as `â€¢`). 1,117 corrupted spots across every category, silently invisible to `validateGrandCompendium.ts`/`validateRuleResolution.ts` because neither checks encoding. Fixed by round-tripping only the corrupted `â€.`/`Ã.` runs through win1252→UTF-8 (validated: zero corruption remains, the file's small number of already-correct special characters were left untouched, spot-checked output reads correctly).
2. `nativeCompendiumGuardrails.ts`'s `checkAutomaticResolutionIsComplete` — the guardrail that actually gates the Compendium Import screen — only recognized `effects`/`scalingRolls`/`preparedSpellProgression` as valid structured-mechanics homes. It didn't know about `choices`, `talent`, class-level sibling fields (`abilityScoreImprovement`, `spellSlots`, `cantripsKnown`, `spellsPrepared`), class-wide `choices` groups sharing a feature's name (e.g. "Fighting Style"), or a cumulative `known` map living on a different feature in the same class (e.g. "Additional Invocation" reminders). This meant **no class-containing bundle could ever have passed this guardrail** — 163 class features across every class failed, none of them actually broken. Same gap existed for species' "Ability Score Increase" header trait (18 species), whose structure lives on the species' own `abilityScoreIncrease`/`choices.abilityScoreChoice`, not the trait. Fixed by teaching the guardrail about all of these homes; verified end-to-end by running the real `importNativeCompendiumDocument` path against an in-memory DB seeded from `dbSchema.ts` — zero remaining guardrail failures other than expected item/spell cross-references (this file doesn't own those categories; they resolve once Items/Spells are already imported, as they are in a real dev DB).

Both fixes are covered by `npm run verify` (full pass) and the existing `nativeCompendium.test.ts` suite (31/31, one assertion's expected message text updated to match the guardrail's more specific wording).

For every content change:

1. Start from the current canonical JSON.
2. Make a targeted edit or use an idempotent JSON-to-JSON migration.
3. Write migrations to temporary output first.
4. Run applicable content validators, the subclass audit when relevant, strict Grand Schema validation, and the full application verification suite.
5. Replace and import the canonical file only after validation passes.

### Audit snapshot

Verified against the canonical JSON on 2026-07-22. Refresh these counts after content passes.

- 13 classes and 1,269 class features: 480 base-class and 789 subclass features.
- Base classes: 183 `automatic`, 23 `mixed`, 274 `manual`.
- Subclasses: 32 `automatic`, 42 `mixed`, 715 `manual`; 74 subclass features contain supported structured mechanics.
- 18 species and 129 mechanical traits: 68 `automatic`, 41 `mixed`, 20 `manual`.
- 161 lore-only or duplicate traits were removed: descriptions, age/alignment, naming and culture prose, and trait-card copies of top-level size/speed facts.
- Fixed species languages are structured for all 18 species. High Elf, Half-Elf, Human, Warforged, Aasimar, Goliath, and Orc expose their authored additional-language choice.
- 18 mixed species traits still contain 56 legacy `source_modifier` records.
- 48 backgrounds, all with structured starting equipment.
- 181 feats: 36 `automatic`, 111 `mixed`, 34 `manual` — every single one individually reviewed and re-verified for gate correctness (not just presence), each `manual` feat carrying a recorded `resolutionNotes` reason. (Count dropped from 247: Planescape: Adventures in the Multiverse was cut from scope and removed, and the user trimmed Bigby Presents: Glory of the Giants down to one entry as near-duplicate reflavors of the same mechanic.)
- 77 class talents: 23 maneuvers and 54 Eldritch Invocations.

### Completed and reviewed inventory

This inventory prevents completed partial slices from returning to the backlog. A category-wide slice is summarized as complete; partial slices retain the individual names that were changed or explicitly reviewed.

#### Classes

Complete across all 13 classes: canonical class metadata, multiclass requirements and grants, spellcasting progression, subclass ownership, class-scoped choices and resources, ASI handling, and multiclass sheet derivation.

Individually structured or runtime-reviewed base features:

- Barbarian: Rage, Unarmored Defense, Primal Knowledge, Fast Movement, Feral Instinct, Brutal Critical (reviewed and manual), and Primal Champion.
- Bard: Spellcasting, Bardic Inspiration, Jack of All Trades, Song of Rest, Expertise, Bardic Versatility, and Font of Inspiration.
- Cleric: Spellcasting, domain Bonus Proficiencies/Bonus Cantrip, Cantrip Versatility, and Divine Strike.
- Druid: Spellcasting, Wild Shape, Cantrip Versatility, and Circle spell grants.
- Fighter: Second Wind, Action Surge, Fighting Style, Martial Versatility, and Battle Master Combat Superiority.
- Monk: Unarmored Defense and Ki.
- Paladin: Spellcasting, Fighting Style, Lay on Hands, Martial Versatility, and oath spell grants.
- Ranger: Favored Enemy and its improvements, Natural Explorer and its improvements, Deft Explorer: Canny, Spellcasting, Fighting Style, Primal Awareness, and Martial Versatility.
- Rogue: Expertise and its improvement, Sneak Attack, Slippery Mind, and Stroke of Luck.
- Sorcerer: Spellcasting, Sorcery Points, Metamagic and its later selections, and Sorcerous Versatility.
- Warlock: Pact Magic, patron Expanded Spell Lists, Eldritch Invocations, Eldritch Versatility, Mystic Arcanum, and Eldritch Master.
- Wizard: Spellcasting, Starting Spellbook, Spellbook Spells, and Cantrip Formulas.
- Artificer: Spellcasting and subclass Tool Proficiencies.

Individually structured subclass features:

- Barbarian: Bear and Eagle (Path of the Totem Warrior), Divine Fury and Zealous Presence (Path of the Zealot), and Mindless Rage (Path of the Berserker).
- Bard: Bonus Proficiencies for the Colleges of Lore, Valor, and Swords.
- Cleric: Soul of the Forge and Saint of Forge and Fire; Divine Strike for the Life, Nature, Tempest, Trickery, War, Death, Forge, Order, and Twilight domains.
- Druid: Bonus Cantrip and Nature's Ward (Circle of the Land), plus Circle Spells for Spores and Wildfire.
- Fighter: Combat Superiority (Battle Master); Bonus Proficiency for Cavalier and Samurai; Bonus Proficiencies for Rune Knight.
- Monk: Bonus Proficiencies (Way of the Drunken Master).
- Paladin: oath spell grants for Devotion, Ancients, Vengeance, Crown, Conquest, Redemption, Glory, and Watchers; Oathbreaker Spells; Aura of Devotion.
- Rogue: Bonus Proficiencies (Assassin), Second-Story Work (Thief), and Rakish Audacity and Master Duelist (Swashbuckler).
- Sorcerer: Heart of the Storm (Storm Sorcery) and Psychic Defenses (Aberrant Mind).
- Warlock: Expanded Spell Lists for Archfey, Fiend, Great Old One, Undying, Celestial, Hexblade, Fathomless, and Undead; Bonus Cantrips and Radiant Soul (Celestial); Hex Warrior and Hexblade's Curse; Gift of the Sea and Oceanic Soul (Fathomless); Beguiling Defenses; and Thought Shield.
- Wizard: Inured to Undeath (School of Necromancy).

The authentic 2014 class-talent slice is complete: all 23 maneuvers and 54 Eldritch Invocations are retained as ruleset-scoped talents. This does not imply that every talent's live-play effect is automated.

#### Species

The following individual traits have structured mechanics or were partially migrated. `Legacy source mechanics` remains mixed and is still backlog:

- Dragonborn: Ability Score Increase, Draconic Ancestry, Breath Weapon, and Legacy source mechanics.
- Hill Dwarf: Ability Score Increase, Darkvision, Dwarven Resilience, Dwarven Combat Training, Tool Proficiency, Dwarven Toughness, and Legacy source mechanics.
- Mountain Dwarf: Ability Score Increase, Darkvision, Dwarven Resilience, Dwarven Combat Training, Tool Proficiency, Dwarven Armor Training, and Legacy source mechanics.
- Drow: Ability Score Increase, Superior Darkvision, Keen Senses, Fey Ancestry, Drow Magic, Drow Weapon Training, and Legacy source mechanics.
- High Elf: Ability Score Increase, Darkvision, Keen Senses, Fey Ancestry, Elf Weapon Training, Cantrip, and Legacy source mechanics.
- Wood Elf: Ability Score Increase, Darkvision, Keen Senses, Fey Ancestry, Elf Weapon Training, and Legacy source mechanics.
- Forest and Rock Gnome: Ability Score Increase, Darkvision, and Legacy source mechanics.
- Half-Elf: Ability Score Increase, Darkvision, Fey Ancestry, Skill Versatility, and Legacy source mechanics.
- Half-Orc: Ability Score Increase, Darkvision, Menacing, Relentless Endurance, and Legacy source mechanics.
- Lightfoot and Stout Halfling: Ability Score Increase, Lucky, Brave, and Legacy source mechanics.
- Human: Ability Score Increase and Legacy source mechanics.
- Tiefling: Ability Score Increase, Darkvision, Hellish Resistance, Infernal Legacy, and Legacy source mechanics.
- Warforged: Ability Score Increase, Constructed Resilience, Sentry's Rest, Integrated Protection, Specialized Design, and Legacy source mechanics.
- Aasimar: Ability Score Increase, Celestial Resistance, Darkvision, Healing Hands, Light Bearer, and Legacy source mechanics.
- Goliath: Ability Score Increase, Little Giant, Mountain Born, Stone's Endurance, and Legacy source mechanics.
- Orc: Ability Score Increase, Darkvision, Relentless Endurance, and Legacy source mechanics.

#### Backgrounds

Complete across all 48 retained backgrounds: each has structured starting equipment. Individual background names are omitted because the entire equipment slice is complete; non-equipment benefits may still require review.

#### Feats

**Complete across all 181 feats.** Every feat was individually reviewed for whether its resolution label is actually true — not just whether a matching schema field exists, but whether a real runtime consumer reads it and the gate correctly scopes it. Every `manual` feat carries a `resolutionNotes` reason recorded in the canonical data itself, not just in this file, so a future audit can trust the data directly. This spans the core Player's Handbook plus Xanathar's Guide to Everything, Tasha's Cauldron of Everything, Fizban's Treasury of Dragons, Van Richten's Guide to Ravenloft, Dragonlance: Shadow of the Dragon Queen, Sword Coast Adventurer's Guide, Eberron: Rising from the Last War / Wayfinder's Guide to Eberron, and The Book of Many Things. Planescape: Adventures in the Multiverse was cut from scope and removed from the bundle by user decision; Bigby Presents: Glory of the Giants was trimmed from 26 entries to 1 (Rune Shaper) by the user, judging the rest as near-duplicate reflavors of the same handful of mechanics (an ability score choice plus a themed reaction/resistance, repeated per giant type).

Automatic: Magic Initiate (Bard, Cleric, Druid, Sorcerer, Warlock, and Wizard), Tough, Resilient (all 6 abilities), Heavily Armored, Lightly Armored (both abilities), Moderately Armored (both abilities), Skill Expert (all 6 abilities), Prodigy (skill/tool/language proficiency choices plus an expertise choice — the last one only discovered working during the correctness re-pass; see below), Wood Elf Magic and Draconic Gift: Psionic Reach and Draconic Gift: Scaled Toughness (each fully self-contained: a chosen cantrip plus fixed free-cast spells, or a flat resistance grant, with nothing left over to leave manual), all Fighting Style feats except Great Weapon Fighting/Protection/Superior Technique (Archery, Defense, Dueling, Two-Weapon Fighting, Blind Fighting, Thrown Weapon Fighting, Unarmed Fighting — reusing this file's own already-verified class-feature effects for the same styles — plus Blessed Warrior and Druidic Warrior).

Mixed feats structure whatever part of the feat has a real, gated runtime consumer and record the rest as manual. Recurring shapes worth knowing rather than every name: an ability-score choice (`grants.abilityIncreases`, same shape as Resilient) is almost always structurable even when the rest of the feat isn't; a fixed spell or cantrip grant with a tracked once-per-rest free cast (`grants.spells`/`grants.cantrips` plus a `uses[].grantsSpell` entry) covers most racial/heritage "innate spellcasting" feats (Drow High Magic, Svirfneblin Magic, Fey/Shadow Touched, Gift of the Chromatic/Metallic Dragon, the Dark Gift and Adept of the ___ Robes families, etc.); a proficiency-bonus, long-rest-recovery use pool (`uses[].countFrom: "proficiency_bonus"`) is trackable even when applying the ability itself isn't (most reaction/bonus-action combat features across Xanathar's racial feats, the Dragonlance Knight orders, and Bigby's giant-heritage feats). **Weapon Master (both abilities)** got a real correction, not just a review: it was previously miscategorized as blocked by "5.5e's weapon-mastery system," but that reasoning belongs to 5.5e's redesigned same-named feat — the 2014 PHB version needed no such system and its ability score increase is now structured.

A large batch were cross-checked against 5.5e's structured equivalent before porting, and roughly as many were found to be false friends and rejected: 5.5e substantially redesigned Crossbow Expert, Defensive Duelist, Great Weapon Master, Sharpshooter, Shield Master, Skulker, Grappler, Mounted Combatant, Spell Sniper, Inspiring Leader, Charger, and Elemental Adept into different mechanics (usually adding an ability-score increase 2014 never had, in exchange for removing or replacing the original benefit) — porting 5.5e's structured shape onto the 2014 feat of the same name would have granted mechanics 2014 doesn't have. Alert's 2014 version keeps its flat +5 initiative bonus rather than 5.5e's proficiency-bonus rescale. Fighting Style: Interception was checked and rejected too: 5.5e marks it `automatic` using the schema's `action` effect type, but that type has zero runtime consumer anywhere in the app — copying it would have been a cosmetic, non-functional label.

Manual feats fall into a few recurring, genuine gaps rather than one-off excuses — knowing the gap saves re-deriving it next time a similar feat comes up:

- **Feats can't grant a talent pick.** Metamagic Adept, Eldritch Adept, Fighting Initiate, and Fighting Style: Superior Technique all need a feat choice that selects from a class talent catalog (Metamagic, Eldritch Invocations, Fighting Styles, maneuvers); the feat schema has no field for it.
- **No school- or alignment-restricted spell choice.** The feat choice schema's spell type has no school filter (only the class-feature choice schema does) and no alignment gate exists at all. Blocks the second spell pick on Fey Touched, Shadow Touched, Adept of the Black/Red/White Robes, and Divinely Favored.
- **No reaction-trigger vocabulary**, for or against another creature. Blocks Defensive Duelist, Fighting Style: Protection/Interception/Great Weapon Fighting (a reroll-and-keep mechanic, a separate gap), and the "apply an effect to whoever just hit/was hit" half of most Xanathar's, Dragonlance Knight-order, and Bigby's giant-heritage feats even where their resource pool is tracked.
- **No vocabulary for effects applied to other creatures** (saves, conditions, pushes, forced rerolls) — Grappler, Dragon Fear, Gift of the Gem Dragon, Frightful Presence, Strike of the Giants, and similar AoE/targeted feats across several sourcebooks.
- **`bonus_damage`'s `frequency` field is declared but has zero runtime consumers.** Adding it would silently misrepresent a once-per-turn ability (Strike of the Giants) as an always-on damage bonus, so it was deliberately left unstructured rather than mis-scoped.
- Fully narrative/random-table/DM-adjudicated content (the Van Richten's Dark Gift complication tables, Draconic Rebirth's full species replacement, Rune Shaper's and Cartomancer's spell-repurposing systems) has no equivalent anywhere in the schema and isn't expected to.

Removed from the canonical 2014 bundle: Strixhaven Initiate and Strixhaven Mascot.

**Correctness re-verification, not just presence.** After the review above, every `automatic`/`mixed` feat's structured effects were audited a second way: by distinct `(type, mode)` shape rather than by name, confirming each shape actually has a runtime consumer and that every `gate.notes` value is either genuinely descriptive-only or matches the exact special-format string a consumer parses. This caught two real bugs and one missed improvement, all now fixed:

- **Medium Armor Master was silently over-applying its +1 AC.** Its `gate.notes` was plain prose ("Medium armor only, and only while Dexterity is 16 or higher") instead of the `medium_armor_dex_cap:16` format `deriveArmorClassBonusFromEffects` actually parses — so the Dex-16 threshold and the medium-armor-only restriction were both silently unenforced, granting +1 AC in **any** armor regardless of Dexterity. Fixed by correcting the notes string to the format the consumer expects.
- **War Caster's Concentration-save advantage was over-scoped.** It was structured as generic advantage on all Constitution saving throws (the only consumer for `modifier`/`advantage` isn't scoped to "only when concentrating"), which would have wrongly granted advantage on unrelated Constitution saves (poison, disease, etc.). Reverted to fully manual with an honest note — there's no concentration-specific save gate to structure it correctly against.
- **Prodigy was under-structured.** Its expertise-in-an-already-proficient-skill clause was marked as an unsupported gap, but Skill Expert already proves `choices[].type: "expertise"` is a real, working feat-choice type. Added the missing choice; Prodigy is now fully `automatic`.

This is the kind of gap presence-checking alone can't catch — "a consumer exists for this effect type" is not the same claim as "this specific gate is scoped correctly." Re-verified via the same real-import-guardrail simulation and full `npm run verify` used throughout this effort.

## 5e automation backlog

### Ruleset isolation

Complete: character creation, level-up, and live-sheet catalog/detail requests are scoped to the character's explicit `5e` or `5.5e` ruleset for classes, species, backgrounds, and feats. Edition-specific name-driven rules are also gated:

- Eldritch Versatility can revisit Mystic Arcanum only for `5e`.
- Epic Boon level-19 filtering applies only to `5.5e`.
- Agonizing Blast targets Eldritch Blast in `5e`; `5.5e` requires its explicit selected cantrip and never falls back by matching names.
- Live extra-feat and Invocation-granted-feat lookups include the character ruleset and clear cached results when it changes.

### 1. Class and live-play gaps

- **Done.** Eldritch Versatility's Mystic Arcanum revisit (levels 12/16/19): `getMysticArcanumRevisitChoices` (`web-player/src/views/level-up/MysticArcanumRevisitUtils.ts`) surfaces every already-unlocked arcanum slot alongside the level's new choices, reusing each slot's original historical choice key so a re-pick overwrites the same record instead of creating a duplicate. A seeding effect in `useLevelUpChoiceSelections.ts` pre-fills each slot with the character's current pick from saved history, so the picker opens with existing spells already selected — leave them alone or pick something else, no separate "which one do you want to replace" step. Unit-tested (4 tests); not yet exercised in a live browser session (no existing level-11+ Warlock test character on hand) — verified by tracing the render/persistence path instead, which is generic over any entry in `classFeatureResolvedSpellChoices`.
- **Done.** Favored Enemy's free-form humanoid-peoples detail: added a `noteTemplate` to the level-1 feature (`nt_ranger_favored_enemy`) with blanks for the 1st/6th/14th-level picks, following the one existing precedent for this (Artificer's "Plans Known"). No new UI — the note-template pipeline already existed and materializes into the player's notes automatically.
- **Resolved by decision, not code.** Cantrip Formulas (Wizard, 3rd level) lets a player swap a known cantrip after every long rest. Rather than build a dedicated long-rest action for this, the user decided the existing "edit character" flow already covers it: `useCreatorEditHydration.ts` hydrates `chosenCantrips` for an existing character through the same picker used at creation, so a Wizard player can just re-open their character in edit mode and change a cantrip whenever they want. No new UI needed.
- Validate representative level 1–20 characters for every class before the live 5e bundle import — not started; this is a full manual QA pass across 13 classes, sized as its own slice rather than something to fold in here.

### 2. Subclass features

Continue converting genuinely mechanical subclass prose into supported effects, choices, resources, rolls, and scaling. Leave table-adjudicated behavior `manual`.

Priority clusters:

- Remaining proficiency-choice variants that require either/or categories.
- Divine Strike and Potent Spellcasting, after safe consumers and gates exist.
- Extra Attack, after the runtime can display or consume attack count.
- Circle of the Land terrain spell tables and Genie patron spell tables, both requiring nested choices.

The six campaign-priority builds have already been audited from levels 1–20. Their remaining manual features are blocked by missing vocabulary or are intentionally table-managed.

### 3. Species traits

Review the remaining 20 manual mechanical traits. Lore-only traits have been removed from the canonical bundle rather than retained as backlog.

Mechanical priorities:

- The 56 legacy `source_modifier` records in mixed traits.

Completed: Half-Orc and Orc Relentless Endurance now track a one-use, Long-Rest resource. Detecting the reduction to 0 hit points and applying the 1-hit-point floor remain manual.

Reviewed and intentionally manual: Gnome Cunning (advantage on Intelligence, Wisdom, and Charisma saves against magic has no supported saving-throw-advantage gate) and Drow Sunlight Sensitivity (disadvantage depends on whether the attacker, target, or perceived subject is in direct sunlight, which has no environmental-state gate).

Completed: Dragonborn Breath Weapon now requires and persists a Draconic Ancestry choice, activates the selected ancestry's resistance, displays its 2d6/3d6/4d6/5d6 progression, and tracks one use per Short or Long Rest. Save and damage resolution remain manual.

Completed: Healing Hands displays its proficiency-bonus d4 progression and tracks one use per Long Rest. Stone's Endurance displays its damage-reduction formula and tracks proficiency-bonus uses per Long Rest. Targeting, reactions, rolls, healing, and damage reduction remain manual.

Completed: all fixed species languages are automatic and additional-language choices use the creator's species choice flow. Humanoid Creature Type cards were removed because Humanoid is the schema default, the redundant Dragonborn Damage Resistance card was removed because Draconic Ancestry owns that fact, and High Elf's separate Extra Language card was folded into its canonical species choice.

Completed: Keen Senses grants Perception proficiency to all three Elf variants; Mountain Dwarf receives Light and Medium Armor proficiency; Hill Dwarf gains 1 maximum HP per character level; Dwarven Resilience and Stout Resilience apply Poison resistance while leaving poison-save advantage manual. Fleet of Foot was removed because Wood Elf's canonical top-level speed is already 35 feet.

### 4. Feats

**Done.** Every feat in the canonical bundle has been individually reviewed — see the Feats subsection under "Completed and reviewed inventory" above for the full breakdown, the recurring structurable shapes, and the recurring genuine gaps. Nothing here is backlog anymore; new gaps only resurface if new feats are added to the bundle or new runtime vocabulary changes what's possible.

Completed in this and the prior audit:

- Dual Wielder now enforces Light off-hand weapons by default, permits non-Light one-handed melee weapons for feat holders, and applies its equipment-gated +1 AC.
- Metamagic Adept tracks its two long-rest, Metamagic-only sorcery points.
- Savage Attacker and Mage Slayer are intentionally manual because the app does not resolve their rolls, reactions, proximity, or concentration triggers.
- Crossbow Expert, Sharpshooter, Great Weapon Master, Polearm Master, Sentinel, Shield Master, Charger, Mounted Combatant, and Dungeon Delver were audited and remain intentionally manual; their mechanics depend on table-resolved attacks, positioning, targets, movement, or reactions.
- Strixhaven Initiate and Strixhaven Mascot were removed from the canonical 2014 compendium.

Remaining feat-specific blocker (unchanged, now also confirmed to affect Eldritch Adept, Fighting Initiate, and Fighting Style: Superior Technique the same way):

- Metamagic Adept and kin cannot yet present a choice of class talents (Metamagic options, Eldritch Invocations, Fighting Styles, maneuvers) because feat choices cannot select from a talent catalog. Resource pools work where present; talent selection remains manual.

## Missing runtime vocabulary

Do not mark a feature automatic merely because its data shape exists. Confirm that a runtime consumer exists and that its gate accurately scopes the effect.

Known gaps include:

- Extra Attack count.
- Critical-hit triggers and expanded critical-hit ranges. Anything activated by a critical hit is manual because Beholden does not resolve attack rolls; this includes Half-Orc Savage Attacks and Barbarian Brutal Critical.
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
- School- or alignment-restricted spell choices (the feat choice schema's spell type has no school filter, only the class-feature choice schema does; no alignment gate exists at all).
- A spell choice pool that depends on an earlier pick in the same choice set (e.g. "pick a moon, then pick 2 of that moon's 4 spells") — no verified working consumer for a dependent-choice-pool shape.
- A spellcasting ability inherited from a different, already-chosen feat's choice (cross-feat dependency).
- Reroll-and-keep-new-result damage mechanics (distinct from the flat bonuses and rerolled-attack-roll vocabulary that already exist).
- Advantage tied to a specific skill check (distinct from `check_override`, which swaps which ability governs a check, not whether it has advantage) — also covers `escape_check_advantage`/`save_advantage`, which are declared in the schema but have zero runtime consumers.
- A gate scoped to one specific named weapon (the existing weapon gates cover generic tags like melee/light/martial, not "a double-bladed scimitar specifically").
- `bonus_damage`'s `frequency` field (`once_per_turn` etc.) is declared in the schema but has zero runtime consumers — do not use it to express a limited-use damage bonus; it will render as always-on.
- "On item use" triggers (e.g. spending a healer's kit charge) and mid-game species/form replacement.
- A `modifier`/`advantage` or `/disadvantage` effect on `saving_throw`/`ability_check` is global to that ability across the whole character — there is no way to scope it to a narrower trigger context (e.g. "only Constitution saves to maintain Concentration"). `gate.notes` prose describing the narrower trigger is not read by the consumer; do not structure an effect this way believing the notes will limit it (this is exactly how War Caster was previously over-scoped — see the Feats correctness re-pass above).

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
