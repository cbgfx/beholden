import { normalizeCharacterClassEntries } from "@beholden/shared/domain/characterClasses";
import { buildInitialHpProgressionHistory } from "@beholden/shared/domain/progressionHp";
import type { Db } from "../db.js";
import { progressionOccurrenceId, type ProgressionSelectionOccurrence } from "@beholden/shared/domain/progressionOwnership";

const VERSION = 2;

export function migrateCharacterProgression(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS character_progression_migration_report (
    character_id TEXT NOT NULL,
    issue_code TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (character_id, issue_code)
  )`);
  const rows = db.prepare(`SELECT id, class_name AS className, level, hp_max AS hpMax, con_score AS conScore, character_data_json AS json FROM user_characters`).all() as Array<{ id: string; className: string; level: number; hpMax: number; conScore: number | null; json: string | null }>;
  const update = db.prepare("UPDATE user_characters SET character_data_json = ? WHERE id = ?");
  const report = db.prepare("INSERT OR REPLACE INTO character_progression_migration_report (character_id, issue_code, detail, created_at) VALUES (?, ?, ?, ?)");
  const migrate = db.transaction(() => {
    for (const row of rows) {
      let data: Record<string, unknown>;
      try { data = JSON.parse(row.json ?? "{}") as Record<string, unknown>; } catch { data = {}; }
      if (Number(data.progressionSchemaVersion) >= VERSION) continue;
      const repairIssues: Array<{ code: string; message: string }> = [];
      const classes = normalizeCharacterClassEntries(Array.isArray(data.classes) && data.classes.length
        ? data.classes
        : [{ className: row.className || "Unknown", level: row.level || 1 }]);
      const primary = classes[0];
      const scoped = data.classSpellSelections && typeof data.classSpellSelections === "object" && !Array.isArray(data.classSpellSelections)
        ? { ...(data.classSpellSelections as Record<string, unknown>) } : {};
      if (primary && scoped[primary.id] == null) scoped[primary.id] = {
        chosenCantrips: Array.isArray(data.chosenCantrips) ? data.chosenCantrips : [],
        chosenSpells: Array.isArray(data.chosenSpells) ? data.chosenSpells : [],
        chosenInvocations: Array.isArray(data.chosenInvocations) ? data.chosenInvocations : [],
        preparedSpells: Array.isArray(data.preparedSpells) ? data.preparedSpells : [],
      };
      const rawFeats = Array.isArray(data.chosenLevelUpFeats) ? data.chosenLevelUpFeats : [];
      const migratedFeats = rawFeats.map((raw) => {
        if (!raw || typeof raw !== "object") return raw;
        const entry = raw as Record<string, unknown>;
        if (typeof entry.classEntryId === "string" && classes.some((candidate) => candidate.id === entry.classEntryId)) return entry;
        if (classes.length === 1 && primary) {
          const classLevel = Math.max(1, Math.trunc(Number(entry.classLevel ?? entry.level) || 1));
          return { ...entry, level: classLevel, classEntryId: primary.id, classLevel, characterLevel: Math.max(classLevel, Math.trunc(Number(entry.characterLevel) || classLevel)), sourceFeatureId: entry.sourceFeatureId ?? `class:${primary.id}:asi:${classLevel}` };
        }
        const message = "One or more legacy ASI/feat records could not be assigned to a class.";
        report.run(row.id, "ambiguous-feat-ownership", message, Date.now());
        if (!repairIssues.some((issue) => issue.code === "ambiguous-feat-ownership")) repairIssues.push({ code: "ambiguous-feat-ownership", message });
        return entry;
      });
      let hpProgressionHistory = data.hpProgressionHistory;
      if (!Array.isArray(hpProgressionHistory) || hpProgressionHistory.length === 0) {
        if (classes.length === 1 && primary) {
          hpProgressionHistory = buildInitialHpProgressionHistory({ level: row.level || primary.level, hitDie: Math.max(1, Number(data.hd) || 8), constitution: row.conScore ?? 10, hpMax: row.hpMax, classEntryId: primary.id, hpMethod: "manual" });
        } else {
          const message = "Legacy multiclass HP has no per-class history and was preserved without invented ownership.";
          report.run(row.id, "ambiguous-hp-ownership", message, Date.now());
          repairIssues.push({ code: "ambiguous-hp-ownership", message });
        }
      }
      let progressionSelectionOccurrences = Array.isArray(data.progressionSelectionOccurrences)
        ? data.progressionSelectionOccurrences as ProgressionSelectionOccurrence[] : [];
      if (progressionSelectionOccurrences.length === 0) {
        const legacySelections = [
          ...(Array.isArray(data.chosenInvocations) ? data.chosenInvocations : []).map((valueId) => ({ kind: "invocation" as const, valueId: String(valueId) })),
          ...(Array.isArray(data.chosenOptionals) ? data.chosenOptionals : []).map((valueId) => ({ kind: "optional" as const, valueId: String(valueId) })),
          ...(Array.isArray(data.extraFeatIds) ? data.extraFeatIds : []).map((valueId) => ({ kind: "extra-feat" as const, valueId: String(valueId) })),
        ];
        if (legacySelections.length && classes.length === 1 && primary) {
          progressionSelectionOccurrences = legacySelections.map((entry, ordinal) => ({
            occurrenceId: progressionOccurrenceId({ ...entry, sourceKey: `class:${primary.id}:legacy`, classEntryId: primary.id, classLevel: null, ordinal }),
            ...entry, sourceKey: `class:${primary.id}:legacy`, classEntryId: primary.id,
            classLevel: null, characterLevel: null,
          }));
        } else if (legacySelections.length && classes.length > 1) {
          const message = "Legacy repeatable selections could not be assigned to a class occurrence.";
          report.run(row.id, "ambiguous-selection-ownership", message, Date.now());
          repairIssues.push({ code: "ambiguous-selection-ownership", message });
        }
      }
      const next = { ...data, progressionSchemaVersion: VERSION, classes, classSpellSelections: scoped, chosenLevelUpFeats: migratedFeats, progressionSelectionOccurrences, progressionReplacementEvents: Array.isArray(data.progressionReplacementEvents) ? data.progressionReplacementEvents : [], ...(Array.isArray(hpProgressionHistory) ? { hpProgressionHistory } : {}), ...(repairIssues.length ? { progressionRepairIssues: repairIssues } : {}) };
      update.run(JSON.stringify(next), row.id);
    }
  });
  migrate();
}
