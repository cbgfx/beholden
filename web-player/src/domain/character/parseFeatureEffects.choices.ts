import { createFeatureEffectId, type FeatureEffect, type FeatureEffectSource, type SpellChoiceEffect } from "@/domain/character/featureEffects";
import { parseSpellLists, parseSpellSchools, parseWordCount, SPELL_LIST_NAMES } from "@/domain/character/parseFeatureEffects.normalizers";

function pushSpellChoiceEffect(
  source: FeatureEffectSource,
  effects: FeatureEffect[],
  args: { count: number; level: number; spellLists: string[]; schools?: string[]; note?: string }
) {
  if (args.count <= 0 || args.spellLists.length === 0) return;
  effects.push({
    id: createFeatureEffectId(source, "spell_choice", effects.length),
    type: "spell_choice",
    source,
    mode: "learn",
    count: { kind: "fixed", value: args.count },
    level: args.level,
    spellLists: args.spellLists,
    schools: args.schools,
    note: args.note,
    summary: `Choose ${args.count} ${args.level === 0 ? "cantrip" : `level ${args.level} spell`}${args.count === 1 ? "" : "s"} from ${args.spellLists.join(", ")}`,
  } satisfies SpellChoiceEffect);
}

export function parseSpellChoiceEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  let lastSpellLists: string[] = [];

  if (/choose one of your known warlock cantrips that deals damage/i.test(text)) {
    pushSpellChoiceEffect(source, effects, {
      count: 1,
      level: 0,
      spellLists: ["Warlock"],
      note: "Must be one of your known Warlock cantrips that deals damage.",
    });
  }

  if (/choose one of your known warlock cantrips that deals damage via an attack roll/i.test(text)) {
    pushSpellChoiceEffect(source, effects, {
      count: 1,
      level: 0,
      spellLists: ["Warlock"],
      note: "Must be one of your known Warlock cantrips that deals damage via an attack roll.",
    });
  }

  for (const match of text.matchAll(/choose\s+(\w+)\s+cantrips?,\s+and\s+choose\s+(\w+)\s+level\s+(\d+)\s+spells?\s+that\s+have\s+the\s+ritual\s+tag[^.]*from\s+any\s+class'?s\s+spell\s+list/gi)) {
    const cantripCount = parseWordCount(match[1]) ?? 0;
    const spellCount = parseWordCount(match[2]) ?? 0;
    const spellLevel = Number(match[3]);
    if (cantripCount > 0) {
      pushSpellChoiceEffect(source, effects, {
        count: cantripCount,
        level: 0,
        spellLists: [...SPELL_LIST_NAMES],
        note: "From any class spell list.",
      });
    }
    if (spellCount > 0 && Number.isFinite(spellLevel)) {
      pushSpellChoiceEffect(source, effects, {
        count: spellCount,
        level: spellLevel,
        spellLists: [...SPELL_LIST_NAMES],
        note: "Must have the Ritual tag. From any class spell list.",
      });
    }
  }

  for (const match of text.matchAll(/you\s+(?:know|learn)\s+(\w+)\s+(?:extra\s+)?cantrips?(?:\s+of\s+your\s+choice)?\s+from\s+the\s+([^.]+?)\s+spell\s+list/gi)) {
    const count = parseWordCount(match[1]) ?? 0;
    const spellLists = parseSpellLists(match[2]);
    if (spellLists.length === 0) continue;
    lastSpellLists = spellLists;
    pushSpellChoiceEffect(source, effects, { count, level: 0, spellLists });
  }

  for (const match of text.matchAll(/you\s+(?:also\s+)?learn\s+(\w+)\s+level\s+(\d+)\s+spells?(?:\s+of\s+your\s+choice)?\s+from\s+(?:the\s+([^.]+?)\s+spell\s+list|that\s+list)/gi)) {
    const count = parseWordCount(match[1]) ?? 0;
    const level = Number(match[2]);
    const spellLists = match[3] ? parseSpellLists(match[3]) : lastSpellLists;
    if (!Number.isFinite(level) || spellLists.length === 0) continue;
    if (match[3]) lastSpellLists = spellLists;
    pushSpellChoiceEffect(source, effects, { count, level, spellLists });
  }

  for (const match of text.matchAll(/choose\s+(\w+)\s+([A-Z][A-Za-z]+)\s+spells?\s+from\s+the\s+([A-Za-z\s,]+?)\s+school(?:s)?(?:\s+of\s+magic)?,\s+each of which must be no higher than level\s+(\d+)/gi)) {
    const count = parseWordCount(match[1]) ?? 0;
    const spellLists = parseSpellLists(match[2]);
    const schools = parseSpellSchools(match[3]);
    const level = Number(match[4]);
    if (!Number.isFinite(level) || spellLists.length === 0 || schools.length === 0 || count <= 0) continue;
    pushSpellChoiceEffect(source, effects, {
      count,
      level,
      spellLists,
      schools,
      note: "At or below the listed level.",
    });
  }

  for (const match of text.matchAll(/if you already know (?:it|that cantrip), you learn a different ([A-Z][A-Za-z]+) cantrip of your choice/gi)) {
    const spellLists = parseSpellLists(match[1]);
    if (spellLists.length === 0) continue;
    pushSpellChoiceEffect(source, effects, {
      count: 1,
      level: 0,
      spellLists,
      note: "Replacement cantrip if you already know the named cantrip.",
    });
  }
}
