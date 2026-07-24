# Remaining Work

This file tracks current work only. Completed implementation history belongs in Git.

## Current status

- Multiclassing is complete across persistence, prerequisites, progression, spellcasting, level-up, character-sheet presentation, export/import, rests, and regression coverage.
- World Actions and player-facing Engaged Enemies are complete.
- Compendium bundle import remains the supported workflow; users must not be required to import one category at a time.
- The 2014 XML migration is complete for classes/species/backgrounds/feats/class talents. **The 2014 core spell catalog is not migrated — see "Missing 2014 core spell catalog" below, a severe, actively-blocking gap discovered 2026-07-23.** All future 5e work advances the canonical JSON.

## Canonical 5e data

`compendium/WotC_5e_only.json` is the canonical 2014 rules bundle and is intentionally gitignored. The server does not read it directly at runtime; it is imported through the Compendium Import screen.

`compendium/WotC_5e_only.xml` was a one-time migration input. Never regenerate or overwrite the canonical JSON from the XML, raw conversion output, an intermediate migration stage, or a failed validation result.

**Fixed 2026-07-23:** the first real import attempt (via the Compendium Import screen) failed the server's guardrails, revealing two pre-existing bugs neither caused by, nor caught by, any of this file's own content validators:

1. The XML→JSON conversion had double-encoded punctuation throughout the canonical JSON — UTF-8 bytes for em dashes, curly quotes, and bullets got decoded as Windows-1252 (e.g. `•` stored as `â€¢`). 1,117 corrupted spots across every category, silently invisible to `validateGrandCompendium.ts`/`validateRuleResolution.ts` because neither checks encoding. Fixed by round-tripping only the corrupted `â€.`/`Ã.` runs through win1252→UTF-8 (validated: zero corruption remains, the file's small number of already-correct special characters were left untouched, spot-checked output reads correctly).
2. `nativeCompendiumGuardrails.ts`'s `checkAutomaticResolutionIsComplete` — the guardrail that actually gates the Compendium Import screen — only recognized `effects`/`scalingRolls`/`preparedSpellProgression` as valid structured-mechanics homes. It didn't know about `choices`, `talent`, class-level sibling fields (`abilityScoreImprovement`, `spellSlots`, `cantripsKnown`, `spellsPrepared`), class-wide `choices` groups sharing a feature's name (e.g. "Fighting Style"), or a cumulative `known` map living on a different feature in the same class (e.g. "Additional Invocation" reminders). This meant **no class-containing bundle could ever have passed this guardrail** — 163 class features across every class failed, none of them actually broken. Same gap existed for species' "Ability Score Increase" header trait (18 species), whose structure lives on the species' own `abilityScoreIncrease`/`choices.abilityScoreChoice`, not the trait. Fixed by teaching the guardrail about all of these homes; verified end-to-end by running the real `importNativeCompendiumDocument` path against an in-memory DB seeded from `dbSchema.ts` — zero remaining guardrail failures other than expected item/spell cross-references (this file doesn't own those categories; they resolve once Items/Spells are already imported, as they are in a real dev DB).

Both fixes are covered by `npm run verify` (full pass) and the existing `nativeCompendium.test.ts` suite (31/31, one assertion's expected message text updated to match the guardrail's more specific wording).

### Missing 2014 core spell catalog (found 2026-07-23, converted — pending final promotion)

**`compendium/WotC_5e_Spell.json` is not the 2014 core spell compendium — it's a 145-entry supplemental-only file** (Xanathar's/Tasha's/Fizban's-era additions like "Abi-Dalzim's Horrid Wilting"). There is no core 2014 Player's Handbook spell list (Fireball, Detect Magic, Cure Wounds, Mage Hand, etc. — the ~300+ baseline spells) anywhere in this repo. Confirmed by recursively searching every JSON file under `compendium/` for "Fireball"/"Magic Missile" as real catalog entries (not prose mentions) — none exists. This is a known, standing gap, not an oversight to silently fix — the user hasn't imported/authored it yet, reasoning the 2014 and 2024 core spells are probably similar enough to eventually reuse.

**Merging in `WotC_2024_only.json`'s 412-entry spell catalog does not work as a stopgap.** Its spells' `access` arrays reference subclass-scoped spell-list ids (`sl_cleric_life_domain`, `sl_druid_circle_of_the_land_tropical`, `sl_paladin_oath_of_devotion`, `sl_sorcerer_draconic_sorcery`, etc.) that only 2024 classes register — 2024 bakes subclass spell-list ids into the class-level `spellLists` map, while 2014 classes register subclass spell access a structurally different way (via `subclasses.options[id].spellcasting.list`, not the class-root `spellLists` map). Importing 2024's spells alongside 2014's classes throws dozens of new "unknown spell-list id" guardrail errors instead of resolving anything.

**Concretely, how few spells the 2014 bundle currently has to offer** (counted directly from `WotC_5e_Spell.json`, i.e. what a real 2014 character build is limited to today):

| Class | Cantrips available | Level-1 spells available |
|---|---|---|
| Cleric | 0 | 1 |
| Bard | 0 | 3 |
| Paladin | — (no cantrips in 5e) | 1 |
| Ranger | — (no cantrips in 5e) | 4 |
| Artificer | 7 | 4 |
| Druid | 9 | 4 |
| Warlock | 8 | 2 |
| Wizard | 11 | 10 |
| Sorcerer | 11 | 7 |

A 2014 Cleric currently has **zero** cantrips to choose from and only one level-1 spell. This isn't a minor completeness gap — most spellcasting classes cannot actually be built as functioning characters against the current 2014 bundle. Every downstream claim in this file about classes/subclasses/feats being "fully reviewed" is about *resolution correctness of the mechanics that exist*, not about there being enough underlying spell data for those mechanics to draw from — those are independent axes, and this gap is entirely on the data-completeness axis.

