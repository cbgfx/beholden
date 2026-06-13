import React from "react";
import { Drawer } from "@/components/overlay/Drawer";
import { useStore } from "@/store";
import { getDrawerTitle } from "@/drawers/drawerTitle";
import { getDrawerRegistration } from "@/drawers/registry";
import type { DrawerContent } from "@/drawers/types";
import type { DrawerState } from "@/store";

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

  const reg = getDrawerRegistration(d, props, close);
  if (!reg) return null;

  return (
    <DrawerWrapper
      key={reg.key}
      drawer={d}
      title={title}
      close={close}
      {...props}
      getContent={reg.getContent}
    />
  );
}
