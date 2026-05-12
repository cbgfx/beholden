/**
 * Feat Pattern Audit - 2024 D&D 5e.
 *
 * This file tracks which feat/feature mechanics the FeatureEffect parser can
 * automate, and which ones still need a gameplay subsystem or manual handling.
 *
 * Keep this ASCII-only so stale notes stay easy to patch.
 */

// ---------------------------------------------------------------------------
// Supported Patterns
// ---------------------------------------------------------------------------

export const SUPPORTED_FEAT_EFFECT_PATTERNS = [
  {
    effect: "ability_score fixed/choice",
    parser: "parseAbilityScoreEffects",
    examples: ["Actor", "Athlete", "Ability Score Improvement", "Origin ability boosts"],
  },
  {
    effect: "hit_points max_bonus",
    parser: "parseHitPointBonusEffects",
    examples: ["Tough", "Origin: Tough"],
  },
  {
    effect: "modifier initiative bonus",
    parser: "parseInitiativeModifierEffects",
    examples: ["Alert", "Dread Ambusher"],
  },
  {
    effect: "modifier passive_score bonus",
    parser: "parsePassiveScoreEffects",
    examples: ["Observant"],
  },
  {
    effect: "modifier saving_throw / skill_check / attack_roll / spell_save_dc",
    parser: "parseSavingThrowModifierEffects, parseSkillCheckBonusEffects, parseAttackEffects, parseSpellSaveDcModifierEffects",
    examples: ["Thaumaturge", "Archery", "Reveler's Concertina"],
  },
  {
    effect: "modifier advantage/disadvantage",
    parser: "parseAdvantageModifierEffects",
    examples: ["Resilient-style saving throw advantage", "Rage Strength checks"],
  },
  {
    effect: "armor_class bonus/base formula",
    parser: "parseArmorClassEffects, parseArmorClassBonusEffects",
    examples: ["Defense Fighting Style", "Unarmored Defense"],
  },
  {
    effect: "senses grant/bonus",
    parser: "parseSensesEffects",
    examples: ["Darkvision", "Skulker darkvision"],
  },
  {
    effect: "proficiency_grant fixed/choice/expertise",
    parser: "parseProficiencyGrantEffects",
    examples: ["Skilled", "Lightly Armored", "Actor expertise", "language/tool choices"],
  },
  {
    effect: "spell_grant known/free_cast/at_will/always_prepared/expanded_list",
    parser: "parseSpellGrantEffects, parseItemCanCastSpellEffects",
    examples: ["Magic Initiate", "Fey Touched", "Telekinetic", "item-granted spells"],
  },
  {
    effect: "spell_choice",
    parser: "parseSpellChoiceEffects",
    examples: ["choose cantrips", "choose leveled spells from a list/school"],
  },
  {
    effect: "defense resistance/immunity",
    parser: "parseDefenseEffects",
    examples: ["Gift of the Chromatic Dragon", "Infernal Constitution", "condition immunities"],
  },
  {
    effect: "speed bonus/movement mode",
    parser: "parseSpeedEffects",
    examples: ["Mobile", "Longstrider", "Fly/Swim/Climb speed grants"],
  },
  {
    effect: "attack bonus_damage / ability override / damage die override / triggered attack",
    parser: "parseAttackEffects",
    examples: ["Great Weapon Master heavy damage", "Archery attack bonus", "Rage Damage"],
  },
] as const;

// ---------------------------------------------------------------------------
// Narrative / Manual Resolution
// ---------------------------------------------------------------------------

export const NARRATIVE_ONLY_FEATS = [
  "Lucky",
  "Savage Attacker",
  "Tavern Brawler",
  "Inspiring Leader",
  "Polearm Master",
  "Sentinel",
  "Shield Master",
  "War Caster",
  "Mage Slayer",
  "Skulker (hide mechanic)",
  "Musician (inspiration grant)",
  "Chef (cook mechanic)",
  "Fighting Style: Great Weapon Fighting",
  "Fighting Style: Interception",
  "Fighting Style: Protection",
  "Crossbow Expert",
  "Dual Wielder",
  "Elven Accuracy",
  "Charger",
  "Grappler",
  "Great Weapon Master (bonus-action attack / attack tradeoff)",
  "Sharpshooter (range/cover/attack tradeoff)",
  "Alert (surprise immunity)",
  "Mobile (opportunity-attack suppression)",
] as const;

// ---------------------------------------------------------------------------
// Remaining Gaps
// ---------------------------------------------------------------------------

export const UNSUPPORTED_FEAT_EFFECT_PATTERNS = [
  {
    gap: "luck point resource plus forced reroll",
    needs: ["resource pool", "reroll target model", "self/attacker distinction"],
    examples: ["Lucky"],
  },
  {
    gap: "temporary HP pools for other creatures",
    needs: ["party target selection", "per-rest temp HP grants"],
    examples: ["Inspiring Leader", "Chef"],
  },
  {
    gap: "discretionary damage reroll / base die upgrade",
    needs: ["damage roll intervention model", "attack-specific player choice"],
    examples: ["Savage Attacker", "Tavern Brawler"],
  },
  {
    gap: "reaction triggers",
    needs: ["trigger condition model", "ally/enemy target context"],
    examples: ["Sentinel", "Polearm Master", "Protection", "Interception", "Mage Slayer"],
  },
  {
    gap: "attack tradeoffs and situational toggles",
    needs: ["per-attack opt-in modifier controls", "range/cover context"],
    examples: ["Great Weapon Master", "Sharpshooter"],
  },
  {
    gap: "Hit Die healing floor",
    needs: ["rest hit-die roll floor effect"],
    examples: ["Durable"],
  },
] as const;

export const FEAT_AUDIT_SUMMARY = {
  totalFeats: 239,
  fullyParsed: SUPPORTED_FEAT_EFFECT_PATTERNS.map((entry) => entry.effect),
  partialSupport: [
    "Durable HP-floor on Hit Die roll",
    "manual reaction/trigger feats",
    "manual per-attack tradeoff feats",
  ],
  narrativeOnly: `${NARRATIVE_ONLY_FEATS.length} feat patterns (see NARRATIVE_ONLY_FEATS)`,
  needsNewTypes: UNSUPPORTED_FEAT_EFFECT_PATTERNS.map((entry) => entry.gap),
} as const;
