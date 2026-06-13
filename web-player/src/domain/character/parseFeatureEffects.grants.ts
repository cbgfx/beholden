import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { normalizeResourceKey } from "@/views/character/CharacterSheetUtils";
import { titleCase as toTitleCase } from "@/lib/format/titleCase";
import {
  createFeatureEffectId,
  type FeatureEffect,
  type FeatureEffectSource,
  type ResourceGrantEffect,
  type ScalingValue,
  type SpellGrantEffect,
} from "@/domain/character/featureEffects";
import {
  hasLikelySpellNameCapitalization,
  isLikelySpellName,
  looksLikePreparedSpellList,
  parseSpellLists,
  parseWordCount,
  splitNamedSpellList,
} from "@/domain/character/parseFeatureEffects.normalizers";

function addSpellGrantEffect(
  source: FeatureEffectSource,
  effects: FeatureEffect[],
  args: {
    spellName: string;
    mode: SpellGrantEffect["mode"];
    spellList?: string;
    requiredLevel?: number;
    riderSummary?: string;
    castsWithoutSlot?: boolean;
    uses?: ScalingValue;
    reset?: SpellGrantEffect["reset"];
    noMaterialComponents?: boolean;
    resourceKey?: string;
    summary: string;
  },
) {
  const normalizedSpellName = hasLikelySpellNameCapitalization(args.spellName) ? args.spellName : toTitleCase(args.spellName);
  const cleaned = normalizedSpellName.trim().replace(/^the\s+/i, "");
  if (!cleaned || !isLikelySpellName(cleaned)) return;
  effects.push({
    id: createFeatureEffectId(source, "spell_grant", effects.length),
    type: "spell_grant",
    source,
    spellName: cleaned,
    spellList: args.spellList,
    mode: args.mode,
    requiredLevel: args.requiredLevel,
    riderSummary: args.riderSummary,
    castsWithoutSlot: args.castsWithoutSlot,
    uses: args.uses,
    reset: args.reset,
    noMaterialComponents: args.noMaterialComponents,
    resourceKey: args.resourceKey,
    summary: args.summary,
  } satisfies SpellGrantEffect);
}

function hasSpellGrantEffect(
  effects: FeatureEffect[],
  spellName: string,
  mode: SpellGrantEffect["mode"]
): boolean {
  return effects.some((effect) =>
    effect.type === "spell_grant"
    && effect.mode === mode
    && effect.spellName.trim().toLowerCase() === spellName.trim().toLowerCase()
  );
}

function hasResourceGrantEffect(
  effects: FeatureEffect[],
  resourceKey: string
): boolean {
  return effects.some((effect) =>
    effect.type === "resource_grant"
    && effect.resourceKey === resourceKey
  );
}

function parseKnownSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const inferredSpellLists = parseSpellLists(text);
  const spellList = inferredSpellLists.length === 1 ? inferredSpellLists[0] : undefined;

  for (const match of text.matchAll(/when you reach character levels?\s+(\d+)\s+and\s+(\d+),\s+you\s+learn\s+([A-Z][A-Za-z' -]+?)\s+and\s+([A-Z][A-Za-z' -]+?)\s+respectively/gi)) {
    const firstLevel = Number(match[1]);
    const secondLevel = Number(match[2]);
    const firstSpell = match[3]?.trim();
    const secondSpell = match[4]?.trim();
    if (!firstSpell || !secondSpell || !Number.isFinite(firstLevel) || !Number.isFinite(secondLevel)) continue;
    addSpellGrantEffect(source, effects, {
      spellName: firstSpell,
      spellList,
      mode: "known",
      requiredLevel: firstLevel,
      summary: `${firstSpell} known spell`,
    });
    addSpellGrantEffect(source, effects, {
      spellName: secondSpell,
      spellList,
      mode: "known",
      requiredLevel: secondLevel,
      summary: `${secondSpell} known spell`,
    });
  }

  for (const match of text.matchAll(/you\s+(?:learn|know)\s+(?:the\s+)?([A-Za-z][A-Za-z' -]+?)\s+cantrip\b/gi)) {
    const spellName = match[1]?.trim();
    if (!spellName) continue;
    addSpellGrantEffect(source, effects, {
      spellName,
      spellList,
      mode: "known",
      summary: `${spellName} known cantrip`,
    });
  }

  for (const match of text.matchAll(/you\s+(?:learn|know)\s+(?:the\s+)?([A-Za-z][A-Za-z' -]+?)\s+spell\b/gi)) {
    const spellName = match[1]?.trim();
    if (!spellName) continue;
    addSpellGrantEffect(source, effects, {
      spellName,
      spellList,
      mode: "known",
      summary: `${spellName} known spell`,
    });
  }

  if (
    /\btelekinetic\b/i.test(source.name)
    && !hasSpellGrantEffect(effects, "Mage Hand", "known")
  ) {
    addSpellGrantEffect(source, effects, {
      spellName: "Mage Hand",
      spellList,
      mode: "known",
      summary: "Mage Hand known cantrip",
    });
  }
}

function parseAlwaysPreparedSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const inferredSpellLists = parseSpellLists(text);
  const spellList = inferredSpellLists.length === 1 ? inferredSpellLists[0] : undefined;

  const addAlwaysPrepared = (spellName: string, requiredLevel?: number) => {
    addSpellGrantEffect(source, effects, {
      spellName,
      spellList,
      mode: "always_prepared",
      requiredLevel,
      summary: `${spellName.trim().replace(/^the\s+/i, "")} always prepared`,
    });
  };

  for (const match of text.matchAll(/always have\s+(.+?)\s+spells?\s+prepared/gi)) {
    const raw = match[1]?.trim();
    if (!raw || /^(certain|the listed)$/i.test(raw) || !looksLikePreparedSpellList(raw)) continue;
    splitNamedSpellList(raw).forEach(addAlwaysPrepared);
  }

  for (const match of text.matchAll(/when you reach (?:character|cleric|bard|druid|paladin|ranger|sorcerer|warlock|wizard|artificer) level\s+(\d+),?\s+you(?:\s+also)?\s+always have\s+(.+?)\s+spells?\s+prepared/gi)) {
    const requiredLevel = Number(match[1]);
    const raw = match[2]?.trim();
    if (!raw || !Number.isFinite(requiredLevel) || !looksLikePreparedSpellList(raw)) continue;
    splitNamedSpellList(raw).forEach((name) => addAlwaysPrepared(name, requiredLevel));
  }

  if (/always have that spell prepared/i.test(text) || /always have those spells prepared/i.test(text)) {
    effects
      .filter((effect): effect is SpellGrantEffect =>
        effect.type === "spell_grant"
        && effect.mode === "known"
        && !/cantrip/i.test(effect.summary ?? "")
      )
      .forEach((effect) => addAlwaysPrepared(effect.spellName, effect.requiredLevel));
  }

  const tableMatch = text.match(/(?:[A-Za-z' ]+ Spells?)\s*:\s*(?:Spell Level|[A-Za-z]+ Level)\s*\|\s*(?:Prepared\s+)?Spells?\s+(.+)/i);
  if (!/listed spells prepared/i.test(text) || !tableMatch?.[1]) return;

  for (const row of tableMatch[1].matchAll(/(\d+)\s*\|\s*([^|]+?)(?=\s+\d+\s*\||$)/g)) {
    const requiredLevel = Number(row[1]);
    const rawNames = row[2]?.trim();
    if (!rawNames || !Number.isFinite(requiredLevel)) continue;
    rawNames
      .split(/\s*,\s*/)
      .map((name) => name.replace(/\*/g, "").trim())
      .filter(Boolean)
      .forEach((name) => addAlwaysPrepared(name, requiredLevel));
  }
}

function parseExpandedListSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (!/added to (?:that feature's|your) spell list/i.test(text)) return;
  const tableMatch = text.match(/(?:[A-Za-z' ]+ Spells?)\s*:\s*(?:Spell Level|[A-Za-z]+ Level)\s*\|\s*(?:Prepared\s+)?Spells?\s+(.+)/i);
  if (!tableMatch?.[1]) return;
  const rowsText = tableMatch[1];
  for (const row of rowsText.matchAll(/(\d+)\s*\|\s*([^|]+?)(?=\s+\d+\s*\||$)/g)) {
    const requiredLevel = Number(row[1]);
    const rawNames = row[2]?.trim();
    if (!rawNames || !Number.isFinite(requiredLevel)) continue;
    rawNames
      .split(/\s*,\s*/)
      .map((name) => name.replace(/\*/g, "").trim())
      .filter(Boolean)
      .forEach((spellName) => {
        addSpellGrantEffect(source, effects, {
          spellName,
          mode: "expanded_list",
          requiredLevel,
          summary: `${spellName} added to spell list`,
        });
      });
  }
}

function pushFreeCastSpellEffects(
  source: FeatureEffectSource,
  effects: FeatureEffect[],
  spellNames: string[],
  args: {
    uses: ScalingValue;
    reset: SpellGrantEffect["reset"];
    noMaterialComponents?: boolean;
  }
) {
  for (const spellName of spellNames) {
    if (!spellName || hasSpellGrantEffect(effects, spellName, "free_cast")) continue;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: args.uses,
      reset: args.reset,
      castsWithoutSlot: true,
      noMaterialComponents: args.noMaterialComponents,
      resourceKey,
      summary: `${spellName} free casts`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: args.uses,
      reset: args.reset ?? "long_rest",
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    } satisfies ResourceGrantEffect);
  }
}

function parseRitualOnlySpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  for (const match of text.matchAll(/you can cast\s+(?:the\s+)?(.+?)\s+spells?\s+but only as rituals?\b/gi)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    const spellNames = splitNamedSpellList(raw);
    for (const spellName of spellNames) {
      if (hasSpellGrantEffect(effects, spellName, "known")) continue;
      addSpellGrantEffect(source, effects, {
        spellName,
        mode: "known",
        riderSummary: "Ritual only. No spell slot required.",
        summary: `${spellName} ritual casting`,
      });
    }
  }
}

export function parseSpellGrantEffects(
  source: FeatureEffectSource,
  text: string,
  effects: FeatureEffect[],
  options?: { suppressStructuredSpellGrants?: boolean },
) {
  parseKnownSpellGrantEffects(source, text, effects);
  if (!options?.suppressStructuredSpellGrants) {
    parseAlwaysPreparedSpellGrantEffects(source, text, effects);
    parseExpandedListSpellGrantEffects(source, text, effects);
  }
  parseRitualOnlySpellGrantEffects(source, text, effects);
  if (!/without expending a spell slot/i.test(text)) return;
  const reset =
    /finish a short or long rest/i.test(text) ? "short_or_long_rest"
    : /finish a short rest/i.test(text) ? "short_rest"
    : /finish a long rest/i.test(text) ? "long_rest"
    : undefined;
  const abilityCountMatch = text.match(/a number of times equal to your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+modifier\s*\(minimum of once\)/i);
  const proficiencyCountMatch = text.match(/a number of times equal to your\s+Proficiency Bonus/i);
  const fixedCountMatch = text.match(/\b(once|twice|one|two|three|four|five|six)\b[^.]*without expending a spell slot/i);
  const noMaterialComponents = /without (?:a |needing )?Material components/i.test(text);
  const preparedSpellNames = effects
    .filter((effect): effect is SpellGrantEffect => effect.type === "spell_grant" && effect.mode === "always_prepared")
    .map((effect) => effect.spellName);
  const uniquePreparedSpellNames = Array.from(new Set(preparedSpellNames));

  const pronounTargetSpellNames =
    /cast (?:it|that spell) without expending a spell slot/i.test(text) && uniquePreparedSpellNames.length > 0 ? uniquePreparedSpellNames.slice(-1)
    : /cast (?:it|that spell) once without expending a spell slot/i.test(text) && uniquePreparedSpellNames.length > 0 ? uniquePreparedSpellNames.slice(-1)
    : [];
  const eachPreparedSpellNames =
    /cast each spell once without (?:expending a spell slot|a spell slot)/i.test(text) ? uniquePreparedSpellNames
    : /cast each of these spells without expending a spell slot/i.test(text) ? uniquePreparedSpellNames
    : /cast either spell without expending a spell slot/i.test(text) ? uniquePreparedSpellNames
    : [];
  const inferredSingleUsePreparedSpellNames =
    reset && eachPreparedSpellNames.length > 0 && (
      /once you cast either spell in this way/i.test(text)
      || /you must finish a (?:Short or Long|Long|Short) Rest before you can cast each spell in this way again/i.test(text)
      || /you can't cast that spell in this way again until you finish a (?:Short or Long|Long|Short) Rest/i.test(text)
    ) ? eachPreparedSpellNames : [];

  if (reset && abilityCountMatch && (pronounTargetSpellNames.length > 0 || eachPreparedSpellNames.length > 0)) {
    const ability = abilityCountMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const spellNames = eachPreparedSpellNames.length > 0 ? eachPreparedSpellNames : pronounTargetSpellNames;
    pushFreeCastSpellEffects(source, effects, spellNames, {
      uses: { kind: "ability_mod", ability, min: 1 },
      reset,
      noMaterialComponents,
    });
    return;
  }

  if (reset && proficiencyCountMatch && (pronounTargetSpellNames.length > 0 || eachPreparedSpellNames.length > 0)) {
    const spellNames = eachPreparedSpellNames.length > 0 ? eachPreparedSpellNames : pronounTargetSpellNames;
    pushFreeCastSpellEffects(source, effects, spellNames, {
      uses: { kind: "proficiency_bonus" },
      reset,
      noMaterialComponents,
    });
    return;
  }

  if (reset && fixedCountMatch && (pronounTargetSpellNames.length > 0 || eachPreparedSpellNames.length > 0)) {
    const spellNames = eachPreparedSpellNames.length > 0 ? eachPreparedSpellNames : pronounTargetSpellNames;
    pushFreeCastSpellEffects(source, effects, spellNames, {
      uses: { kind: "fixed", value: parseWordCount(fixedCountMatch[1]) ?? 1 },
      reset,
      noMaterialComponents,
    });
    return;
  }

  if (inferredSingleUsePreparedSpellNames.length > 0) {
    pushFreeCastSpellEffects(source, effects, inferredSingleUsePreparedSpellNames, {
      uses: { kind: "fixed", value: 1 },
      reset,
      noMaterialComponents,
    });
    return;
  }

  const spellMatch = text.match(/you can cast\s+([A-Z][A-Za-z' -]+?)\s+without expending a spell slot/i);
  if (!spellMatch) return;

  const spellName = spellMatch[1].replace(/\s+on yourself$/i, "").trim();
  if (/^(?:it|that spell|either spell|each spell|these spells?)\b/i.test(spellName)) return;

  if (abilityCountMatch && reset) {
    const ability = abilityCountMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: { kind: "ability_mod", ability, min: 1 },
      reset,
      castsWithoutSlot: true,
      noMaterialComponents,
      resourceKey,
      summary: `${spellName} free cast keyed off ${ability.toUpperCase()} modifier`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "ability_mod", ability, min: 1 },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    } satisfies ResourceGrantEffect);
    return;
  }

  if (fixedCountMatch && reset) {
    const max = parseWordCount(fixedCountMatch[1]) ?? 1;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: { kind: "fixed", value: max },
      reset,
      castsWithoutSlot: true,
      noMaterialComponents,
      resourceKey,
      summary: `${spellName} fixed free casts`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "fixed", value: max },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    } satisfies ResourceGrantEffect);
    return;
  }

  if (proficiencyCountMatch && reset) {
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: { kind: "proficiency_bonus" },
      reset,
      castsWithoutSlot: true,
      noMaterialComponents,
      resourceKey,
      summary: `${spellName} free casts keyed off Proficiency Bonus`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "proficiency_bonus" },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    } satisfies ResourceGrantEffect);
    return;
  }

  addSpellGrantEffect(source, effects, {
    spellName,
    mode: "at_will",
    castsWithoutSlot: true,
    summary: `${spellName} at will`,
  });
}

export function parseItemCanCastSpellEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (source.kind !== "item") return;
  const reset =
    /next dawn|at dawn|finish a long rest/i.test(text) ? "long_rest"
    : /finish a short or long rest/i.test(text) ? "short_or_long_rest"
    : /finish a short rest/i.test(text) ? "short_rest"
    : undefined;
  const hasLimitedUseLanguage =
    /once used|can't be used again|can't cast .* again until|once per /i.test(text);

  for (const match of text.matchAll(/you can cast\s+([^.;!?]+)/gi)) {
    const clause = String(match[1] ?? "").trim();
    if (!clause || /\bbut only as rituals?\b/i.test(clause)) continue;
    const saveDcMatch = clause.match(/\(\s*save dc\s*(\d+)\s*\)/i);
    const candidate = clause
      .replace(/\(\s*save dc\s*\d+\s*\)/gi, "")
      .replace(/\s+at will\b/gi, "")
      .trim();
    const spellNames = splitNamedSpellList(candidate);
    if (spellNames.length === 0) continue;
    const atWill = /\bat will\b/i.test(clause);

    for (const spellName of spellNames) {
      if (atWill) {
        if (hasSpellGrantEffect(effects, spellName, "at_will")) continue;
        addSpellGrantEffect(source, effects, {
          spellName,
          mode: "at_will",
          riderSummary: saveDcMatch ? `Save DC ${saveDcMatch[1]}.` : undefined,
          summary: `${spellName} at will`,
        });
        continue;
      }
      if (hasLimitedUseLanguage || reset) {
        if (hasSpellGrantEffect(effects, spellName, "free_cast")) continue;
        const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
        addSpellGrantEffect(source, effects, {
          spellName,
          mode: "free_cast",
          uses: { kind: "fixed", value: 1 },
          reset: reset ?? "long_rest",
          castsWithoutSlot: true,
          resourceKey,
          riderSummary: saveDcMatch ? `Save DC ${saveDcMatch[1]}.` : undefined,
          summary: `${spellName} item cast`,
        });
        effects.push({
          id: createFeatureEffectId(source, "resource_grant", effects.length),
          type: "resource_grant",
          source,
          resourceKey,
          label: `${spellName} (${source.name})`,
          max: { kind: "fixed", value: 1 },
          reset: reset ?? "long_rest",
          restoreAmount: "all",
          linkedSpellName: spellName,
          summary: `${spellName} resource pool`,
        } satisfies ResourceGrantEffect);
      }
    }
  }

  if (/cast one of the following spells/i.test(text) && /\(\d+\s*charges?\)/i.test(text)) {
    const chargePool = Number(text.match(/has\s+(\d+)\s+charges?/i)?.[1] ?? 0);
    const chargeReset =
      /next dawn|at dawn|daily at dawn|regains? .* at dawn/i.test(text) ? "long_rest"
      : reset ?? "long_rest";
    const sharedResourceKey = normalizeResourceKey(`${source.name}:charges`);
    if (chargePool > 0 && !hasResourceGrantEffect(effects, sharedResourceKey)) {
      effects.push({
        id: createFeatureEffectId(source, "resource_grant", effects.length),
        type: "resource_grant",
        source,
        resourceKey: sharedResourceKey,
        label: `${source.name} Charges`,
        max: { kind: "fixed", value: chargePool },
        reset: chargeReset,
        restoreAmount: "all",
        summary: `${source.name} charge pool`,
      } satisfies ResourceGrantEffect);
    }

    for (const match of text.matchAll(/([A-Za-z][A-Za-z' -]+)\s*\((\d+)\s*charges?\)/gi)) {
      const spellName = toTitleCase(String(match[1] ?? "").trim());
      const chargeCost = Number(match[2] ?? 0);
      if (!spellName || chargeCost <= 0 || hasSpellGrantEffect(effects, spellName, "free_cast")) continue;
      addSpellGrantEffect(source, effects, {
        spellName,
        mode: "free_cast",
        uses: chargePool > 0 ? { kind: "fixed", value: chargePool } : { kind: "fixed", value: 1 },
        reset: chargeReset,
        castsWithoutSlot: true,
        resourceKey: chargePool > 0 ? sharedResourceKey : undefined,
        riderSummary: `Costs ${chargeCost} charge${chargeCost === 1 ? "" : "s"}.`,
        summary: `${spellName} item cast`,
      });
    }
  }
}
