import React from "react";
import { Drawer } from "@/components/overlay/Drawer";
import { useStore } from "@/app/store";
import { getDrawerTitle } from "@/app/drawers/drawerTitle";
import { NameDrawer } from "@/app/drawers/drawers/NameDrawer";
import { NoteDrawer } from "@/app/drawers/drawers/NoteDrawer";
import { PlayerDrawer } from "@/app/drawers/drawers/PlayerDrawer";
import { INpcDrawer } from "@/app/drawers/drawers/INpcDrawer";
import { CombatantDrawer } from "@/app/drawers/drawers/CombatantDrawer";
import { CombatantOverridesDrawer } from "@/app/drawers/drawers/CombatantOverridesDrawer";
import { CombatantConditionsDrawer } from "@/app/drawers/drawers/CombatantConditionsDrawer";
import { TreasureDrawer } from "@/app/drawers/drawers/TreasureDrawer";
import type { DrawerContent } from "@/app/drawers/types";
import type { DrawerState } from "@/app/store";

type HostProps = {
  refreshAll: () => Promise<void>;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
  refreshEncounter: (eid: string | null) => Promise<void>;
};

type WrapperProps = HostProps & {
  drawer: Exclude<DrawerState, null>;
  close: () => void;
  title: string;
  getContent: () => DrawerContent;
};

/**
 * IMPORTANT:
 * Drawer implementations currently return { body, footer } and use React hooks.
 * If we call them directly inside DrawerHost's render, hooks would attach to DrawerHost
 * and break as drawer types change (rules-of-hooks/order).
 *
 * Solution: render a keyed wrapper component per drawer type. Each wrapper always calls
 * exactly one drawer implementation, so hook order is stable and isolated.
 */
function DrawerWrapper(props: WrapperProps) {
  const content = props.getContent();
  return (
    <Drawer title={props.title} isOpen={true} onClose={props.close} footer={content.footer}>
      {content.body}
    </Drawer>
  );
}

export function DrawerHost(props: HostProps) {
  const { state, dispatch } = useStore();
  const d = state.drawer;

  const close = React.useCallback(() => dispatch({ type: "closeDrawer" }), [dispatch]);

  if (!d) return null;

  const title = getDrawerTitle(d);

  switch (d.type) {
    case "createCampaign":
    case "editCampaign":
    case "createAdventure":
    case "editAdventure":
    case "createEncounter":
    case "editEncounter":
      return (
        <DrawerWrapper
          key={d.type}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            NameDrawer({
              drawer: d as any,
              close,
              refreshAll: props.refreshAll,
              refreshCampaign: props.refreshCampaign,
              refreshAdventure: props.refreshAdventure
            })
          }
        />
      );
    case "note":
    case "editNote": {
      return (
        <DrawerWrapper
          key={d.type}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            NoteDrawer({
              drawer: d as any,
              close,
              refreshCampaign: props.refreshCampaign,
              refreshAdventure: props.refreshAdventure
            })
          }
        />
      );
    }

    case "createPlayer":
    case "editPlayer": {
      return (
        <DrawerWrapper
          key={d.type}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            PlayerDrawer({
              drawer: d as any,
              close,
              refreshCampaign: props.refreshCampaign
            })
          }
        />
      );
    }

    case "editINpc": {
      return (
        <DrawerWrapper
          key={d.type}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            INpcDrawer({
              drawer: d as any,
              close,
              refreshCampaign: props.refreshCampaign
            })
          }
        />
      );
    }

    case "editCombatant": {
      return (
        <DrawerWrapper
          key={d.type}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            CombatantDrawer({
              drawer: d as any,
              close,
              refreshEncounter: props.refreshEncounter
            })
          }
        />
      );
    }

    case "combatantOverrides": {
      return (
        <DrawerWrapper
          key={d.type}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            CombatantOverridesDrawer({
              drawer: d as any,
              close,
              refreshEncounter: props.refreshEncounter
            })
          }
        />
      );
    }

    case "combatantConditions": {
      return (
        <DrawerWrapper
          key={d.type}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            CombatantConditionsDrawer({
              drawer: d as any,
              close,
              refreshEncounter: props.refreshEncounter
            })
          }
        />
      );
    }

    case "viewTreasure": {
      return (
        <DrawerWrapper
          key={d.type + d.treasureId}
          drawer={d}
          title={title}
          close={close}
          {...props}
          getContent={() =>
            TreasureDrawer({
              drawer: d as any,
              close
            })
          }
        />
      );
    }

    default:
      return null;
  }
}
