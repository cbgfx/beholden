import React from "react";
import { Drawer } from "@/components/overlay/Drawer";
import type { DrawerContent } from "@/drawers/types";
import type { DrawerState } from "@/store";

// Type-only imports are erased at build time, so these give us the drawer
// implementations' prop types below without pulling the (heavy) implementation
// modules into whatever chunk this file ends up in.
import type { NameDrawer as NameDrawerFn } from "@/drawers/drawers/NameDrawer";
import type { NoteDrawer as NoteDrawerFn } from "@/drawers/drawers/NoteDrawer";
import type { PlayerDrawer as PlayerDrawerFn } from "@/drawers/drawers/PlayerDrawer";
import type { INpcDrawer as INpcDrawerFn } from "@/drawers/drawers/INpcDrawer";
import type { CombatantDrawer as CombatantDrawerFn } from "@/drawers/drawers/CombatantDrawer";
import type { CombatantOverridesDrawer as CombatantOverridesDrawerFn } from "@/drawers/drawers/CombatantOverridesDrawer";
import type { CombatantConditionsDrawer as CombatantConditionsDrawerFn } from "@/drawers/drawers/CombatantConditionsDrawer";
import type { TreasureDrawer as TreasureDrawerFn } from "@/drawers/drawers/TreasureDrawer";
import type { SpellDrawer as SpellDrawerFn } from "@/drawers/drawers/SpellDrawer";
import type { SpellBookDrawer as SpellBookDrawerFn } from "@/drawers/drawers/SpellBookDrawer";
import type { AdventureNotesDrawer as AdventureNotesDrawerFn } from "@/drawers/drawers/AdventureNotesDrawer";
import type { PolymorphDrawer as PolymorphDrawerFn } from "@/drawers/drawers/PolymorphDrawer";

export type DrawerHostProps = {
  refreshAll: () => Promise<void>;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
  refreshEncounter: (eid: string | null) => Promise<void>;
};

export type DrawerRegistration = {
  /** Used for keyed elements so hooks stay stable per drawer type/identity. */
  key: React.Key;
  element: React.ReactNode;
};

/**
 * Lazily loads a drawer implementation (a function that returns { body, footer })
 * and wraps it in the shared Drawer shell, so the implementation's code — and its
 * hooks — only load once that drawer type is actually opened. React.lazy requires
 * a component (not a plain function call) for Suspense to work, so this produces
 * one: hooks attach to the Adapter's own fiber, which is fine because each drawer
 * type gets a stable, uniquely-keyed element (see getDrawerRegistration below).
 */
function lazyDrawer<P extends { close: () => void }>(
  load: () => Promise<(props: P) => DrawerContent>
) {
  return React.lazy(async () => {
    const fn = await load();
    function Adapter(props: P & { title: string }) {
      const content = fn(props);
      return (
        <Drawer title={props.title} isOpen onClose={props.close} footer={content.footer}>
          {content.body}
        </Drawer>
      );
    }
    return { default: Adapter };
  });
}

