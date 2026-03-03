import type { DrawerState } from "@/store";

export function getDrawerTitle(d: DrawerState): string {
  if (!d) return "";

  switch (d.type) {
    case "createCampaign":
      return "Create campaign";
    case "editCampaign":
      return "Edit campaign";
    case "createAdventure":
      return "Create adventure";
    case "editAdventure":
      return "Edit adventure";
    case "createEncounter":
      return "Create encounter";
    case "editEncounter":
      return "Edit encounter";
    case "note":
      return d.scope === "campaign" ? "New campaign note" : "New adventure note";
    case "editNote":
      return "Edit note";
    case "createPlayer":
      return "Create player";
    case "editPlayer":
      return "Edit player";
    case "editINpc":
      return "Edit iNPC";
    case "editCombatant":
      return "Edit combatant";
    case "combatantOverrides":
      return "Overrides";
    case "combatantConditions":
      return "Conditions";
    case "viewTreasure":
      return d.title;
    case "viewSpell":
      return d.title;
    case "spellbook":
      return "Spell Book";
    case "adventureNotes":
      return "Adventure Notes";
    default:
      return "Edit";
  }
}
