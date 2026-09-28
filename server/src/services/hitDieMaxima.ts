// server/src/services/hitDieMaxima.ts
// How many hit dice of each size a character has, from its stored classes: each class's die comes
// from its compendium entry, or - for a single-class character whose class is not in the
// compendium - from the die the sheet stored (`hd`). A class whose die cannot be found adds nothing.

import type Database from "better-sqlite3";

export function hitDieMaximaFor(
  db: Database.Database,
  characterData: Record<string, unknown> | null | undefined,
  ruleset: string,
): Map<number, number> {
  const classes = Array.isArray(characterData?.classes) ? characterData!.classes as Array<Record<string, unknown>> : [];
  const lookup = db.prepare("SELECT data_json FROM compendium_classes WHERE id = ? AND ruleset = ?");
  const maxima = new Map<number, number>();
  for (const entry of classes) {
    const level = Math.max(0, Math.floor(Number(entry?.level) || 0));
    if (level === 0) continue;
    let die: number | null = null;
    if (typeof entry.classId === "string") {
      const row = lookup.get(entry.classId, ruleset) as { data_json: string } | undefined;
      try { die = row ? Math.floor(Number((JSON.parse(row.data_json) as { hd?: unknown }).hd)) || null : null; } catch { die = null; }
    }
    if (!die && classes.length === 1) die = Math.floor(Number(characterData?.hd)) || null;
    if (!die || die <= 0) continue;
    maxima.set(die, (maxima.get(die) ?? 0) + level);
  }
  return maxima;
}
