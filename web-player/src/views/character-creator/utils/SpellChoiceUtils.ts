export interface SharedSpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

function spellLooksLikeDamageSpell(spell: { name?: string | null; text?: string | null }): boolean {
  const text = String(spell.text ?? "");
  const name = String(spell.name ?? "");
  return /\bdeal(?:s|ing)?\b.*\bdamage\b/i.test(text)
    || /\btakes?\b.*\bdamage\b/i.test(text)
    || /\b\d+d\d+\b/.test(text)
    || /eldritch blast|poison spray|fire bolt|ray of frost|chill touch|sacred flame|acid splash|mind sliver|toll the dead|vicious mockery|word of radiance|primal savagery|thorn whip|shocking grasp/i.test(name);
}

function spellUsesAttackRoll(spell: { text?: string | null }): boolean {
  const text = String(spell.text ?? "");
  return /spell attack|ranged spell attack|melee spell attack|make a ranged attack|make a melee attack/i.test(text);
}

export interface SharedSpellListChoiceEntry {
  key: string;
  count: number;
  options: string[];
  sourceLabel?: string | null;
}

export interface SharedResolvedSpellChoiceEntry {
  key: string;
  title: string;
  sourceLabel?: string | null;
  count: number;
  level: number | null;
  note?: string | null;
  linkedTo?: string | null;
  dependsOnChoiceId?: string | null;
  dependencyKind?: "spell_list" | "ability_score" | "replacement" | null;
  replacementFor?: string | null;
  listNames: string[];
  schools?: string[];
  ritualOnly?: boolean;
}

export interface SharedSpellChoiceLike {
  id: string;
  count: number;
  countFrom?: "proficiency_bonus" | null;
  options: string[] | null;
  level?: number | null;
  linkedTo?: string | null;
  dependsOnChoiceId?: string | null;
  dependencyKind?: "spell_list" | "ability_score" | "replacement" | null;
  replacementFor?: string | null;
  note?: string | null;
}

export const FEAT_SPELL_LIST_NAMES = new Set(["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"]);

function normalizeSpellOptionKey(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s*\[[^\]]+\]\s*$/u, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function choiceCountAtLevel(choice: { count: number; countFrom?: "proficiency_bonus" | null }, level: number): number {
  if (choice.countFrom === "proficiency_bonus") {
    return Math.max(1, Math.ceil(Math.max(1, level) / 4) + 1);
  }
  return Math.max(0, Number(choice.count ?? 0) || 0);
}

export function inferSpellListFromSourceLabel(sourceLabel: string | null | undefined, options?: string[] | null): string | null {
  if (!sourceLabel) return null;

  const allowed = new Set(options ?? Array.from(FEAT_SPELL_LIST_NAMES));
  const parenMatches = Array.from(sourceLabel.matchAll(/\(([^)]+)\)/g))
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  for (const candidate of parenMatches) {
    if (allowed.has(candidate)) return candidate;
  }

  return null;
}

export function buildSpellListChoiceEntry(args: {
  key: string;
  choice: SharedSpellChoiceLike;
  level: number;
  sourceLabel?: string | null;
}): SharedSpellListChoiceEntry {
  const { key, choice, level, sourceLabel } = args;
  const options = choice.options ?? [];
  const inferred = inferSpellListFromSourceLabel(sourceLabel, options);
  return {
    key,
    count: choiceCountAtLevel(choice, level),
    options: inferred ? [inferred] : options,
    sourceLabel,
  };
}

