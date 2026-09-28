import type { ProgressionRequirement } from "./progressionRequirements.js";

/** Validate authored class records before tolerant legacy normalization can change them. */
export function classProgressionRequirements(classes: unknown, declaredLevel?: number): ProgressionRequirement[] {
  const problems: ProgressionRequirement[] = [];
  const fail = (id: string, message: string) => problems.push({ id, message, step: 6, state: "incomplete" });
  if (declaredLevel !== undefined && (!Number.isInteger(declaredLevel) || declaredLevel < 1 || declaredLevel > 20)) {
    fail("character-level", "Total character level must be a whole number from 1 to 20.");
  }
  // Legacy/classless characters may still have only a top-level level.
  if (classes === undefined) return problems;
  if (!Array.isArray(classes)) {
    fail("class-records", "Character classes must be a list.");
    return problems;
  }
  if (classes.length === 0) return problems;
  const identities = new Set<string>();
  const entryIds = new Set<string>();
  let total = 0;
  for (const [index, raw] of classes.entries()) {
    const key = `class-record:${index}`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      fail(key, "Each class must contain its identity and level.");
      continue;
    }
    const entry = raw as Record<string, unknown>;
    const classId = typeof entry.classId === "string" ? entry.classId.trim().toLowerCase() : "";
    const name = typeof entry.className === "string" ? entry.className.trim().toLowerCase() : "";
    const identity = classId ? `id:${classId}` : name ? `name:${name}` : "";
    if (!identity) fail(key, "Each class needs a class ID or name.");
    else if (identities.has(identity)) fail(key, "The same class cannot appear twice. Update its existing level instead.");
    else identities.add(identity);
    if (entry.id != null) {
      if (typeof entry.id !== "string" || !entry.id.trim()) fail(`${key}:id`, "Class entry IDs must be nonempty text.");
      else if (entryIds.has(entry.id.trim())) fail(`${key}:id`, "Each class entry must have a unique ID.");
      else entryIds.add(entry.id.trim());
    }
    if (typeof entry.level !== "number" || !Number.isInteger(entry.level) || entry.level < 1 || entry.level > 20) {
      fail(`${key}:level`, "Each class level must be a whole number from 1 to 20.");
    } else total += entry.level;
  }
  if (problems.length > 0) return problems;
  if (total > 20) fail("character-level", "Combined class levels cannot exceed 20.");
  else if (declaredLevel !== undefined && total !== declaredLevel) {
    fail("class-level-total", "Total character level must equal the sum of class levels.");
  }
  return problems;
}
