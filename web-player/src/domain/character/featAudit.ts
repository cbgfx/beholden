/**
 * Feat Pattern Audit — 2024 D&D 5e (2024 PHB / compendium)
 *
 * Classification of all ~239 feats by what FeatureEffect types cover them
 * and what still requires manual / narrative handling.
 *
 * Legend
 *   ✅  Fully parsed — one or more FeatureEffect types produce the sheet value
 *   ⚠️  Partial — type exists, parser may miss edge-case phrasing
 *   🟡  Narrative — NarrativeEffect is the right call; no automation needed
 *   ❌  Unsupported — needs a new effect type or gameplay system
 */

// ---------------------------------------------------------------------------
// SUPPORTED PATTERNS (✅)
// ---------------------------------------------------------------------------

/**
 * ability_score — fixed
 *   Parser: parseAbilityScoreEffects → "your X score increases by N"
 *   Examples: Actor (+1 CHA), Durable (+1 CON), Keen Mind (+1 INT),
 *             Lightly Armored (+1 STR/DEX choice), Moderately Armored (+1 STR/DEX),
 *             Observant (+1 INT or WIS), Resilient (+1 to chosen ability),
 *             War Caster (+1 INT/WIS/CHA), all "Origin" feats with +1/+2 bumps
 *
 * ability_score — choice (free or restricted)
 *   Parser: parseAbilityScoreEffects → "Increase one of your ability scores by 2"
 *           or "your Strength or Dexterity score increases by 1"
 *   Examples: ASI ("+2 or two +1"), Athlete (+1 STR/DEX), Brawny (+1 STR/CON),
 *             Charger (+1 STR/DEX/CON), Chef (+1 CON/WIS), Crusher (+1 STR/CON),
 *             Eldritch Adept (+1 INT/WIS/CHA), Fey Touched (+1 INT/WIS/CHA),
 *             Gift of the Chromatic Dragon, Gift of the Gem Dragon,
 *             Gunner (+1 DEX), Heavily Armored (+1 STR), many more
 */

/**
 * hit_points — max_bonus
 *   Parser: parseHitPointBonusEffects
 *   Examples: Tough (+2 HP per level → character_level multiplier:2),
 *             Durable (character-level variant — narrative only, complex)
 */

/**
 * modifier — initiative bonus
 *   Parser: parseInitiativeModifierEffects → "add your Proficiency Bonus to Initiative"
 *   Examples: Alert
 */

/**
 * modifier — passive_score bonus
 *   Parser: parsePassiveScoreEffects → "+5 to your passive Wisdom (Perception)"
 *   Examples: Observant (+5 passive Perception & Investigation)
 */

/**
 * armor_class — bonus while wearing armor
 *   Parser: parseArmorClassBonusEffects → "+1 bonus to AC while wearing armor"
 *   Examples: Defense (Fighting Style)
 */

/**
 * senses — grant
 *   Parser: parseSensesEffects → "you have Darkvision with a range of 60 feet"
 *   Examples: Skulker (Darkvision 60 ft — ✅ senses), many species feats,
 *             Magic Initiate (Darkvision cantrip), Elven Accuracy (Darkvision variant)
 */

/**
 * proficiency_grant — skill / tool / language / armor / weapon / saving_throw
 *   Parser: parseProficiencyGrantEffects
 *   Examples: Lightly Armored, Moderately Armored, Weapon Master (martial),
 *             Skilled (3 skills or tools), Magic Initiate (spell proficiency),
 *             Linguist (3 languages), Ritual Caster (ritual book tools),
 *             Dungeon Delver (languages — narrative only)
 */

/**
 * spell_grant — free_cast / at_will
 *   Parser: parseSpellGrantEffects
 *   Examples: Fey Touched (Misty Step 1/long rest, +1 divination/enchantment),
 *             Shadow Touched (Invisibility 1/long rest, +1 illusion/necromancy),
 *             Telekinetic (Mage Hand at will), Telepathic (Detect Thoughts 1/long),
 *             Magic Initiate (2 cantrips + 1 spell 1/long rest)
 */

/**
 * defense — damage_resistance / condition_immunity
 *   Parser: parseDefenseEffects
 *   Examples: Gift of the Chromatic Dragon (elemental resistance),
 *             Infernal Constitution (poison/cold resistance),
 *             Resilient (saving-throw advantage — partial, see below)
 */