const LazyNameDrawer = lazyDrawer<Parameters<typeof NameDrawerFn>[0]>(() =>
  import("@/drawers/drawers/NameDrawer").then((m) => m.NameDrawer)
);
const LazyNoteDrawer = lazyDrawer<Parameters<typeof NoteDrawerFn>[0]>(() =>
  import("@/drawers/drawers/NoteDrawer").then((m) => m.NoteDrawer)
);
const LazyPlayerDrawer = lazyDrawer<Parameters<typeof PlayerDrawerFn>[0]>(() =>
  import("@/drawers/drawers/PlayerDrawer").then((m) => m.PlayerDrawer)
);
const LazyINpcDrawer = lazyDrawer<Parameters<typeof INpcDrawerFn>[0]>(() =>
  import("@/drawers/drawers/INpcDrawer").then((m) => m.INpcDrawer)
);
const LazyCombatantDrawer = lazyDrawer<Parameters<typeof CombatantDrawerFn>[0]>(() =>
  import("@/drawers/drawers/CombatantDrawer").then((m) => m.CombatantDrawer)
);
const LazyCombatantOverridesDrawer = lazyDrawer<Parameters<typeof CombatantOverridesDrawerFn>[0]>(() =>
  import("@/drawers/drawers/CombatantOverridesDrawer").then((m) => m.CombatantOverridesDrawer)
);
const LazyCombatantConditionsDrawer = lazyDrawer<Parameters<typeof CombatantConditionsDrawerFn>[0]>(() =>
  import("@/drawers/drawers/CombatantConditionsDrawer").then((m) => m.CombatantConditionsDrawer)
);
const LazyTreasureDrawer = lazyDrawer<Parameters<typeof TreasureDrawerFn>[0]>(() =>
  import("@/drawers/drawers/TreasureDrawer").then((m) => m.TreasureDrawer)
);
const LazySpellDrawer = lazyDrawer<Parameters<typeof SpellDrawerFn>[0]>(() =>
  import("@/drawers/drawers/SpellDrawer").then((m) => m.SpellDrawer)
);
const LazySpellBookDrawer = lazyDrawer<Parameters<typeof SpellBookDrawerFn>[0]>(() =>
  import("@/drawers/drawers/SpellBookDrawer").then((m) => m.SpellBookDrawer)
);
const LazyAdventureNotesDrawer = lazyDrawer<Parameters<typeof AdventureNotesDrawerFn>[0]>(() =>
  import("@/drawers/drawers/AdventureNotesDrawer").then((m) => m.AdventureNotesDrawer)
);
const LazyPolymorphDrawer = lazyDrawer<Parameters<typeof PolymorphDrawerFn>[0]>(() =>
  import("@/drawers/drawers/PolymorphDrawer").then((m) => m.PolymorphDrawer)
);

export function getDrawerRegistration(
  drawer: Exclude<DrawerState, null>,
  title: string,
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
        element: (
          <LazyNameDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshAll={props.refreshAll}
            refreshCampaign={props.refreshCampaign}
            refreshAdventure={props.refreshAdventure}
          />
        )
      };

    case "note":
    case "editNote":
      return {
        key: drawer.type,
        element: (
          <LazyNoteDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshCampaign={props.refreshCampaign}
            refreshAdventure={props.refreshAdventure}
          />
        )
      };

    case "createPlayer":
    case "editPlayer":
      return {
        key: drawer.type,
        element: (
          <LazyPlayerDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshCampaign={props.refreshCampaign}
          />
        )
      };

    case "editINpc":
      return {
        key: drawer.type,
        element: (
          <LazyINpcDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshCampaign={props.refreshCampaign}
          />
        )
      };

    case "editCombatant":
      return {
        key: drawer.type,
        element: (
          <LazyCombatantDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshEncounter={props.refreshEncounter}
          />
        )
      };

    case "combatantOverrides":
      return {
        key: drawer.type,
        element: (
          <LazyCombatantOverridesDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshEncounter={props.refreshEncounter}
          />
        )
      };

    case "combatantConditions":
      return {
        key: drawer.type,
        element: (
          <LazyCombatantConditionsDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshEncounter={props.refreshEncounter}
          />
        )
      };

    case "viewTreasure":
      return {
        key: drawer.type + drawer.treasureId,
        element: <LazyTreasureDrawer title={title} drawer={drawer} close={close} />
      };

    case "viewSpell":
      return {
        key: drawer.type + drawer.spellId,
        element: <LazySpellDrawer title={title} drawer={drawer} close={close} />
      };

    case "spellbook":
      return {
        key: drawer.type,
        element: <LazySpellBookDrawer title={title} close={close} />
      };

    case "adventureNotes":
      return {
        key: drawer.type,
        element: <LazyAdventureNotesDrawer title={title} close={close} />
      };

    case "polymorphTransform":
      return {
        key: drawer.type + drawer.combatantId,
        element: (
          <LazyPolymorphDrawer
            title={title}
            drawer={drawer}
            close={close}
            refreshEncounter={props.refreshEncounter}
          />
        )
      };

    default:
      return null;
  }
}
