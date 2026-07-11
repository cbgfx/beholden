import type { Db } from "./db.js";
import { condenseTreasureText } from "../services/compendium/nativeCompendiumV2.monster.js";

/**
 * Self-healing startup fixup: monsters used to store their "Treasure" hoard-hint text as just
 * another entry in the generic `traits` array (indistinguishable from "Fire Aura", "Illumination",
 * etc). It's now a dedicated `treasure` field so it can be surfaced separately (e.g. in the combat
 * Rewards modal) instead of rendering inline with the rest of the traits list. This moves any
 * still-embedded "Treasure" trait out of `traits` and into `treasure` for rows imported before that
 * change, and condenses it down to just its hoard-category tag(s) (the text itself is a fixed DMG
 * glossary blurb, not per-monster content — see `condenseTreasureText`). Idempotent and cheap
 * (no-op once fixed).
 */
export function extractMonsterTreasureTraits(db: Db): void {
  const rows = db
    .prepare("SELECT id, data_json FROM compendium_monsters WHERE data_json LIKE '%reasure%'")
    .all() as Array<{ id: string; data_json: string }>;
  if (rows.length === 0) return;

  const update = db.prepare("UPDATE compendium_monsters SET data_json = ? WHERE id = ?");
  for (const row of rows) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(row.data_json);
    } catch {
      continue;
    }
    let changed = false;

    if (!parsed.treasure && Array.isArray(parsed.traits)) {
      const traits = parsed.traits as Array<Record<string, unknown>>;
      const index = traits.findIndex((t) => /^treasure$/i.test(String(t?.name ?? "").trim()));
      if (index !== -1) {
        const treasureTrait = traits[index]!;
        const remaining = traits.filter((_, i) => i !== index);
        if (remaining.length > 0) {
          parsed.traits = remaining;
        } else {
          delete parsed.traits;
        }
        parsed.treasure = treasureTrait.description;
        changed = true;
      }
    }

    if (typeof parsed.treasure === "string") {
      const condensed = condenseTreasureText(parsed.treasure);
      if (condensed !== parsed.treasure) {
        parsed.treasure = condensed;
        changed = true;
      }
    }

    if (!changed) continue;
    update.run(JSON.stringify(parsed), row.id);
  }
}
