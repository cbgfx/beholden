// server/src/lib/referenceRegistry.ts
//
// Every reference in the schema that the database does NOT enforce with a foreign key, and what
// keeps it honest instead.
//
// This exists because the same bug kept turning up in different systems: one row points at another
// through a plain id column, the other row is deleted, and the first is left pointing at nothing -
// a ghost in the initiative order, a portrait on disk nobody owns, loot for a deleted encounter, Hex
// on a monster after the warlock has gone. Each time the cause was a reference nobody had decided
// how to keep valid.
//
// `referenceRegistry.test.ts` reads the real schema and fails if a `*_id` column has no foreign key
// and is not listed here, or if a migration adds a referencing column with ALTER TABLE (which cannot
// carry a foreign key on upgraded databases) without a registered compensation. So a new reference
// cannot be added without someone deciding, in writing, how it stays valid.
//
// Prefer a real foreign key. Only list something here when one is genuinely impossible.

export type UnenforcedReference = {
  table: string;
  column: string;
  /** What the id points at, in words. */
  target: string;
  /**
   * - `denormalized`: the row keeps its own copy of what it needs, so a missing target is tolerated
   *   by design and must be (the code falls back to the stored copy).
   * - `cleanedByCode`: nothing in the database follows the target; named code removes or clears the
   *   reference whenever the target goes, and the startup repair catches anything missed.
   * - `external`: an id in some other system; there is nothing here to point at.
   */
  kind: "denormalized" | "cleanedByCode" | "external";
  /** Why a foreign key is not possible, and what keeps it valid instead. */
  why: string;
};

export const UNENFORCED_REFERENCES: readonly UnenforcedReference[] = [
  {
    table: "combatants",
    column: "base_id",
    target: "players.id, compendium_monsters.id or inpcs.id, by base_type",
    kind: "cleanedByCode",
    why: "One column, three tables, so no foreign key can say which. Player and INPC combatants are "
      + "removed with their player or INPC through services/combat.removal.ts, and checkCombatIntegrity "
      + "repairs any left behind at startup. Monster combatants carry a full snapshot and are never "
      + "removed for a missing compendium entry: the compendium can be cleared and reimported.",
  },
  {
    table: "encounters",
    column: "combat_active_combatant_id",
    target: "combatants.id (whose turn it is)",
    kind: "cleanedByCode",
    why: "Deleting the combatant must hand the turn on, not just clear it, and only code knows the "
      + "initiative order. removeCombatant hands it on; checkCombatIntegrity clears any pointer at a "
      + "combatant that is not in the encounter; PUT combatState refuses one outside the encounter.",
  },
  {
    table: "inpcs",
    column: "monster_id",
    target: "compendium_monsters.id",
    kind: "denormalized",
    why: "Compendium monsters are keyed by id and ruleset together, so id alone cannot be a foreign "
      + "key. An INPC keeps its own name, hit points and AC.",
  },
  {
    table: "binder_npcs",
    column: "monster_id",
    target: "compendium_monsters.id",
    kind: "denormalized",
    why: "Same as inpcs.monster_id; the legacy foreign key was removed on purpose "
      + "(binderNpcMonsterForeignKeyMigration) because of the composite compendium key.",
  },
  {
    table: "treasure",
    column: "item_id",
    target: "compendium_items.id",
    kind: "denormalized",
    why: "Treasure keeps its own name, rarity and text; hydrateTreasureEntry falls back to them when "
      + "the compendium item is gone.",
  },
  {
    table: "party_inventory",
    column: "item_id",
    target: "compendium_items.id",
    kind: "denormalized",
    why: "A stash item keeps its own name, weight and description, as a character's inventory does.",
  },
  {
    table: "binder_external_ids",
    column: "external_id",
    target: "an id in the system the binder was imported from (Notion)",
    kind: "external",
    why: "Not a reference into this database.",
  },
  {
    table: "binder_record_mentions",
    column: "target_external_id",
    target: "an external id named in imported text",
    kind: "external",
    why: "Not a reference into this database.",
  },
];

/**
 * Columns a migration added with ALTER TABLE ... ADD COLUMN, where a fresh install declares a
 * foreign key that an upgraded database therefore does not have. Each must be compensated by
 * something that exists on every database - a trigger, installed by a named migration.
 */
export type UpgradeDrift = {
  table: string;
  column: string;
  /** The trigger that does on upgraded databases what the foreign key does on fresh ones. */
  trigger: string;
  migration: string;
};

export const UPGRADE_DRIFT: readonly UpgradeDrift[] = [
  {
    table: "treasure",
    column: "encounter_id",
    trigger: "treasure_follows_encounter_delete",
    migration: "treasureEncounterCascadeMigration.ts",
  },
];

// References stored inside JSON are not listed here: no schema check can see them, so
// services/maintenance/jsonReferences.ts checks them against the live data instead, and documents
// what keeps each one valid next to its check.
//
// Image files: the image_url columns on campaigns, players, user_characters, mortals and deities
// point at files under the data directory, which no foreign key can reach. Every delete path
// removes its file, and startup maintenance (services/images/orphanImages.ts) sweeps any orphans.