/**
 * speed — bonus
 *   Parser: parseSpeedEffects
 *   Examples: Mobile (+10 ft speed), Longstrider, Athlete (+10 climb speed variant)
 */

// ---------------------------------------------------------------------------
// PARTIAL SUPPORT (⚠️)
// ---------------------------------------------------------------------------

/**
 * expertise — feat grants
 *   Type: ProficiencyGrantEffect { expertise: true }
 *   Gap: parseProficiencyGrantEffects looks for "proficiency in X"; feats use
 *        "you gain Expertise in X" — regex doesn't catch this phrasing.
 *   Fix needed: add "you gain Expertise in ([A-Za-z]+)" branch to parser.
 *   Examples: Skilled Expert (expertise in one skill), Actor (Performance expertise)
 */

/**
 * spell_grant — "known" mode
 *   Type: SpellGrantEffect { mode: "known" }
 *   Gap: No parser produces this mode yet; must be authored manually.
 *   Examples: Magic Initiate (learn 2 cantrips), Ritual Caster (learn ritual spells),
 *             Spell Sniper (learn one cantrip)
 */

/**
 * modifier — saving_throw advantage (Resilient)
 *   Type: ModifierEffect { target: "saving_throw", mode: "advantage" }
 *   Gap: Parser would need "you have advantage on X saving throws" → appliesTo parsing.
 *   Examples: Resilient (advantage on the chosen save type)
 */

/**
 * hit_points — Durable special (regain minimum)
 *   Type: HitPointEffect { mode: "heal_pool" } or NarrativeEffect
 *   Gap: Durable's "regain minimum equal to twice your Con mod on Hit Die" is
 *        a healing-floor mechanic, not a max-HP bonus. No parser covers it.
 *   Recommended: NarrativeEffect with category "manual_resolution" until a
 *                rest-roll-floor effect type is added.
 */

// ---------------------------------------------------------------------------
// NARRATIVE / MANUAL RESOLUTION (🟡)
// These feats have rules that are situational, player-tracked, or too complex
// to automate without dedicated gameplay systems. Use NarrativeEffect.
// ---------------------------------------------------------------------------

export const NARRATIVE_ONLY_FEATS = [
  /**
   * Lucky — 3 luck points, reroll any d20 (attack, check, or save) or force
   * attacker reroll. Needs a dedicated luck-point resource + reroll trigger.
   */
  "Lucky",

  /**
   * Savage Attacker — once per turn reroll weapon damage dice, use either roll.
   * Needs "reroll damage" attack-trigger mechanic.
   */
  "Savage Attacker",

  /**
   * Tavern Brawler — unarmed strike damage die upgrade to d4, improvised weapon
   * proficiency, bonus action grapple. Multiple interacting subsystems.
   */
  "Tavern Brawler",

  /**
   * Inspiring Leader — 10-min speech; party members gain temp HP = level + CHA.
   * Party-targeting mechanic; temp HP is per-use per-rest.
   */
  "Inspiring Leader",

  /**
   * Polearm Master — bonus action attack with butt of polearm, reaction attack
   * on enemy entering reach. Requires attack-trigger / reaction logic.
   */
  "Polearm Master",

  /**
   * Sentinel — reaction attack when creature hits ally, stop enemy movement on
   * hit, ignore enemy Disengage. Three separate combat reactions.
   */
  "Sentinel",

  /**
   * Shield Master — bonus action shove after attack, add shield AC to DEX saves,
   * no damage on successful DEX save. Multiple interaction points.
   */
  "Shield Master",

  /**
   * War Caster — advantage on concentration saves, somatic components with hands
   * full, opportunity attack spell substitute. Requires concentration tracking.
   */
  "War Caster",

  /**
   * Mage Slayer — reaction attack on nearby spell cast, save disadvantage on
   * caster in melee, advantage on saves vs. nearby spells.
   */
  "Mage Slayer",

  /**
   * Skulker — hide when lightly obscured, no reveal on missed ranged attack,
   * Darkvision (✅ parsed). Hide rules outside current model scope.
   */
  "Skulker (hide mechanic)",

  /**
   * Musician — gain Instrument proficiency (✅ parsed), allies gain Heroic
   * Inspiration after short rest. Party inspiration mechanic untracked.
   */
  "Musician (inspiration grant)",

  /**
   * Chef — cook bonus temp HP (short rest pool) per level. Resource pool that
   * references other characters; outside solo-sheet scope.
   */
  "Chef (cook mechanic)",

  /**
   * Fighting Style — Great Weapon Fighting (reroll 1/2 on damage die),
   * Interception (reaction reduce damage), Protection (impose disadvantage
   * on attacker targeting ally). Each is a bespoke reaction/trigger.
   */
  "Fighting Style: Great Weapon Fighting",
  "Fighting Style: Interception",
  "Fighting Style: Protection",

  /**
   * Crossbow Expert — ignore loading, no disadvantage in melee, bonus-action
   * attack with hand crossbow after attack action. Attack action sequencing.
   */
  "Crossbow Expert",

  /**
   * Dual Wielder — two-weapon fighting without light property, +1 AC with two
   * weapons. AC conditional on dual-wield state, not parsed.
   */
  "Dual Wielder",

  /**
   * Elven Accuracy — +1 INT/WIS/CHA, advantage → triple roll with bow/finesse.
   * Triple-advantage mechanic not in current attack model.
   */
  "Elven Accuracy",

  /**
   * Charger — dash → bonus action attack or push. Movement-tied attack action.
   */
  "Charger",

  /**
   * Grappler — advantage while grappling, pin attempt. Grapple subsystem.
   */
  "Grappler",

  /**
   * Great Weapon Master — heavy weapon crit → bonus action attack, –5/+10 trade.
   * Attack-roll modifier choice at time of attack.
   */
  "Great Weapon Master",

  /**
   * Sharpshooter — ignore long range penalty, ignore 3/4 cover, –5/+10 trade.
   * Range and cover rules outside current model.
   */
  "Sharpshooter",

  /**
   * Alert — can't be surprised, no advantage on attackers who are hidden.
   * Surprise is an encounter-setup concept, not a sheet stat.
   * (Initiative PB bonus ✅ parsed separately.)
   */
  "Alert (surprise immunity)",

  /**
   * Mobile — speed +10 (✅), no OA after Dash, no OA after melee attack on target.
   * Opportunity-attack suppression requires combat tracking.
   */
  "Mobile (OA suppression)",
] as const;