**Found while building the level 1–20 class-progression simulator** (see "1. Class and live-play gaps" below) — the simulator work is paused pending final promotion of the fix below, since it would otherwise just report every spellcasting class as failing on spell-choice-pool checks.

**A real, unrelated bug found and fixed along the way, independent of the above:** Artificer's class doc never registered `sl_artificer_battle_smith` in its `spellLists` map, even though the Battle Smith subclass's expanded spells (Branding Smite, etc.) reference it. This is why every guardrail simulation throughout this entire session's work showed the exact same single "Branding Smite... unknown spell-list id" error regardless of what was actually being changed — it wasn't cosmetic, it was masking whatever came after it in the import order (which is how the much bigger gap above stayed hidden until now). Fixed by registering `"sl_artificer_battle_smith": "Artificer (Battle Smith)"` on the class; verified via schema validation, scoped diff (exactly one field changed), and `npm run verify` (full pass).

**Resolved 2026-07-23: the user located the actual source.** `C:\Users\cellu\Downloads\WotC_5e_only(1).xml` (20MB — much larger than the repo's own `compendium/WotC_5e_only.xml`, 2.7MB) contains the full 2014 spell list; it was simply never carried through the original XML→JSON migration the way classes/species/backgrounds/feats/class talents were. Converted via a new script, `server/convertLegacySpellsXml.mts`, into `compendium/legacy_spells.json` (509 real spells, Grand Schema `SpellSchema`-shaped, `ruleset: "5e"`):

- Filtered out 134 same-tag-shaped non-spell entries (Invocations, Elemental Disciplines, Maneuvers, Metamagic, Arcane Shot options, Infusions, Runes — all already covered elsewhere as class talents).
- Parsed `<school>` abbreviations, `<time>`/`<range>`/`<components>`/`<duration>` into the `casting` object, `<ritual>YES</ritual>` into `ritual: true`, and `<roll description="..." level="...">` entries into `rolls[]` (inferring `effect` from the description text against the schema's fixed damage-type enum where it matches a known keyword).
- `access` (spell-list ids) built only from bare, non-parenthetical class names in the messy `<classes>` field (e.g. "Cleric" but not "Cleric (Light Domain)" or "School: Evocation" or "Ritual Caster" or Eberron "Mark of X" dragonmark labels) — subclass-specific spell access is handled elsewhere via `preparedSpellProgression` on the subclass feature itself, not via spell `access`, matching how the rest of this session's subclass work already structured it.
- Fixed one real data-quality bug found in the source during conversion: healing/damage-scaling `<roll>` formulas (Cure Wounds, Healing Word, Spiritual Weapon, Eldritch Blast, etc.) had an unsubstituted `%0` template placeholder where the spellcasting-ability modifier belongs — replaced with the `SPELL` keyword, the convention already used elsewhere (confirmed against `WotC_2024_only.json`'s Cure Wounds).
- One spell ("Encode Thoughts") has no class access at all — a genuine gap in the source XML itself (`<classes>` only contains "School: Enchantment", no actual class), not a conversion bug; left as-is.

**Verified end-to-end**, not just schema-valid: a full simulated import (items → classes-preseed → `legacy_spells.json` → `WotC_5e_Spell.json` → the real `WotC_5e_only.json`) passes the guardrail cleanly, landing 526 total spells in the DB (509 new + 17 that are unique to the old 145-entry supplemental file; the other 128 of those 145 overlap with the new conversion). Spell-pool sizes that were the smoking gun for this whole investigation are fixed accordingly: Cleric cantrips 0→9, Cleric level-1 spells 1→16; Bard cantrips 0→12, level-1 spells 3→26; Wizard cantrips 11→30, level-1 spells 10→41.

**Not yet done:** `legacy_spells.json` is a validated, verified-importable standalone file, but it hasn't been promoted/merged into the canonical import instructions yet, and its relationship to `WotC_5e_Spell.json` (supersede it? import both? merge the 17 unique entries in and retire the old file?) hasn't been decided. The level 1–20 simulator (`server/src/scripts/simulateClassProgression.ts`) is ready to run for real once that's settled.

For every content change:

1. Start from the current canonical JSON.
2. Make a targeted edit or use an idempotent JSON-to-JSON migration.
3. Write migrations to temporary output first.
4. Run applicable content validators, the subclass audit when relevant, strict Grand Schema validation, and the full application verification suite.
5. Replace and import the canonical file only after validation passes.

### Audit snapshot

Verified against the canonical JSON on 2026-07-23. Refresh these counts after content passes.

- 13 classes and 1,269 class features: 480 base-class and 789 subclass features — **every single one individually reviewed**, 0 unreviewed, every `manual` feature carrying a recorded `resolutionNotes` reason.
- Base classes: 192 `automatic`, 36 `mixed`, 252 `manual`.
- Subclasses: 80 `automatic`, 76 `mixed`, 633 `manual`.
- 18 species and 111 mechanical traits (down from 129 after removing 18 fully-redundant "Legacy source mechanics" traits) — **every single one individually reviewed**: 67 `automatic`, 21 `mixed`, 23 `manual`.
- 161 lore-only or duplicate traits were removed: descriptions, age/alignment, naming and culture prose, and trait-card copies of top-level size/speed facts.
- Fixed species languages are structured for all 18 species. High Elf, Half-Elf, Human, Warforged, Aasimar, Goliath, and Orc expose their authored additional-language choice.
- 48 backgrounds, all with structured starting equipment, and 135 mechanical traits — **every single one individually reviewed**, all `manual` by design (narrative/social content), every one carrying a recorded `resolutionNotes` reason.
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

**Done (2026-07-23): every mechanical trait across all 48 backgrounds individually reviewed**, on top of the already-complete structured starting equipment. Started from 135 background traits, all `manual`, none carrying a `resolutionNotes` reason. All 135 now carry a reason; 0 remain structurable with a real gated consumer, so the count stays at 0 `automatic`/`mixed` — 5e background traits are narrative/social by design, not a gap in coverage.

Two recurring shapes cover the great majority: every background has a "Suggested Characteristics" trait (personality/ideal/bond/flaw roll tables) plus assorted extra flavor tables in some sourcebook backgrounds (trinkets, NPC-name flavor, regional lore, backstory prompts) — pure narrative, no mechanical content by design. And every background has one real "Feature" — free lodging, an NPC contact, local reputation, or conditional access to information/places — which 5e deliberately leaves as a DM-adjudicated social benefit rather than a numeric one; four backgrounds (Fisher, Marine, Shipwright, Smuggler) have an equivalent "Saltmarsh Ties" contact feature under a different name, reviewed the same way.

Four outliers turned up a genuine, newly-documented gap: Rune Carver's Rune Shaper and Gate Warden's Planar Infusion each grant one specific named feat outright, and Rewarded's Fortune's Favor and Ruined's Still Standing each offer a choice among 2-3 specific named feats — none structurable, because the schema's `feat_choice` effect only supports picking from a broad category (origin/general/fighting_style/epic_boon), not a fixed feat or a short list of named options. Fisher's Harvest the Water (advantage on fishing-tackle checks) hits the already-documented "advantage tied to a specific tool check" gap.

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

**Done, 2026-07-23 — live-sheet combat-math audit.** A player bug report ("is 5e bleeding into 5.5e?") led to auditing `CharacterCombatPanels.tsx` and its collaborators for edition branching. Found and fixed:
- **Weapon Mastery leaking onto 5e characters.** `hasWeaponMastery()` had no ruleset check at all — it showed 2024-only mastery badges on `5e` characters too, because 5e items can be the *same shared item record* as their 5.5e equivalent (items aren't re-imported if a 5.5e equivalent already exists), carrying a `mastery` value baked in. Now gated: `ruleset === "5e"` always returns `false`.
- **Weapon Mastery shown on every proficient weapon, not just chosen ones.** Separately, even on `5.5e` characters, mastery was shown for *any* weapon matching the character's weapon proficiency (including broad category grants like "Martial Weapons"), not just the specific weapons a player spent their Weapon Mastery choice on. Root cause: `chosenWeaponMasteries` was captured at creation/level-up and saved, but only ever read back by the creator's edit-hydration path — never plumbed into the live character sheet. Added `weaponMasteries: string[]` to `ProficiencyMap`, populated from `chosenWeaponMasteries` in `buildProficiencyMap`, with a read-time fallback to the character's raw `chosenWeaponMasteries` field for characters saved before this field existed. `hasWeaponMastery()` now matches the item's name against this list exactly, instead of blanket proficiency.
- **Exhaustion using the 2024 flat-penalty formula on 5e characters.** `CharacterExhaustion.ts` only implemented 2024 rules (flat −2 per level to all d20 tests, −5 ft speed per level). 2014 exhaustion is qualitatively different — tiered, and mostly *disadvantage* rather than a numeric penalty: tier 1 disadvantage on ability checks, tier 2 speed halved, tier 3 disadvantage on attack rolls and saves, tier 4 HP max halved, tier 5 speed to 0, tier 6 death. Rewrote the module to take a `ruleset` param throughout; 2014 now applies disadvantage (wired into the existing `abilityCheckDisadvantages`/`saveDisadvantages`/`skillDisadvantages` maps and the combat panel's existing attack-disadvantage flag) instead of a numeric penalty, speed is halved/zeroed by tier instead of flat −5 ft/level, and hit point maximum is halved at tier 4+ (`getExhaustionHpMaxMultiplier`, applied in `effectiveHpMax`/`effectiveHpMaxWithoutOverrides`). The HP-max halving turned out to be safe to wire up fully: `useCharacterSyncEffects.ts` already reactively pushes `effectiveHpMax` to the server (`syncedHpMax`) on every change, which is what keeps the DM's live combat tracker in sync — no cross-system gap.
- **Weapon Mastery picker offering weapons you're not proficient with.** The character-creator's Weapon Mastery picker offered all 38 masterable weapon kinds regardless of the class's actual weapon proficiency (e.g. a Rogue, who can only master Simple weapons plus Finesse-or-Light Martial weapons, could still pick Greataxe or Longsword). Added `getEligibleWeaponMasteryKinds()` (`CharacterCreatorConstants.ts`) — a small static Martial/Light/Finesse table per weapon (verified directly against the compendium's own item records) that filters the picker's options against the class's `proficiencies.weapons` text. Verified live: Rogue now offers exactly the 21 eligible weapons instead of all 38. **Scoped out, not fixed:** this only considers the class's own proficiency text, not additional proficiencies from race/feats (e.g. the "Martial Weapon Training" origin feat) — a narrow edge case. Also found but not fixed: the `Weapon Master` feat (a separate ASI-replacement mechanic, not the class-level choice) has the identical unfiltered-by-proficiency bug, sourced from its own hardcoded `options` array in the compendium record rather than `WEAPON_MASTERY_KINDS`; fixing it touches `getFeatChoiceOptions()` and its five call sites across the creator, level-up, and live invocation-granted-feat-choice flows, which wasn't in scope of this pass. And separately: the level-up flow still never prompts for additional Weapon Mastery choices at all (only character creation does), so a class that gains more mastery slots at higher levels can't fill them in-app.
- Also fixed, same audit: combatants dropping to 0 HP kept every condition (Frightened, Invisible, Charmed, etc.) instead of clearing the ones that stop making sense while Down. `applyConditionConsequences` (`server/src/services/combatTransitions.ts`) now clears everything except a small persistent allowlist (Unconscious, Prone, Poisoned, Restrained, Petrified) once `hpCurrent <= 0`. The Engaged Enemies drawer (player-facing) also now shows each enemy's active conditions and visually greys out/strikes through Down enemies, matching the DM-side presentation.
- Also fixed, separate player-reported bugs: the character list on the player home page had no ruleset indicator (added a `5e`/`5.5e` pill to each character card); and the campaign card's "+Assign" button just linked to character creation instead of letting you assign an *existing* character to the campaign (replaced with an inline picker of the player's not-yet-assigned characters, wired to the pre-existing but previously-unused `POST /api/me/characters/:id/assign` endpoint).

### 1. Class and live-play gaps

- **Done.** Eldritch Versatility's Mystic Arcanum revisit (levels 12/16/19): `getMysticArcanumRevisitChoices` (`web-player/src/views/level-up/MysticArcanumRevisitUtils.ts`) surfaces every already-unlocked arcanum slot alongside the level's new choices, reusing each slot's original historical choice key so a re-pick overwrites the same record instead of creating a duplicate. A seeding effect in `useLevelUpChoiceSelections.ts` pre-fills each slot with the character's current pick from saved history, so the picker opens with existing spells already selected — leave them alone or pick something else, no separate "which one do you want to replace" step. Unit-tested (4 tests); not yet exercised in a live browser session (no existing level-11+ Warlock test character on hand) — verified by tracing the render/persistence path instead, which is generic over any entry in `classFeatureResolvedSpellChoices`.
- **Done.** Favored Enemy's free-form humanoid-peoples detail: added a `noteTemplate` to the level-1 feature (`nt_ranger_favored_enemy`) with blanks for the 1st/6th/14th-level picks, following the one existing precedent for this (Artificer's "Plans Known"). No new UI — the note-template pipeline already existed and materializes into the player's notes automatically.
- **Resolved by decision, not code.** Cantrip Formulas (Wizard, 3rd level) lets a player swap a known cantrip after every long rest. Rather than build a dedicated long-rest action for this, the user decided the existing "edit character" flow already covers it: `useCreatorEditHydration.ts` hydrates `chosenCantrips` for an existing character through the same picker used at creation, so a Wizard player can just re-open their character in edit mode and change a cantrip whenever they want. No new UI needed.
- **In progress, paused 2026-07-23.** Validate representative level 1–20 characters for every class before the live 5e bundle import. Built `server/src/scripts/simulateClassProgression.ts` — a standalone simulator (no browser/React dependency; operates directly on the canonical Grand compendium schema via the same in-memory-DB pattern used throughout this session's migrations) that builds one representative character per class and auto-resolves every choice it hits while stepping level 1→20, checking that every choice has enough valid candidates, every spell/feature reference resolves, subclasses get assigned on schedule, and resource tables are sane. It typechecks and is ready to run, but running it now would just report every spellcasting class failing on spell-choice-pool checks because of the "Missing 2014 core spell catalog" gap above — not a useful QA signal until that's resolved. Resume by running `npx tsx src/scripts/simulateClassProgression.ts` from `server/` once real 2014 spell data exists.

### 1b. Base class features

**Done (2026-07-23): the same feat/subclass-style review, applied to every base class feature in the game.** Started from 480 base-class features (183 `automatic`, 23 `mixed`, 274 `manual`, none carrying a `resolutionNotes` reason). All 480 now carry a resolution and, for every `manual` feature, a `resolutionNotes` reason — 0 unreviewed. Final: 192 `automatic`, 36 `mixed`, 252 `manual`.

This pass caught four real correctness bugs in already-promoted "automatic"/"mixed" data, all fixed:

- **`attack_advantage`/`attack_disadvantage` (defense effect modes) have zero runtime consumer anywhere in the app** — declared in the schema, never checked before now because nothing in the canonical data actually used them (Barbarian's Reckless Attack, which would be the obvious candidate, was correctly manual already). Added to "Missing runtime vocabulary" so nobody structures a feature on them expecting them to work.
- **`class_level`/`half_class_level` (ScalingValue kinds) are declared in the type but have zero implementation in `resolveScalingValueInContext`** — only `fixed`, `ability_mod`, `proficiency_bonus`, `character_level`, and `half_character_level` are actually resolved. Discovered while checking whether Paladin's Lay on Hands pool (paladin level × 5) could be structured with a `class_level` scalar; it can't yet. Also newly documented.
- **Druid's Wild Shape and Monk's Ki were mislabeled `manual`** even though their resource pools are genuinely tracked via the class level's own `resources` table (the same real mechanism as Bardic Inspiration/Sorcery Points/Channel Divinity) — the `resolutionNotes` on Wild Shape already said as much, the `resolution` field just hadn't been updated to match. Both relabeled to `mixed`. The same relabeling was applied to Cleric's and Paladin's base Channel Divinity and Sorcerer's Font of Magic, all of which were plain `manual` despite their pools being tracked identically.

New structuring, beyond the relabels above: Druidic and Thieves' Cant are now automatic fixed-language grants (Druidic and Thieves' Cant are both valid language names already recognized by the proficiency system). Bard's Magical Secrets (10th/14th/18th) and Warlock's Pact of the Tome are automatic via a spell choice unioned across every class's spell list (`lists: [sl_artificer, sl_bard, sl_cleric, sl_druid, sl_paladin, sl_ranger, sl_sorcerer, sl_warlock, sl_wizard]`), the same shape already verified for Cleric's Reaper feat. Ranger's Deft Explorer: Roving is automatic via the `speed` effect type's `bonus` and `grant_mode`/`named_progression` modes (a walking-speed bonus plus climbing/swimming speed equal to walking speed) — a shape that turned out to already exist and work but had never been used on a base class feature before. Fighter's three L10 "Fighting Style: X" cards that duplicate an already-verified Fighting Style (Blind Fighting, Thrown Weapon Fighting, Unarmed Fighting) now reuse those exact effects. Monk's Diamond Soul (proficiency in all six saving throws) reuses the `proficiency_grant`/`saving_throw` shape already verified for Rogue's Slippery Mind. Monk's Purity of Body structures the poisoned-condition-immunity half (disease immunity has no supported vocabulary — "Disease" isn't a recognized condition name). Ranger's Deft Explorer: Tireless and Nature's Veil, Fighter's Action Surge and Indomitable, and Paladin's Lay on Hands all get their resource pools tracked via `resource_grant`, leaving only the actual applied behavior manual.

A large recurring category across every class: **redundant restatement cards.** Several progressions (Bardic Inspiration's die size, Rogue's Sneak Attack damage, Fighter's Indomitable/Action Surge use counts, Monk's Unarmored Movement speed bonus, Cleric's/Paladin's Channel Divinity use counts, Sorcerer's 30 "Metamagic: X" cards at 3rd/10th/17th level) are fully captured once — either in a `scalingRolls` table on the level-1/base feature, or in the class level's own `resources` table — and every later-level card that just restates the next step of that same progression has zero independent content. All marked manual with a note pointing at the feature or table that actually owns the data, rather than left silently unreviewed.

Recurring genuine gaps confirmed (not new, but now backed by base-class examples too): reroll-and-keep mechanics (Great Weapon Fighting, Indomitable's failed-save reroll, Diamond Soul's failed-save reroll); the third-party-attack-trigger gap (Protection); companions/familiars not modeled (Pact of the Chain, Wild Companion, Infuse Item's crafted items); "choose one of the following, each a differently-shaped effect bundle" (Pact Boon, Hunter's-Prey-style headers); healing-grant and temporary-HP-grant effect types still missing (Lay on Hands, Quickened Healing, Deft Explorer: Tireless); resource-slot recovery under a budget constraint (Arcane Recovery, Harness Divine Power, Natural Recovery, Font of Magic's Flexible Casting); attunement-slot tracking and the item-crafting economy not modeled (Artificer's Magic Item Adept/Savant/Master); and buff/debuff auras affecting nearby allies not modeled (Aura of Protection, Aura of Courage, Emboldening Bond).

### 2. Subclass features

**Done (2026-07-23): the same feat-style review, applied to every subclass feature in the game.** Started from 789 subclass features (32 `automatic`, 42 `mixed`, 715 `manual`, none carrying a `resolutionNotes` reason). Reviewed class by class with the same discipline as the Feats sweep: only structure an effect where a real, gated runtime consumer exists; record every `manual` decision with a reason in the data itself. All 789 features across all 13 classes now carry a resolution and a `resolutionNotes` reason — 0 unreviewed.

Final tally by class (features reviewed / total): Artificer 30/30, Bard 45/45, Druid 51/51, Sorcerer 51/51, Rogue 59/59, Warlock 58/58, Barbarian 64/64, Wizard 68/68, Paladin 71/71, Fighter 77/77, Monk 56/56, Ranger 63/63, Cleric 96/96.

Fighter, Monk, Ranger, and Cleric batches (the last four) each turned up a handful of additional clean structurable wins beyond the earlier classes:

- Fighter: Champion's 4 non-Great-Weapon-Fighting/Protection Additional Fighting Style sub-options reuse the identical, already-verified base Fighting Style effects; Student of War's artisan-tool choice, Arcane Archer Lore's skill choice, and Guarded Mind's psychic resistance are structured.
- Monk: Implements of Mercy's skill+tool grant is fully automatic; Shadow Arts' fixed cantrip, Path of the Kensei's Way of the Brush tool choice, Draconic Disciple's language choice, and Ascendant Aspect's flat blindsight grant are structured.
- Ranger: Draconic Gift (Drakewarden) is fully automatic (fixed cantrip + language choice); Otherworldly Glamour's skill choice is structured.
- Cleric: Acolyte of Nature, Arcane Initiate, Implement of Peace, Avatar of Battle, and Arcane Mastery are all fully automatic; Blessings of Knowledge's language/skill choices, Reaper's school-filtered cantrip choice (using the class-feature spell choice's `school` filter — a real, previously-unused-but-wired consumer, confirmed via `SpellChoiceUtils`' `&school=` query param), Circle of Mortality's cantrip grant, and Eyes of Night's flat darkvision grant are all structured.

- **Circle of the Land terrain spell tables (8) and Genie's patron-neutral expanded spells are done** — the two items this section used to flag as blocked on "nested choices" turned out not to need any: each Circle of the Land terrain is already its own catalog row (no in-game choice left to structure), and Genie's kind-specific columns are correctly left manual pending a genie-kind choice, but its kind-neutral column doesn't depend on one.
- Also done via the same `preparedSpellProgression` shape: all 14 Cleric Divine Domains, 5 Ranger conclave-magic tables, 3 Sorcerer bonus-spell subclasses (Aberrant Mind, Clockwork Soul, Lunar Magic), Warlock Grasping Tentacles/Among the Dead, Barbarian Spirit Seeker/Spirit Walker (both ritual-only grants — the ritual-only nuance itself isn't modeled).
- Artificer: all 4 "X Spells" tables, plus a missed Tools of the Trade proficiency grant (Armorer) now matches its three sibling subclasses.
- Bard: College of Swords' two Fighting Style sub-options reuse the identical, already-verified Fighter effects; Guiding Whispers' fixed cantrip is structured.
- Druid: Fungal Body's four condition immunities are structured (same shape as Mindless Rage/Nature's Ward).
- Sorcerer: Draconic Resilience (HP-per-level plus the Dragon Hide-style unarmored AC formula) is now fully automatic; Dragon Ancestor's and Wind Speaker's language grants, and Eyes of the Dark's darkvision plus spell grant, are structured.
- Rogue: Superior Mobility's flat speed bonus and Master of Intrigue's proficiency/language choices are structured.
- Warlock: Necrotic Husk's flat necrotic resistance is structured.
- Barbarian: Path of the Totem Warrior's Elk (rage + not-heavy-armor gated speed bonus) and Eagle (rage-gated flying speed) are now fully automatic; Aspect of the Tiger's 2-of-4 skill choice is fully automatic.
- Every pure-flavor subclass header (no mechanical content at all) across all seven classes is now marked manual with an explicit "flavor only" reason instead of being silently unreviewed.

Recurring gaps found across the whole sweep and documented below in "Missing runtime vocabulary": no vocabulary for "attacks count as magical" (Druid Primal Strike, Monk Ki-Empowered Strikes, Barbarian Bestial Soul, Fighter One with the Blade — all already manual, confirmed genuinely blocked, not just unreviewed); no vocabulary for gating an effect on another *already-manual* feature's active state; no vocabulary for branching on a specific roll outcome (rolling max on a die, a save succeeding vs. failing, overriding a save's damage outcome) to trigger a follow-on effect; no per-feature resource/use-pool field on class features at all (unlike feats) — class-scoped resources only exist at `ClassLevelSchema.resources`, a flat numeric count with no proficiency-bonus-scaling formula or link to a granted spell/choice; no supported healing-grant or temporary-hit-points-grant effect type at all (recurring across nearly every class — Cleric domains especially); no raw two-or-three-named-spell choice for class features; no summon/companion modeling (beast/drake/swarm companions, astral-self/duplicate/elemental summons all stayed fully manual); no third-party-attack-trigger vocabulary (Fighter Protection, Monk Opportunist); no environmental-condition gate (indoors/underground, lighting) beyond the existing duration/armorState/weaponFilters gates; no post-roll-modification vocabulary (bonuses or overrides applied after seeing a roll but before the outcome is known); the `ifProficient` choice gate only checks a class's static base saving throws, not proficiencies granted dynamically by other features, so it can't reliably back a "grant X, or Y if you already have X" pattern; and the `"artisan_tools"`/`"class_skills"` `from` keywords silently fall back to the full skill/tool catalog at the UI layer rather than actually restricting to that narrower category (confirmed by tracing `structuredFeatureEffects.ts`, which only special-cases an array `from`, not the keyword strings) — a pre-existing, low-severity scope bug, not something this sweep introduced.

Priority clusters (unchanged, still backlog):

- Remaining proficiency-choice variants that require either/or categories.
- Divine Strike and Potent Spellcasting, after safe consumers and gates exist.
- Extra Attack, after the runtime can display or consume attack count.
- Companion/summon modeling (beast companions, drakes, swarms, astral-self pieces) — a large, distinct effort of its own.

The six campaign-priority builds have already been audited from levels 1–20. Their remaining manual features are blocked by missing vocabulary or are intentionally table-managed.

### 3. Species traits

**Done (2026-07-23): every mechanical trait across all 18 species individually reviewed, plus the legacy `source_modifier` cleanup.** Started from 129 traits (68 `automatic`, 41 `mixed`, 20 `manual`) and 56 legacy `source_modifier` records sitting in 18 "Legacy source mechanics" traits. Finished at 111 traits (67 `automatic`, 21 `mixed`, 23 `manual`, 0 unreviewed, 0 `source_modifier` records left) — the 18-trait drop is exactly the "Legacy source mechanics" traits, removed after confirming every one of their 56 records was redundant.

**Legacy `source_modifier` cleanup.** Every record was individually cross-checked against the species' actual structured facts (root `abilityScoreIncrease`, sibling `proficiency_grant`/`defense`/`spell_grant` effects, `preparedSpellProgression` entries) or an already-documented manual gap on a sibling trait's `resolutionNotes` (e.g. Fey Ancestry's sleep-immunity note). This check turned up two real, already-promoted correctness bugs, both fixed:

- **Aasimar, Goliath, and Orc were missing the species-root `abilityScoreIncrease` field entirely**, even though every other species has one and each of these three had the correct 2014 value sitting unused in its own legacy record. Their "Ability Score Increase" trait is `automatic` and relies on this field per the guardrail's own design — it was silently granting **zero** ability score increase to every Aasimar, Goliath, and Orc character. Fixed by restoring the field from the legacy record (Aasimar Cha+2/Wis+1, Goliath Str+2/Con+1, Orc Str+2/Con+1).
- **Natural Illusionist (Forest Gnome) had no structured mechanics at all** despite being a plain fixed cantrip grant (the species root already sets `spellcastingAbility: "int"`, matching the trait). Now `automatic` via `preparedSpellProgression`.

After those fixes, all 56 records were confirmed redundant and the 18 "Legacy source mechanics" traits were removed, matching the project's established pattern of removing fully-redundant trait cards rather than leaving empty stubs.

**A second, more consequential bug surfaced during the same audit: `condition_advantage` (a `defense` effect mode) has zero runtime consumer anywhere in the app.** It's declared in the schema and checked by the import guardrail (which only validates that the target names a real condition), but nothing in `web-player` ever reads it to actually grant advantage on a saving throw — confirmed by searching the full `web-player` and `server` trees. Every trait that relied on it to claim "advantage on saves against X is automatic" was over-claiming, in one case granting *nothing at all*. All confirmed occurrences fixed:

- **Fey Ancestry (Drow, High Elf, Wood Elf, Half-Elf)** — reverted from `mixed` to fully `manual`; both halves (charm-save advantage and sleep immunity) have no structured vocabulary.
- **Brave (Lightfoot and Stout Halfling)** — was `automatic` on this dead effect *alone*, so it was granting nothing. Reverted to `manual`.
- **Constructed Resilience (Warforged)** — kept the real `damage_resistance: Poison` half, dropped the dead `condition_advantage` half.
- **Psychic Defenses (Aberrant Mind Sorcerer subclass feature, not a species trait)** — same root-cause bug, found via the same search and fixed alongside the species traits since it's the identical mistake: kept `damage_resistance: Psychic`, dropped `condition_advantage`, reverted from `automatic` to `mixed`.

**Also fixed: Warforged's Sentry's Rest was `automatic` via a `rest_rule` effect that has zero runtime consumer** — same class of bug as `condition_advantage` (only referenced in its own type declaration and a pass-through unit test, never actually shortens a rest anywhere). Reverted to `manual`. This directly informed marking Trance (Drow/High Elf/Wood Elf) manual too, since it's the same effect shape.

**New structuring:** Tinker (Rock Gnome) — the tinker's-tools proficiency grant is structured, the clockwork-device crafting minigame remains manual. Adrenaline Rush (Orc) — the use pool (proficiency-bonus count, long-rest reset) is tracked via `resource_grant`, matching the established Relentless Endurance precedent; the bonus-action Dash and its temporary-HP grant remain manual (no temp-HP effect type).

**Reviewed and intentionally manual** (each now carries a `resolutionNotes` reason in the data): Dwarf Hill/Mountain Stonecunning and Rock Gnome Artificer's Lore (a doubled proficiency bonus scoped to a narrow subject-matter context — "checks about the origin of stonework," not History checks generally — with no vocabulary for that narrow a scope, and applying it broadly would over-claim the same way War Caster once did); Gnome Cunning (advantage on Int/Wis/Cha saves against magic has no supported saving-throw-advantage gate); Drow Sunlight Sensitivity (disadvantage depends on attacker/target/subject being in direct sunlight, no environmental-state gate); Wood Elf Mask of the Wild and Lightfoot Halfling Naturally Stealthy (expanded hiding rules — the app doesn't resolve hide checks or obscurement); Lightfoot/Stout Halfling Nimbleness (battle-map movement/squeezing rules aren't resolved); Forest Gnome Speak with Small Beasts (pure narrative, no mechanical effect); Aasimar Celestial Revelation (a bonus-action transformation with a choice of three structurally distinct effect bundles — the same "choose one of the following" gap as Ranger's Hunter's Prey); Orc/Goliath Powerful Build (carrying-capacity categories, an already-documented gap); Half-Orc Savage Attacks (critical-hit trigger, app doesn't resolve attack rolls).

Completed (earlier work, still holds): Half-Orc and Orc Relentless Endurance track a one-use, Long-Rest resource; detecting the reduction to 0 hit points and applying the 1-hit-point floor remain manual. Dragonborn Breath Weapon requires and persists a Draconic Ancestry choice, activates the selected ancestry's resistance, displays its 2d6/3d6/4d6/5d6 progression, and tracks one use per Short or Long Rest; save and damage resolution remain manual. Healing Hands displays its proficiency-bonus d4 progression and tracks one use per Long Rest; Stone's Endurance displays its damage-reduction formula and tracks proficiency-bonus uses per Long Rest; targeting, reactions, rolls, healing, and damage reduction remain manual. All fixed species languages are automatic and additional-language choices use the creator's species choice flow. Keen Senses grants Perception proficiency to all three Elf variants; Mountain Dwarf receives Light and Medium Armor proficiency; Hill Dwarf gains 1 maximum HP per character level; Dwarven Resilience and Stout Resilience apply Poison resistance while leaving poison-save advantage manual (now confirmed correct, not just cautious — see the `condition_advantage` finding above).

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
- Check floors based on raw ability score, and roll floors on the d20 itself (distinct — Rogue's Reliable Talent treats a roll of 9 or lower as a 10, which is neither).
- **`attack_advantage`/`attack_disadvantage` (a `defense` effect mode) has zero runtime consumer anywhere in the app** — declared in the schema, never wired to anything. Do not use it to structure "advantage on your attacks" or "attacks against you have advantage"; confirmed via Barbarian's Reckless Attack.
- **`class_level`/`half_class_level` (a `ScalingValue` kind) is declared in the type union but has zero implementation in `resolveScalingValueInContext`** — only `fixed`, `ability_mod`, `proficiency_bonus`, `character_level`, and `half_character_level` actually resolve. A per-level formula like "paladin level × 5" (Lay on Hands) can't be expressed this way yet; use a `resource_grant` with a `fixed` baseline instead and note the scaling is table-only.
- **No vocabulary for granting or choosing among specific named feats.** The `feat_choice` effect type only supports picking from a broad category (`origin`/`general`/`fighting_style`/`epic_boon`), not a fixed single feat or a short list of named options. Confirmed via four background features: Rune Carver's Rune Shaper and Gate Warden's Planar Infusion each grant one specific feat outright; Rewarded's Fortune's Favor and Ruined's Still Standing each offer a choice among 2-3 specific named feats.
- Regaining resources from specific roll outcomes.
- Several narrative or complex features, including most College of Glamour abilities.
- School- or alignment-restricted spell choices (the feat choice schema's spell type has no school filter, only the class-feature choice schema does; no alignment gate exists at all).
- A spell choice pool that depends on an earlier pick in the same choice set (e.g. "pick a moon, then pick 2 of that moon's 4 spells") — no verified working consumer for a dependent-choice-pool shape.
- A spellcasting ability inherited from a different, already-chosen feat's choice (cross-feat dependency).
- Reroll-and-keep-new-result damage mechanics (distinct from the flat bonuses and rerolled-attack-roll vocabulary that already exist).
- Advantage tied to a specific skill check (distinct from `check_override`, which swaps which ability governs a check, not whether it has advantage) — also covers `escape_check_advantage`/`save_advantage`, which are declared in the schema but have zero runtime consumers.
- **`condition_advantage` (a `defense` effect mode) has zero runtime consumer anywhere in the app** — confirmed by searching the full `web-player` and `server` trees; only the import guardrail reads it (and only to validate the target names a real condition, not to apply anything). Do not use it to structure "advantage on saves against condition X"; it will silently grant nothing. This was found already in use by several already-promoted species/subclass traits during the species audit (Elf/Half-Elf Fey Ancestry, Halfling Brave, Warforged Constructed Resilience, Sorcerer's Psychic Defenses) and fixed in each case — see the Species traits section above for the full list.
- **`rest_rule` (mode `long_rest_duration`/`no_sleep_required`) has zero runtime consumer anywhere in the app** — only referenced in its own type declaration and a pass-through unit test; nothing actually shortens a rest or changes sleep requirements anywhere. Found already in use by Warforged's Sentry's Rest (fixed, reverted to manual) during the species audit.
- A gate scoped to one specific named weapon (the existing weapon gates cover generic tags like melee/light/martial, not "a double-bladed scimitar specifically").
- `bonus_damage`'s `frequency` field (`once_per_turn` etc.) is declared in the schema but has zero runtime consumers — do not use it to express a limited-use damage bonus; it will render as always-on.
- "On item use" triggers (e.g. spending a healer's kit charge) and mid-game species/form replacement.
- A `modifier`/`advantage` or `/disadvantage` effect on `saving_throw`/`ability_check` is global to that ability across the whole character — there is no way to scope it to a narrower trigger context (e.g. "only Constitution saves to maintain Concentration"). `gate.notes` prose describing the narrower trigger is not read by the consumer; do not structure an effect this way believing the notes will limit it (this is exactly how War Caster was previously over-scoped — see the Feats correctness re-pass above).
- "Attacks/unarmed strikes count as magical for overcoming resistance and immunity" has no supported vocabulary anywhere in the app (confirmed via Druid Primal Strike and Monk Ki-Empowered Strikes, both intentionally manual).
- No way to gate an effect on another feature's active state when that feature isn't itself structured (e.g. a damage resistance that only applies while an unstructured transformation/Wild Shape use is active) — don't structure the gated half in isolation; it would silently apply the benefit outside the actual triggering state.
- No way to branch on a specific roll outcome to trigger a follow-on effect (rolling the maximum on a damage die, a saving throw succeeding vs. failing, "if the roll is odd/even") beyond the resource-pool tracking already supported.
- The `nativeCompendiumGuardrails.ts` spell-reference check for `preparedSpellProgression` never actually fires (an array-index gets inserted into the walk path before the `path.at(-1) === "preparedSpellProgression"` check runs, so it never matches) — a real but low-priority pre-existing gap, since it fails open rather than blocking; not fixed as part of this effort.
- Class features have no per-feature resource/use-pool field at all (unlike feats' `mechanics.uses`). Class-scoped resources only exist at `ClassLevelSchema.resources`, and that shape supports only a flat numeric count — no proficiency-bonus-scaling formula, and no link to a granted spell or choice (no `grantsSpell`/`grantsChoiceId` equivalent). Don't add a `uses` field directly to a class feature; it isn't part of the schema and will fail validation.
- No supported temporary-hit-points-grant effect type (distinct from `hit_points`/`max_bonus`, which is a permanent max increase). Recurring across Warlock patron features (Dark One's Blessing, Celestial Resilience) and Barbarian paths (Reckless Abandon, Call the Hunt).
- No raw two-or-three-named-spell choice for class features — the class-feature spell choice type references whole spell lists via `sl_*` ids, not individual spell names, so there's no way to structure "pick between exactly these two named cantrips" (e.g. Barbarian Giant Power's druidcraft-or-thaumaturgy pick).

`gate.notes` is descriptive unless a consumer explicitly recognizes its value. Never use prose-only notes as a mechanical gate.

## Compendium import performance

Complete:

- Large compendium uploads spool to temporary disk and clean up on success or failure.
- Preview stages validated bundles behind a 15-minute, unguessable, single-use token.
- Import reuses the staged preview instead of uploading and parsing the bundle twice.
- Category and ZIP exports stream SQLite rows rather than retaining category-sized arrays or JSON strings.
- Opt-in compressed-wire egress logging is available through `BEHOLDEN_LOG_EGRESS=true`; query strings are omitted.

**Declined (2026-07-23) by user decision: real-deployment egress/performance measurement is a no-go.** Not being pursued — drop it from active backlog rather than carrying it forward as a perpetual "not started" item. If it resurfaces, it needs a real deployed environment to measure against, which isn't available now.

Remaining, only if it becomes a problem in practice: consider incremental JSON parsing if disk-backed uploads and preview reuse turn out to leave unacceptable peak memory. Preserve cross-category validation and atomic transactions. No measurement currently motivates this — it's a reactive fallback, not active work.

## Release gate

Before replacing canonical data or publishing a release:

1. Run dedicated content validators and strict Grand Schema validation.
2. Run `npm run verify`.
3. Confirm representative 2014 and 2024 characters still create, level, edit, rest, export/import, and render correctly.
4. Recalculate audit counts when canonical content changes.
