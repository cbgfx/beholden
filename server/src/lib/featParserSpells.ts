import type { ParsedFeatChoice, ParsedFeatGrants } from "./featParserTypes.js";
import {
  KNOWN_CANTRIPS,
  addIfMissing,
  pushChoice,
  splitSentences,
  splitList,
  uniq,
  wordToNumber,
} from "./featParserSupport.js";

export function pushSpellChoice(
  choices: ParsedFeatChoice[],
  args: {
    idPrefix: string;
    count?: number;
    level: number | null;
    options: string[] | null;
    linkedTo?: string | null;
    dependencyKind?: ParsedFeatChoice["dependencyKind"];
    replacementFor?: string | null;
    note: string;
  },
) {
  pushChoice(choices, {
    id: `${args.idPrefix}_${choices.length + 1}`,
    type: "spell",
    count: args.count ?? 1,
    options: args.options,
    level: args.level,
    linkedTo: args.linkedTo ?? null,
    dependsOnChoiceId: args.linkedTo ?? null,
    dependencyKind: args.dependencyKind ?? (args.linkedTo ? "spell_list" : null),
    replacementFor: args.replacementFor ?? null,
    note: args.note,
  });
}

export function parseSpellListChoiceParagraph(paragraph: string, choices: ParsedFeatChoice[], grants: ParsedFeatGrants): boolean {
  // "Choose a class: bard, cleric, druid, sorcerer, warlock, or wizard.
  //  You learn two cantrips of your choice from that class's spell list.
  //  In addition, choose one 1st-level spell from that same list."
  const classChoiceMatch = paragraph.match(/Choose a class[:\s]+([^.]+)\./i);
  const cantripsFromClassMatch = paragraph.match(/You learn (\w+) cantrips? of your choice from that class'?s spell list/i);
  if (classChoiceMatch && cantripsFromClassMatch) {
    const classes = splitList(classChoiceMatch[1] ?? "");
    if (classes.length > 0) {
      const classListChoiceId = `class_spell_list_${choices.length + 1}`;
      pushChoice(choices, {
        id: classListChoiceId,
        type: "spell_list",
        count: 1,
        options: classes,
        dependsOnChoiceId: null,
        dependencyKind: null,
        replacementFor: null,
        note: "Choose a class spell list for this feat.",
      });
      pushSpellChoice(choices, {
        idPrefix: "cantrips_class_list",
        count: wordToNumber(cantripsFromClassMatch[1] ?? "1"),
        options: null,
        level: 0,
        linkedTo: classListChoiceId,
        note: "Choose cantrips from the selected class's spell list.",
      });
      const levelSpellMatch =
        paragraph.match(/choose (\w+)\s+(\d+)(?:st|nd|rd|th)[-\s]level spell(?:s)? from that same list/i) ??
        paragraph.match(/choose (\w+)\s+level (\d+) spell(?:s)? from that same list/i);
      if (levelSpellMatch) {
        pushSpellChoice(choices, {
          idPrefix: "spell_from_class_list",
          count: wordToNumber(levelSpellMatch[1] ?? "1"),
          options: null,
          level: Number(levelSpellMatch[2] ?? "1"),
          linkedTo: classListChoiceId,
          note: "Choose a spell from the selected class's spell list.",
        });
      }
      return true;
    }
  }

  let match = paragraph.match(/You (?:gain )?learn (\w+) cantrips? of your choice from the ([^.]+?) spell list/i);
  if (match) {
    const count = wordToNumber(match[1] ?? "1");
    const lists = splitList(match[2] ?? "");
    pushChoice(choices, {
      id: "spell_list_primary",
      type: "spell_list",
      count: 1,
      options: lists,
      dependsOnChoiceId: null,
      dependencyKind: null,
      replacementFor: null,
      note: "Choose the spell list for this feat.",
    });
    pushSpellChoice(choices, {
      idPrefix: "cantrips_primary",
      count,
      options: null,
      level: 0,
      linkedTo: "spell_list_primary",
      note: "Choose cantrips from the selected spell list.",
    });
    return true;
  }

  match = paragraph.match(/You know one cantrip of your choice from the ([^.]+?) spell list\.\s*Also, choose a level (\d+) spell from that spell list/i);
  if (match) {
    const lists = splitList(match[1] ?? "");
    pushSpellChoice(choices, {
      idPrefix: "single_cantrip",
      count: 1,
      options: lists,
      level: 0,
      note: "Choose a cantrip from the listed spell list.",
    });
    pushSpellChoice(choices, {
      idPrefix: "spell_from_same_list",
      count: 1,
      options: lists,
      level: Number(match[2] ?? "1"),
      note: "Choose a spell from the same spell list.",
    });
    return true;
  }

  match = paragraph.match(/You learn (\w+) spells? of your choice\.\s*These spells can come from the ([^.]+?) spell list(?:s)? or any combination thereof/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "spells_from_lists",
      count: wordToNumber(match[1] ?? "1"),
      options: splitList(match[2] ?? ""),
      level: null,
      note: "Choose spells from any of the listed spell lists.",
    });
    return true;
  }

  match = paragraph.match(/(?:You know|You learn) one extra cantrip from the ([^.]+?) spell list/i)
    ?? paragraph.match(/(?:You know|You learn) one cantrip of your choice from the ([^.]+?) spell list/i)
    ?? paragraph.match(/one cantrip from the ([^.]+?) spell list/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "single_cantrip",
      count: 1,
      options: splitList(match[1] ?? ""),
      level: 0,
      note: "Choose a cantrip from the listed spell list.",
    });
    return true;
  }

  match = paragraph.match(/Choose a level (\d+) spell from the same list you selected/i)
    ?? paragraph.match(/Also, choose a level (\d+) spell from that spell list/i)
    ?? paragraph.match(/You also learn one level (\d+) spell of your choice from that list/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "spell_from_same_list",
      count: 1,
      options: null,
      level: Number(match[1] ?? "1"),
      linkedTo: "spell_list_primary",
      note: "Choose a spell from the spell list selected earlier.",
    });
    return true;
  }

  match = paragraph.match(/Choose a number of level (\d+) spells equal to your Proficiency Bonus that have the Ritual tag/i);
  if (match) {
    pushChoice(choices, {
      id: `ritual_spells_${choices.length + 1}`,
      type: "spell",
      count: 1,
      countFrom: "proficiency_bonus",
      options: null,
      level: Number(match[1] ?? "1"),
      note: "Choose ritual spells of the stated level. The number of choices equals your Proficiency Bonus.",
    });
    return true;
  }

  match = paragraph.match(/Choose one level (\d+) spell from the ([^.]+?) school of magic\.\s*You always have that spell and the ([A-Z][A-Za-z' -]+?) spell prepared/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "spell_school",
      count: 1,
      options: splitList(match[2] ?? ""),
      level: Number(match[1] ?? "1"),
      note: "Choose a spell from one of the listed schools of magic.",
    });
    const fixedSpell = match[3]?.trim();
    if (fixedSpell) addIfMissing(grants.spells, [fixedSpell]);
    return true;
  }

  match = paragraph.match(/(?:Choose|learn|know|also learn|one) (?:one )?level (\d+) spell(?: of your choice)? from the ([^.]+?) (spell list|school of magic)/i)
    ?? paragraph.match(/Choose a level (\d+) or lower spell from the ([^.]+?) spell list/i);
  if (match) {
    const level = Number(match[1] ?? "1");
    const domain = (match[3] ?? "spell list").toLowerCase();
    pushSpellChoice(choices, {
      idPrefix: domain.includes("school") ? "spell_school" : "spell_list_pick",
      count: 1,
      options: splitList(match[2] ?? ""),
      level,
      note: domain.includes("school")
        ? "Choose a spell from one of the listed schools of magic."
        : /or lower/i.test(match[0] ?? "")
          ? "Choose a spell from one of the listed spell lists at or below the stated level."
          : "Choose a spell from one of the listed spell lists.",
    });
    return true;
  }

  match = paragraph.match(/If you already know (?:it|that cantrip), you learn a different ([^.]+?) cantrip of your choice/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "replacement_cantrip",
      count: 1,
      options: null,
      level: 0,
      dependencyKind: "replacement",
      replacementFor: "known_cantrip",
      note: "If you already know the granted cantrip, choose a different cantrip.",
    });
    return true;
  }

  return false;
}

