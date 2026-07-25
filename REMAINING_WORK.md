# Remaining Work

This file tracks current work only. Completed implementation history belongs in Git — do not
re-add "found and fixed" narrative here once it's done; a one-line pointer is enough if it matters
for future context.

## Current status

- Multiclassing, World Actions, and player-facing Engaged Enemies are complete.
- Compendium bundle import is the supported workflow; users must not be required to import one
  category at a time.
- The 2014 XML migration is complete for classes/species/backgrounds/feats/class talents/spells.
  `compendium/legacy_spells.json` (509 core 2014 spells) and the migrated 2014 `classTalents`
  entries are ready to import. Two schema bugs were found and fixed this cycle: `compendium_spells`
  and `compendium_class_talents` both needed a composite `(id, ruleset)` primary key (2014/2024
  content can share the same `id` with genuinely different text) — **the running server needs a
  restart to pick up these migrations before importing.** `legacy_spells.json` also had the same
  double-encoded-punctuation corruption previously found in `WotC_5e_only.json` (187 strings, same
  root cause — UTF-8 em dashes/curly quotes/bullets/minus signs decoded as Windows-1252 during the
  XML conversion); repaired the same way (cp1252-byte round-trip on the corrupted runs only).
  Verified clean: schema-valid, guardrail-clean, 381 additions / 128 replacements on import.
