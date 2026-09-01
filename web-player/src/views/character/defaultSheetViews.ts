import { PANEL_IDS, type SheetViewDef } from "@/views/character/panelRegistry";

/**
 * The 4 built-in views, reproducing today's exact Play/Gear/Reference/All
 * arrangement. `id` intentionally matches the legacy `SheetView` string union
 * (`CharacterSheetHeader.tsx`) so the existing view-selection state can index
 * straight into this data until the view switcher itself is generalized.
 *
 * Seeded into new characters at creation. Existing characters use a cloned
 * in-memory fallback and persist it the first time they customize a view.
 */
export const DEFAULT_SHEET_VIEWS: SheetViewDef[] = [
  {
    id: "play",
    name: "Combat",
    columns: 3,
    layout: [
      [PANEL_IDS.abilitiesSaves, PANEL_IDS.skills, PANEL_IDS.defenses, PANEL_IDS.proficiencies],
      [PANEL_IDS.actions, PANEL_IDS.itemSpells, PANEL_IDS.spells],
      [PANEL_IDS.recovery, PANEL_IDS.counters, PANEL_IDS.creatures, PANEL_IDS.playerFeatures],
    ],
  },
  {
    id: "gear",
    name: "Gear",
    columns: 2,
    layout: [
      [PANEL_IDS.abilitiesSaves, PANEL_IDS.skills, PANEL_IDS.defenses, PANEL_IDS.proficiencies],
      [PANEL_IDS.inventory],
    ],
  },
  {
    id: "reference",
    name: "Reference",
    columns: 2,
    layout: [
      [PANEL_IDS.abilitiesSaves, PANEL_IDS.skills, PANEL_IDS.defenses, PANEL_IDS.proficiencies],
      [PANEL_IDS.recovery, PANEL_IDS.counters, PANEL_IDS.playerNotes, PANEL_IDS.sharedNotes, PANEL_IDS.playerFeatures],
    ],
  },
  {
    id: "all",
    name: "All",
    columns: 4,
    layout: [
      [PANEL_IDS.abilitiesSaves, PANEL_IDS.skills, PANEL_IDS.defenses, PANEL_IDS.proficiencies],
      [PANEL_IDS.actions, PANEL_IDS.itemSpells, PANEL_IDS.spells],
      [PANEL_IDS.inventory],
      [PANEL_IDS.recovery, PANEL_IDS.counters, PANEL_IDS.creatures, PANEL_IDS.playerNotes, PANEL_IDS.sharedNotes, PANEL_IDS.playerFeatures],
    ],
  },
];
