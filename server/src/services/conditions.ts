import { now } from "../lib/runtime.js";
import { normalizeKey } from "../lib/text.js";
import type { UserData } from "../server/context.js";

export function seedDefaultConditions(userData: UserData, campaignId: string): void {
  const defaults: Array<[string, "condition" | "spell" | "marker"]> = [
    ["Blinded", "condition"],
    ["Charmed", "condition"],
    ["Deafened", "condition"],
    ["Frightened", "condition"],
    ["Grappled", "condition"],
    ["Incapacitated", "condition"],
    ["Invisible", "condition"],
    ["Paralyzed", "condition"],
    ["Petrified", "condition"],
    ["Poisoned", "condition"],
    ["Prone", "condition"],
    ["Restrained", "condition"],
    ["Stunned", "condition"],
    ["Unconscious", "condition"],
    ["Hex", "spell"],
    ["Concentrating", "spell"],
    ["Marked", "marker"],
  ];
  const t = now();
  let i = 0;
  for (const tuple of defaults) {
    i++;
    const [name, category] = tuple;
    const nameKey = normalizeKey(name);
    const id = `cond_${campaignId}_${nameKey.replace(/\s/g, "_")}`;
    if (userData.conditions[id]) continue;
    userData.conditions[id] = {
      id,
      campaignId,
      name,
      nameKey,
      category,
      color: null,
      sortOrder: i,
      isBuiltin: true,
      createdAt: t,
      updatedAt: t,
    };
  }
}