export function buildResolvedSpellChoiceEntry(args: {
  key: string;
  choice: SharedSpellChoiceLike;
  level: number;
  sourceLabel?: string | null;
  chosenOptions: Record<string, string[]>;
  linkedChoiceKey?: string | null;
}): SharedResolvedSpellChoiceEntry {
  const { key, choice, level, sourceLabel, chosenOptions, linkedChoiceKey } = args;
  const directOptions = choice.options ?? [];
  const schools = directOptions.filter((name) => !FEAT_SPELL_LIST_NAMES.has(name));
  const effectiveLinkedChoiceKey = linkedChoiceKey ?? (choice.dependsOnChoiceId ? key.replace(`:${choice.id}`, `:${choice.dependsOnChoiceId}`) : null);
  const listNames = effectiveLinkedChoiceKey
    ? (() => {
        const selected = (chosenOptions[effectiveLinkedChoiceKey] ?? []).filter((name) => FEAT_SPELL_LIST_NAMES.has(name));
        if (selected.length > 0) return selected;
        const inferred = inferSpellListFromSourceLabel(sourceLabel);
        return inferred ? [inferred] : [];
      })()
    : directOptions.filter((name) => FEAT_SPELL_LIST_NAMES.has(name));

  return {
    key,
    title: (choice.level ?? 0) === 0 ? "Cantrip Choice" : "Spell Choice",
    sourceLabel,
    count: choiceCountAtLevel(choice, level),
    level: choice.level ?? null,
    note: choice.note,
    linkedTo: effectiveLinkedChoiceKey ?? null,
    dependsOnChoiceId: choice.dependsOnChoiceId ?? choice.linkedTo ?? null,
    dependencyKind: choice.dependencyKind ?? (effectiveLinkedChoiceKey ? "spell_list" : null),
    replacementFor: choice.replacementFor ?? null,
    listNames,
    schools: schools.length > 0 ? schools : undefined,
    ritualOnly: /ritual tag/i.test(choice.note ?? ""),
  };
}

export async function loadSpellChoiceOptions(
  choices: SharedResolvedSpellChoiceEntry[],
  fetchSpells: (query: string) => Promise<SharedSpellSummary[]>,
): Promise<Record<string, SharedSpellSummary[]>> {
  const buildSearchQuery = (args: {
    classes?: string;
    level?: number;
    minLevel?: number;
    maxLevel?: number;
    schoolQuery: string;
    ritualQuery: string;
    limit: number;
    includeText: boolean;
  }): string => {
    const parts: string[] = ["/api/spells/search?excludeSpecial=1"];
    if (args.classes) parts.push(`&classes=${args.classes}`);
    if (typeof args.level === "number") parts.push(`&level=${args.level}`);
    if (typeof args.minLevel === "number") parts.push(`&minLevel=${args.minLevel}`);
    if (typeof args.maxLevel === "number") parts.push(`&maxLevel=${args.maxLevel}`);
    if (args.schoolQuery) parts.push(args.schoolQuery);
    if (args.ritualQuery) parts.push(args.ritualQuery);
    parts.push(`&limit=${args.limit}`);
    parts.push(args.includeText ? "&includeText=1" : "&compact=1");
    return parts.join("");
  };

  const entries = await Promise.all(
    choices.map(async (choice) => {
      const requiresText = /deals damage/i.test(choice.note ?? "");
      const groups = await Promise.all(
        choice.listNames.map(async (listName) => {
          const encoded = encodeURIComponent(listName);
          const schoolQuery = choice.schools?.length ? `&school=${encodeURIComponent(choice.schools.join(","))}` : "";
          const ritualQuery = choice.ritualOnly ? "&ritual=1" : "";
          if ((choice.level ?? 0) === 0) {
            return fetchSpells(buildSearchQuery({
              classes: encoded,
              level: 0,
              schoolQuery,
              ritualQuery,
              limit: 140,
              includeText: requiresText,
            })).catch(() => []);
          }
          if (typeof choice.level === "number" && /\bat or below\b/i.test(choice.note ?? "")) {
            return fetchSpells(buildSearchQuery({
              classes: encoded,
              minLevel: 1,
              maxLevel: choice.level,
              schoolQuery,
              ritualQuery,
              limit: 220,
              includeText: requiresText,
            })).catch(() => []);
          }
          if (typeof choice.level === "number") {
            return fetchSpells(buildSearchQuery({
              classes: encoded,
              level: choice.level,
              schoolQuery,
              ritualQuery,
              limit: 220,
              includeText: requiresText,
            })).catch(() => []);
          }
          return fetchSpells(buildSearchQuery({
            classes: encoded,
            schoolQuery,
            ritualQuery,
            limit: 220,
            includeText: requiresText,
          })).catch(() => []);
        })
      );

      if (groups.length === 0) {
        const schoolQuery = choice.schools?.length ? `&school=${encodeURIComponent(choice.schools.join(","))}` : "";
        const ritualQuery = choice.ritualOnly ? "&ritual=1" : "";
        const query = (choice.level ?? 0) === 0
          ? buildSearchQuery({ level: 0, schoolQuery, ritualQuery, limit: 200, includeText: requiresText })
          : typeof choice.level === "number" && /\bat or below\b/i.test(choice.note ?? "")
            ? buildSearchQuery({ minLevel: 1, maxLevel: choice.level, schoolQuery, ritualQuery, limit: 280, includeText: requiresText })
            : typeof choice.level === "number"
              ? buildSearchQuery({ level: choice.level, schoolQuery, ritualQuery, limit: 280, includeText: requiresText })
              : buildSearchQuery({ schoolQuery, ritualQuery, limit: 280, includeText: requiresText });
        groups.push(await fetchSpells(query).catch(() => []));
      }

      const byName = new Map<string, SharedSpellSummary>();
      for (const spell of groups.flat()) {
        if (!spell?.name) continue;
        byName.set(spell.name.toLowerCase(), spell);
      }
      let options = Array.from(byName.values()).filter(
        (spell) => !/^invocation:/i.test(String(spell.name ?? ""))
      );
      if (/deals damage via an attack roll/i.test(choice.note ?? "")) {
        options = options.filter((spell) => spellLooksLikeDamageSpell(spell) && spellUsesAttackRoll(spell));
      } else if (/deals damage/i.test(choice.note ?? "")) {
        options = options.filter((spell) => spellLooksLikeDamageSpell(spell));
      }
      return [choice.key, options.sort((a, b) => a.name.localeCompare(b.name))] as const;
    })
  );

  return Object.fromEntries(entries);
}