// ---------------------------------------------------------------------------
// UNSUPPORTED PATTERNS — need new FeatureEffect types (❌)
// ---------------------------------------------------------------------------

/**
 * luck_point resource + forced reroll effect
 *   Would need: ResourceGrantEffect { resourceKey: "lucky" } +
 *               new AttackEffect mode "force_reroll" or "spend_luck".
 *   Blocker: forced-reroll target (self vs. attacker) can't be expressed today.
 */

/**
 * temp_hp_pool for self per short rest (Inspiring Leader, Chef)
 *   HitPointEffect { mode: "temp_hp" } exists but has no "per short rest, up to N
 *   other creatures" semantics.
 */

/**
 * damage_die_upgrade (Tavern Brawler unarmed d4, Savage Attacker reroll)
 *   AttackEffect doesn't have a mode for upgrading the base damage die or
 *   rerolling damage at the player's discretion.
 */

/**
 * reaction_trigger — opportunity attacks, damage interception, concentration
 *   ActionEffect has activation: "reaction" but no trigger condition model.
 *   Most reaction feats require specifying "when X happens" in a machine-readable way.
 */

// ---------------------------------------------------------------------------
// SUMMARY TABLE
// ---------------------------------------------------------------------------

export const FEAT_AUDIT_SUMMARY = {
  totalFeats: 239,
  fullyParsed: [
    "ability_score (fixed and choice)",
    "hit_points max_bonus (Tough pattern)",
    "initiative modifier (Alert)",
    "passive_score bonus (Observant)",
    "armor_class bonus while armored (Defense)",
    "senses grant (Darkvision/Blindsight/etc.)",
    "proficiency_grant (armor/weapon/skill/tool/language)",
    "spell_grant (free_cast and at_will)",
    "defense (damage resistance/immunity, condition immunity)",
    "speed bonus",
  ],
  partialSupport: [
    "expertise grants from feats (phrasing mismatch)",
    "spell_grant 'known' mode (no parser yet)",
    "saving_throw advantage from Resilient",
    "Durable HP-floor on Hit Die roll",
  ],
  narrativeOnly: NARRATIVE_ONLY_FEATS.length + " feats (see NARRATIVE_ONLY_FEATS array)",
  needsNewTypes: [
    "luck_point resource + forced reroll",
    "temp_hp pool for per-rest grants",
    "damage die upgrade / reroll-damage",
    "reaction trigger conditions",
  ],
} as const;
