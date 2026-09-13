// Canonical id/title registry for the character sheet's top-level movable
// panels. Reused as both the CollapsiblePanel `storageKey` (collapse-state
// persistence) and, later, the drag-and-drop layout id — keeping id and
// display name in exactly one place instead of scattered string literals.

export const PANEL_IDS = {
  abilitiesSaves: "abilities-saves",
  skills: "skills",
  defenses: "defenses",
  proficiencies: "proficiencies",
  combatStats: "combat-stats",
  actions: "actions",
  itemSpells: "item-spells",
  spells: "spells",
  inventory: "inventory",
  recovery: "recovery",
  playerNotes: "player-notes",
  counters: "counters",
  sharedNotes: "shared-notes",
  playerFeatures: "player-features",
  creatures: "creatures",
} as const;

export type PanelId = (typeof PANEL_IDS)[keyof typeof PANEL_IDS];
export const MOVABLE_PANEL_IDS = Object.values(PANEL_IDS).filter((id) => id !== PANEL_IDS.combatStats) as PanelId[];

export const PANEL_TITLES: Record<PanelId, string> = {
  [PANEL_IDS.abilitiesSaves]: "Abilities & Saves",
  [PANEL_IDS.skills]: "Skills",
  [PANEL_IDS.defenses]: "Defenses",
  [PANEL_IDS.proficiencies]: "Proficiencies & Languages",
  [PANEL_IDS.combatStats]: "Combat Stats",
  [PANEL_IDS.actions]: "Actions",
  [PANEL_IDS.itemSpells]: "Item Spells",
  [PANEL_IDS.spells]: "Spells",
  [PANEL_IDS.inventory]: "Inventory",
  [PANEL_IDS.recovery]: "Upkeep",
  [PANEL_IDS.playerNotes]: "Player Notes",
  [PANEL_IDS.counters]: "Counters",
  [PANEL_IDS.sharedNotes]: "Shared Notes",
  [PANEL_IDS.playerFeatures]: "Features",
  [PANEL_IDS.creatures]: "Creatures",
};

/** A player-defined (or seeded-default) sheet view: how many columns it has
 * and which panel ids sit in each, in order. Persisted at
 * `characterData.sheetViews`. A panel id absent from every column of `layout`
 * simply isn't placed in this view (see the edit-mode palette sidebar). */
export interface SheetViewDef {
  id: string;
  name: string;
  /** 2-5. */
  columns: number;
  /** One array of panel ids per column, index = order within that column. */
  layout: PanelId[][];
}