- Classes, subclasses, species, backgrounds, and feats have each had a full pass verifying their
  `automatic`/`mixed`/`manual` resolution labels are actually true (real runtime consumer + correct
  gate scope, not just a matching schema field). All carry a `resolutionNotes` reason where manual.
  See git history for the audit narrative per class.
  **Correction (2026-07-24): that pass missed a real, recurring gap in backgrounds' `proficiencies`
  choices**, found via a user-reported screenshot of Far Traveler. 23 of 48 backgrounds have a real
  "Languages: N of your choice" grant in their prose that was never structured into
  `proficiencies.languages` (only 8 of the 31 backgrounds that actually grant a language had it) —
  meaning a player could spend their real language pick on a language they'd get for free, or the
  choice wasn't offered at all. Same sweep found 3 more backgrounds (Cloistered Scholar, Urban
  Bounty Hunter, Haunted One) with an equivalent gap in `proficiencies.skills`. Both fixed: all 26
  entries now carry the correct `{choose, from?}` shape (or a plain fixed array for backgrounds
  with no real choice, e.g. Shade Fanatic's fixed Netherese).
  **Resolved same day: the 5 remaining `proficiencies.tools` gaps** (Far Traveler, Inheritor, Urban
  Bounty Hunter, Rewarded, Ruined). Discovered the compendium's own established convention for
  tools is *category* tokens ("Gaming Set", "Musical Instrument", "Thieves' Tools" — not specific
  instrument/gaming-set names), already used by 16 other backgrounds' fixed grants (e.g. `bg_noble:
  ["Gaming Set"]`) and already normalized correctly client-side (`expandChoice` in
  `compendiumApi.ts` treats a plain array and a `{choose, from}` object identically). Matched that
  convention instead of inventing a new one: Far Traveler/Inheritor get `{choose: 1, from: ["Musical
  Instrument", "Gaming Set"]}`; Urban Bounty Hunter (the one background that picks from 3 categories)
  gets `{choose: 2, from: [...all 3]}` — a flat approximation, since the schema can't express "pick 2
  of 3 category slots then one specific item within each," and this is close enough that it isn't
  worth new schema work; Rewarded/Ruined have only one possible category, so — matching
  `bg_noble`/`bg_knight`'s existing plain-array pattern for the same situation — they're a plain
  fixed grant, not a `{choose: 1}` choice over a single option.
  All three proficiency categories (languages, skills, tools) are now fully swept and closed across
  all 48 backgrounds. Every fix in this section verified: schema-valid, guardrail-clean full-bundle
  import simulation, full suite green (320 tests).
- Artificer Infusions are modeled as `classTalents` (`kind: "infusion"`, mirroring
  maneuvers/invocations) and `Infuse Item` grants them via the standard `talent.known` progression
  (2/4, 6/6, 10/8, 14/10, with level-up replacement). Same automation ceiling as maneuvers/invocations:
  picking one records the choice and shows its rules text; no infusion's individual mechanical
  effect (e.g. Enhanced Weapon's +1) is auto-applied.

## Canonical 5e data

`compendium/WotC_5e_only.json`, `WotC_5e_Spell.json`, and `legacy_spells.json` are canonical and
intentionally gitignored. The server never reads them directly at runtime — only through the
Compendium Import screen. Never regenerate/overwrite canonical JSON from XML, an intermediate
migration stage, or a failed validation result.

For every content change:

1. Start from the current canonical JSON.
2. Make a targeted edit or an idempotent JSON-to-JSON migration; write to temp output first.
3. Run content validators, strict Grand Schema validation, and the full `npm run verify`.
4. Replace and import the canonical file only after validation passes.

## Open work

- **Level 1–20 class progression simulator run for the first time (2026-07-24).** Updated it to also
  load `legacy_spells.json` (it previously only knew about `WotC_5e_Spell.json`), which surfaced one
  more real bug found and fixed the same day: every one of `legacy_spells.json`'s 509 spell names had
  a blanket `" (Legacy)"` suffix baked in (e.g. "Detect Magic (Legacy)") — a leftover from before the
  composite-`(id, ruleset)` PK fix, now both unnecessary (the `ruleset` field disambiguates, same as
  every other category — none of which use a synthetic name suffix) and actively harmful: 34 feats
  grant spells by their real name ("Detect Magic", "Misty Step", etc.), so the suffixed names failed
  to resolve and blocked the whole 2014 bundle's import guardrail. Fixed by stripping the suffix;
  verified the import guardrail passes clean afterward.
  10 of 13 classes now complete a full 1–20 walk with zero issues. Two "expertise choice has 0
  candidates" failures (Bard, Rogue) are a **simulator limitation, not a data or product bug** —
  Bard/Rogue skill proficiencies live at the class-root `proficiencies.skills.choose` field, which
  this simulator's simplified choice engine doesn't read (it only resolves per-feature `choices[]`
  entries), so it never populates a skill pool for Expertise to draw from. Not fixed — low value for
  a one-off simulator vs. real character-creator code, which already handles this correctly.
  **Resolved same day: 2014 Metamagic.** Sorcerer's Metamagic was never migrated during the original
  2014 conversion (0 `kind: "metamagic"` classTalents for `ruleset: "5e"`, vs. 10 for `5.5e`).
  Extracted all 10 real 2014 options (Careful/Distant/Empowered/Extended/Heightened/Quickened/
  Seeking/Subtle/Transmuted/Twinned Spell) from the source XML, matching 2014 PHB + Tasha's text
  (confirmed several genuinely differ from 5.5e's rewording, e.g. Careful Spell's 5.5e version adds
  a "no damage on success" clause 2014 never had). Added as `ct_metamagic_*` classTalents sharing
  the same `id` as their 5.5e counterparts (ruleset-disambiguated, same pattern as every other
  talent). `compendium_class_talents` now has 103 entries. Verified: schema-valid, guardrail-clean,
  and the simulator's Sorcerer failure is gone (11 of 13 classes now pass with zero issues — only
  the Bard/Rogue simulator-limitation failures above remain, not real gaps).
- **Resolved (2026-07-24): class Features panel was cluttered with pure administrative/reference
  entries.** User-reported ("Multiclass Rogue? no need... Ability Score Improvement, not needed...
  Expertise / Expertise Improvement also useless. Same for Thieves Cant"). All 13 2014 classes carry
  identical-pattern boilerplate: a `Starting <Class>` and `Multiclass <Class>` overview/reference
  card at level 1 (already confirmed `resolution: "manual"` with `resolutionNotes` self-describing
  as "reference text", not real character-specific content) plus a universal `Multiclass Features`
  rules-reference card, and `Ability Score Improvement` (68 instances across all classes/levels) —
  none of these have content beyond what's already shown elsewhere (proficiency/equipment panels,
  ability scores). `Expertise`/`Expertise Improvement` (Rogue, Bard) and `Thieves' Cant` (Rogue) are
  `resolution: "automatic"` and fully redundant with the skills/proficiency panels that already
  surface their effect. Added a new additive `hidden: true` schema field on `ClassFeatureSchema`
  (does not touch `resolution`/mechanical parsing — every other consumer, choice resolution
  included, is unaffected) and flagged all 111 matching instances across the 13 5e classes. 5.5e has
  none of this pattern (ASI is a plain `abilityScoreImprovement: true` level flag there, no
  boilerplate cards at all) — no changes needed on that side. Filtered in
  `buildDisplayPlayerFeatures` (character sheet) and the level-up "New Features" preview; the
  feature is still fully applied everywhere else. Verified: schema-valid, guardrail-clean, full
  `simulateClassProgression.ts` run unchanged from baseline (11/13, same known Bard/Rogue simulator
  limitation), server suite 320/320, web-player suite 241/241 (added regression coverage for both
  the display filter and the plural/singular weapon-proficiency fix from the same session).
  **Important process finding while promoting this fix:** the repo's `compendium/WotC_5e_only.json`
  and the Dropbox canonical copy (`C:\Users\cellu\Dropbox\D&D\App Files\WotC_5e_only.json` — the
  file the app's Compendium Import screen actually reads) had silently diverged. Dropbox had 12
  backgrounds' "Suggested Characteristics" flavor tables the repo lacked; the repo had this
  `hidden`-flag fix Dropbox lacked. Merged onto the Dropbox copy (preserving its background
  content) rather than overwriting either direction, then wrote the identical merged result back to
  both locations. **Also confirms restarting the server / refreshing the browser never re-imports
  compendium data** — the live SQLite DB only updates via an explicit run through the Compendium
  Import screen, which still needs to happen for this fix (or any prior one) to reach a live
  character. See memory `beholden-data-locations` for the diff-before-promote discipline this
  requires going forward.
  **Also 2026-07-24, same cleanup thread, user-requested deletion (not hiding) of an adjacent
  bloat category:** every subclass carries a level-3-ish (or level-1 for Cleric/Sorcerer/Warlock)
  "<Category>: <Subclass Name>" introduction feature (e.g. "Roguish Archetype: Arcane Trickster",
  "Otherworldly Patron: The Archfey") whose own `resolutionNotes` already confirmed it as "pure
  flavor text introducing the [archetype/tradition/oath/origin/patron/college/circle/path/
  specialization], with no mechanical content of its own" — the actual subclass content lives in
  sibling features. Deleted all 99 matching entries outright (not just `hidden: true` — user wants
  the JSON smaller, not just the UI cleaner) across all 12 5e classes with this pattern (Cleric's
  "Divine Domain: X" entries are `resolution: "automatic"` and were correctly left alone — they
  carry real bundled effects, no matching resolutionNotes). Also deliberately left untouched:
  Warlock's "Otherworldly Patron: The Genie" (its note says it introduces a real, unstructured
  genie-kind choice, not pure flavor), "Restriction: ..." prerequisite notes, and any
  "Channel Divinity: ..." / "Hunter's Prey: ..." / "Fighting Style: ..." entries (real mechanical
  content that happens to share the "X: Y" naming convention). 5.5e has zero matches for this
  pattern — nothing to do there. First removal pass had a bug (unconditionally setting
  `features: []` on levels that never had a `features` key at all, e.g. Cleric's level 3, which
  only has `spellSlots` — failed strict-schema `min(1)`); fixed by deleting the `features` key
  entirely when filtering empties it, not leaving `[]`. Verified: schema-valid, guardrail-clean,
  `simulateClassProgression.ts` unchanged from baseline (11/13), server suite 320/320, web-player
  suite 244/244. Promoted to both the repo and Dropbox canonical copies (byte-identical after).
  **Follow-up same day, one more deletion round:** user asked to remove (not hide) every class
  feature whose own `resolutionNotes` self-describes as zero-independent-content, quoting the exact
  phrases: "a pure restatement of a progression already fully captured" (e.g. "Sneak Attack (2)"
  through "(10)", "Bardic Inspiration (d8/d10/d12)", "Channel Divinity (2/rest)"/"(3/rest)",
  "Unarmored Movement 2nd"–"5th", "Indomitable (two/three uses)", "Action Surge (two uses)", "Wild
  Shape Improvement" — all pure restatements of a progression already captured in the level-1
  feature's own `scalingRolls` or the class level's own `resources` table), "reference text for the
  optional multiclassing rule's ability-score prerequisite" (the 13 "Multiclass <Class>" entries —
  previously only `hidden: true`, now fully deleted), "pure rules-reference text explaining how"
  (the 13 identical "Multiclass Features" entries — same, now deleted), and "this is the choice
  header only" (e.g. Barbarian's Totem Spirit/Aspect of the Beast/Totemic Attunement, Bard/Fighter's
  "Fighting Style"/"Additional Fighting Style" header features, Druid's "Circle Spells" terrain
  header). Also included the closely-related, functionally-identical "pointer header" family not
  explicitly quoted but matching the same "no content of its own" self-description (one per class:
  "Bard College Feature", "Divine Domain Feature", "Path Feature", "Martial Archetype Feature",
  etc. — each literally says "you gain a feature from your X" with the real content living in
  sibling subclass features) — flagged this inclusion explicitly since it went beyond the literal
  quotes. Verified beforehand that none of the 87 removed entries carried any `effects`/`choices`/
  `scalingRolls`/`talent`/`noteTemplate` — confirmed zero real mechanical content lost. Left `hidden:
  true` (not deleted) on the four remaining categories that DO carry real, consumed mechanics
  despite being redundant to *show*: `Ability Score Improvement`, `Expertise`/`Expertise
  Improvement`, `Thieves' Cant` (Rogue's language grant), and `Starting <Class>` (not requested this
  round). Verified: schema-valid, guardrail-clean, `simulateClassProgression.ts` unchanged from
  baseline (11/13), server suite 320/320, web-player suite 244/244. Promoted to both canonical
  copies (byte-identical). Class feature count: 1068 remaining, 85 still `hidden`-flagged.
  **Final follow-up same day:** deleted all 68 remaining `Ability Score Improvement` feature
  entries too (previously left `hidden: true`, reasoned as carrying "real, consumed mechanics").
  Traced the actual client code before deleting: `isAsiLevel` (`useLevelUpDerivedState.ts:117`)
  reads `autoLevel.scoreImprovement`, which `compendiumApi.ts:131` always sets to a definite
  `true`/`false` from the class level's own `abilityScoreImprovement` flag — never `null`/
  `undefined`. The `?? hasAsiFeature` fallback (a text scan for a feature literally named "Ability
  Score Improvement") can therefore never actually fire; it was dead code protecting against a
  case that can't occur. Confirmed programmatically that all 68 entries had zero `effects`/
  `choices`/scaling data of their own, and every level carrying one also correctly has the
  `abilityScoreImprovement: true` level flag already. So unlike Expertise/Thieves' Cant (which
  really do carry consumed `choices`/`effects` and must stay `hidden`, not deleted), ASI's feature
  card was pure duplicate flavor text end to end — safe to remove outright.
  **Correction:** the first promotion of this fix silently failed to reach either canonical file —
  user reported still seeing the `cf_*_ability_score_improvement` ids after this was marked done.
  Root cause not conclusively identified (chained-Bash-call `cd` persistence or a path-quoting
  issue are the leading suspects); the generation script and the `diff -q` between the two
  destinations both reported success while the actual destination content was unchanged. Redone by
  writing to a distinctly-named file, verifying its content directly, then copying to each
  destination and re-reading *that exact destination path* fresh before trusting it — this is now
  the required promotion discipline (see memory `beholden-data-locations`), not just a `diff -q`
  between the two copies. Re-verified: schema-valid, guardrail-clean,
  `simulateClassProgression.ts` unchanged (11/13), server 320/320, web-player 244/244, 0 remaining
  `Ability Score Improvement` entries confirmed by fresh reads of both final files.
  **One more cleanup pass same thread:** user spotted `{"level": 6, "features": []}` (Rogue) while
  browsing the raw JSON directly and asked whether the empty array should be kept. It can't — fails
  the schema's `features: array.min(1)` — but two earlier deletion rounds this session had left
  vestigial level entries behind: deleting a level's only feature correctly dropped the `features`
  key when it emptied, but never checked whether the *whole level object* was left with nothing
  else. Found 2 across the entire file: Rogue level 6 (`{level, features: []}` — its only feature,
  "Expertise Improvement," was never actually removed by name, so this was a live find, not
  cleanup-from-cleanup) and Fighter level 13 (`{level: 13}` with nothing at all — its only feature,
  "Indomitable (three uses)," was removed in the earlier "pure restatement" pass and left this
  behind). Rule going forward: after removing a level's last feature, if the level object has no
  keys besides `level`, delete the whole entry from `classes[].levels`, not just the `features` key.
  Scanned the entire file for both failure shapes (empty `features: []` and levels with zero keys
  besides `level`) — 0 remaining after the fix. Verified: schema-valid, guardrail-clean,
  `simulateClassProgression.ts` unchanged (11/13), server 320/320, web-player 244/244, and this time
  confirmed with a fresh read of each actual destination file (not just the generation script's own
  output) before calling it done.
- **Weapon Master feat** (the ASI-replacement feat, distinct from the class-level Weapon Mastery
  choice which is already filtered correctly) still offers all 38 weapon kinds regardless of class
  proficiency — sourced from its own hardcoded `options` array rather than
  `getEligibleWeaponMasteryKinds()`. Fixing it touches `getFeatChoiceOptions()` and its five call
  sites across the creator, level-up, and live invocation-granted-feat-choice flows.
- **Level-up never prompts for additional Weapon Mastery choices** at higher levels — only
  character creation does. A class that gains more mastery slots later can't fill them in-app.
- **Companion/summon modeling** (beast companions, drakes, swarms, astral-self pieces, Infuse
  Item's crafted items) is unimplemented — a large, distinct effort of its own.
- Priority clusters, otherwise unchanged: remaining either/or proficiency-choice variants; Divine
  Strike and Potent Spellcasting once safe consumers/gates exist; Extra Attack once the runtime can
  display/consume attack count.
- Compendium import performance: real-deployment egress/performance measurement was **declined by
  user decision (2026-07-23)** — not being pursued, no deployed environment to measure against.
  Incremental JSON parsing remains a reactive fallback only if disk-backed uploads/preview reuse
  turn out to leave unacceptable peak memory in practice; no current measurement motivates it.

## Missing runtime vocabulary

Do not mark a feature `automatic`/`mixed` merely because its data shape exists — confirm a real
runtime consumer exists and its gate scopes the effect correctly. Known gaps:

- Extra Attack count; critical-hit triggers (Beholden doesn't resolve attack rolls).
- Resource-spend/target-specific gates for conditional attack/damage bonuses; generic cantrip
  damage ability modifiers; healing-amount modifiers and maximized healing dice.
- Triggered/reaction attacks and turn-scoped conditional advantages; third-party-attack triggers
  (e.g. Protection, Opportunist).
- Disease and magical-sleep immunity; blindsense distinct from blindsight; environmental-condition
  gates (lighting, indoors/underground) beyond existing duration/armor/weapon gates.
- Check floors based on raw ability score, and roll floors on the d20 itself (distinct from each
  other — Reliable Talent is neither).
- `attack_advantage`/`attack_disadvantage`, `condition_advantage`, `rest_rule`, and `bonus_damage`'s
  `frequency` field are all declared in the schema with **zero runtime consumer** anywhere in the
  app — do not structure a feature believing any of these do something.
- `class_level`/`half_class_level` (`ScalingValue` kinds) are declared but unimplemented in
  `resolveScalingValueInContext` — only `fixed`/`ability_mod`/`proficiency_bonus`/`character_level`/
  `half_character_level` resolve. Use a `resource_grant` with a `fixed` baseline instead.
- No vocabulary for granting/choosing among specific named feats (only broad categories); no
  school- or alignment-restricted spell choice on feats (class features have school filtering, feats
  don't); no raw two-or-three-named-spell choice on class features (only whole spell-list refs).
- No vocabulary for a spell choice pool dependent on an earlier pick in the same set, or a
  spellcasting ability inherited from a different already-chosen feat's choice.
- Reroll-and-keep-new-result damage mechanics; advantage tied to a specific skill check (distinct
  from `check_override`); no supported temporary-hit-points-grant effect type (distinct from the
  permanent-max `hit_points`/`max_bonus`).
- No vocabulary for "attacks count as magical" for resistance/immunity purposes; no way to gate an
  effect on another feature's active state when that feature isn't itself structured; no way to
  branch on a specific roll outcome (max die roll, save success/failure) to trigger a follow-on
  effect.
- A `modifier`/`advantage`/`disadvantage` effect on `saving_throw`/`ability_check` is global to that
  ability for the whole character — cannot be scoped to a narrower trigger (e.g. "only Concentration
  saves"). `gate.notes` prose is descriptive only; no consumer reads it as a mechanical gate.
- Class features have no per-feature resource/use-pool field at all (unlike feats'
  `mechanics.uses`) — `ClassLevelSchema.resources` only supports a flat numeric count, no
  proficiency-bonus scaling formula, no link to a granted spell/choice.
- A gate scoped to one specific named weapon (existing gates only cover generic tags).
- The `nativeCompendiumGuardrails.ts` spell-reference check for `preparedSpellProgression` never
  actually fires (an array-index gets inserted into the walk path before the check runs) — fails
  open rather than blocking, low priority, not fixed.
- The `"artisan_tools"`/`"class_skills"` `from` keywords silently fall back to the full skill/tool
  catalog at the UI layer instead of restricting to the narrower category — pre-existing, low
  severity, confirmed via `structuredFeatureEffects.ts`.

## Release gate

Before replacing canonical data or publishing a release:

1. Run dedicated content validators and strict Grand Schema validation.
2. Run `npm run verify`.
3. Confirm representative 2014 and 2024 characters still create, level, edit, rest, export/import,
   and render correctly.
4. Recalculate audit counts when canonical content changes.