export function resolveSelectedSpellOptionEntries(
  selectedValues: string[],
  options: SharedSpellSummary[],
): SharedSpellSummary[] {
  const byId = new Map(options.map((spell) => [String(spell.id), spell]));
  const byName = new Map(options.map((spell) => [normalizeSpellOptionKey(spell.name), spell]));
  const resolved = new Map<string, SharedSpellSummary>();

  for (const value of selectedValues) {
    const direct = byId.get(String(value));
    if (direct) {
      resolved.set(String(direct.id), direct);
      continue;
    }
    const bySavedName = byName.get(normalizeSpellOptionKey(value));
    if (bySavedName) resolved.set(String(bySavedName.id), bySavedName);
  }

  return Array.from(resolved.values());
}

export function sanitizeSpellChoiceSelections(args: {
  currentSelections: Record<string, string[]>;
  spellListChoices: SharedSpellListChoiceEntry[];
  resolvedSpellChoices: SharedResolvedSpellChoiceEntry[];
  spellOptionsByKey: Record<string, SharedSpellSummary[]>;
}): Record<string, string[]> {
  const { currentSelections, spellListChoices, resolvedSpellChoices, spellOptionsByKey } = args;
  const nextSelections = { ...currentSelections };

  for (const choice of spellListChoices) {
    const current = nextSelections[choice.key] ?? [];
    const filtered = current.filter((value) => choice.options.includes(value)).slice(0, choice.count);
    const inferred = inferSpellListFromSourceLabel(choice.sourceLabel, choice.options);
    const next =
      filtered.length > 0
        ? filtered
        : choice.count === 1 && choice.options.length === 1
          ? choice.options.slice(0, 1)
          : inferred && choice.count === 1
            ? [inferred]
            : [];
    if (next.length === 0) delete nextSelections[choice.key];
    else nextSelections[choice.key] = next;
  }

  for (const choice of resolvedSpellChoices) {
    const current = nextSelections[choice.key] ?? [];
    const resolved = resolveSelectedSpellOptionEntries(current, spellOptionsByKey[choice.key] ?? []);
    const filtered = resolved.map((spell) => String(spell.id)).slice(0, choice.count);
    if (filtered.length === 0) delete nextSelections[choice.key];
    else nextSelections[choice.key] = filtered;
  }

  return nextSelections;
}
