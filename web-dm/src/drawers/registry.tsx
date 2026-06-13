import type React from "react";
import type { DrawerContent } from "@/drawers/types";
import type { DrawerState } from "@/store";

import { NameDrawer } from "@/drawers/drawers/NameDrawer";
import { NoteDrawer } from "@/drawers/drawers/NoteDrawer";
import { PlayerDrawer } from "@/drawers/drawers/PlayerDrawer";
import { INpcDrawer } from "@/drawers/drawers/INpcDrawer";
import { CombatantDrawer } from "@/drawers/drawers/CombatantDrawer";
import { CombatantOverridesDrawer } from "@/drawers/drawers/CombatantOverridesDrawer";
import { CombatantConditionsDrawer } from "@/drawers/drawers/CombatantConditionsDrawer";
import { TreasureDrawer } from "@/drawers/drawers/TreasureDrawer";
import { SpellDrawer } from "@/drawers/drawers/SpellDrawer";
import { SpellBookDrawer } from "@/drawers/drawers/SpellBookDrawer";
import { AdventureNotesDrawer } from "@/drawers/drawers/AdventureNotesDrawer";
import { PolymorphDrawer } from "@/drawers/drawers/PolymorphDrawer";

export type DrawerHostProps = {
  refreshAll: () => Promise<void>;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
  refreshEncounter: (eid: string | null) => Promise<void>;
};

export type DrawerRegistration = {
  /** Used for keyed wrappers so hooks stay stable per drawer type. */
  key: React.Key;
  getContent: () => DrawerContent;
};

export function getDrawerRegistration(
  drawer: Exclude<DrawerState, null>,
  props: DrawerHostProps,
  close: () => void
): DrawerRegistration | null {
  switch (drawer.type) {
    case "createCampaign":
    case "editCampaign":
    case "createAdventure":
    case "editAdventure":
    case "createEncounter":
    case "editEncounter":
      return {
        key: drawer.type,
        getContent: () =>
          NameDrawer({
            drawer,
            close,
            refreshAll: props.refreshAll,
            refreshCampaign: props.refreshCampaign,
            refreshAdventure: props.refreshAdventure
          })
      };

    case "note":
    case "editNote":
      return {
        key: drawer.type,
        getContent: () =>
          NoteDrawer({
            drawer: drawer,
            close,
            refreshCampaign: props.refreshCampaign,
            refreshAdventure: props.refreshAdventure
          })
      };

    case "createPlayer":
    case "editPlayer":
      return {
        key: drawer.type,
        getContent: () =>
          PlayerDrawer({
            drawer: drawer,
            close,
            refreshCampaign: props.refreshCampaign
          })
      };

    case "editINpc":
      return {
        key: drawer.type,
        getContent: () =>
          INpcDrawer({
            drawer: drawer,
            close,
            refreshCampaign: props.refreshCampaign
          })
      };

    case "editCombatant":
      return {
        key: drawer.type,
        getContent: () =>
          CombatantDrawer({
            drawer: drawer,
            close,
            refreshEncounter: props.refreshEncounter
          })
      };

    case "combatantOverrides":
      return {
        key: drawer.type,
        getContent: () =>
          CombatantOverridesDrawer({
            drawer: drawer,
            close,
            refreshEncounter: props.refreshEncounter
          })
      };

    case "combatantConditions":
      return {
        key: drawer.type,
        getContent: () =>
          CombatantConditionsDrawer({
            drawer: drawer,
            close,
            refreshEncounter: props.refreshEncounter
          })
      };

    case "viewTreasure":
      return {
        key: drawer.type + drawer.treasureId,
        getContent: () =>
          TreasureDrawer({
            drawer: drawer,
            close
          })
      };

    case "viewSpell":
      return {
        key: drawer.type + drawer.spellId,
        getContent: () =>
          SpellDrawer({
            drawer: drawer,
            close
          })
      };

    case "spellbook":
      return {
        key: drawer.type,
        getContent: () =>
          SpellBookDrawer({
            close
          })
      };

    case "adventureNotes":
      return {
        key: drawer.type,
        getContent: () =>
          AdventureNotesDrawer({
            close
          })
      };

    case "polymorphTransform":
      return {
        key: drawer.type + drawer.combatantId,
        getContent: () =>
          PolymorphDrawer({
            drawer: drawer,
            close,
            refreshEncounter: props.refreshEncounter
          })
      };

    default:
      return null;
  }
}
