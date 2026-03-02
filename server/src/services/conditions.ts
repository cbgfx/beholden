import { now } from "../lib/runtime.js";
import { normalizeKey } from "../lib/text.js";
import type { UserData } from "../server/context.js";

export function seedDefaultConditions(userData: UserData, campaignId: string): void {
  const defaults: string[] = [
    "Blinded",
    "Charmed",
    "Deafened",
    "Frightened",
    "Grappled",
    "Incapacitated",
    "Invisible",
    "Paralyzed",
    "Petrified",
    "Poisoned",
    "Prone",
    "Restrained",
    "Stunned",
    "Unconscious",
    "Hex",
    "Concentrating",
    "Marked",
  ];
  const t = now();
  let i = 0;
  for (const name of defaults) {
    i++;
    const nameKey = normalizeKey(name);
    const id = `cond_${campaignId}_${nameKey.replace(/\s/g, "_")}`;
    if (userData.conditions[id]) continue;
    userData.conditions[id] = {
      id,
      campaignId,
      key: nameKey,
      name,
      sort: i,
      createdAt: t,
      updatedAt: t,
    };
  }
}