function extractSpellNames(text: string): string[] {
  const cleaned = text
    .replace(/\bthe\b/gi, "")
    .replace(/\bspells?\b/gi, "")
    .replace(/\bcantrips?\b/gi, "")
    .replace(/\bprepared\b/gi, "")
    .replace(/[().:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return uniq(
    cleaned
      .replace(/\band\/or\b/gi, ",")
      .replace(/\band\b/gi, ",")
      .replace(/\bor\b/gi, ",")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => /^[A-Z][A-Za-z' -]+$/.test(part))
  );
}

function isKnownCantrip(name: string): boolean {
  return KNOWN_CANTRIPS.some((cantrip) => cantrip.toLowerCase() === name.toLowerCase());
}

export function addNamedSpellGrants(paragraph: string, grants: ParsedFeatGrants) {
  for (const sentence of splitSentences(paragraph)) {
    let match = sentence.match(/You (?:learn|know) the ([A-Z][A-Za-z' -]+?) spell/i);
    if (match) {
      const spellName = match[1]?.trim();
      if (spellName) {
        if (/\bcantrip\b/i.test(sentence) || isKnownCantrip(spellName)) addIfMissing(grants.cantrips, [spellName]);
        else addIfMissing(grants.spells, [spellName]);
      }
      continue;
    }

    match = sentence.match(/You always have (.+?) spells? prepared/i);
    if (match) {
      const text = String(match[1] ?? "").replace(/\bthat spell\b/gi, "").trim();
      addIfMissing(grants.spells, extractSpellNames(text));
      continue;
    }

    match = sentence.match(/You can cast (.+?) spells? but only as Rituals/i);
    if (match) {
      addIfMissing(grants.spells, extractSpellNames(match[1] ?? ""));
      continue;
    }

    match = sentence.match(/You can cast the ([A-Z][A-Za-z' -]+?) spell but only as a Ritual/i);
    if (match) {
      addIfMissing(grants.spells, [match[1]!.trim()]);
      continue;
    }

    match = sentence.match(/(?:You know|You learn) ([A-Z][A-Za-z' -]+?)\.?$/i);
    if (match) {
      const spellName = match[1]?.trim();
      if (spellName && isKnownCantrip(spellName)) addIfMissing(grants.cantrips, [spellName]);
    }
  }
}
