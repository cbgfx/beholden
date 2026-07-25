import React from "react";
import { Drawer } from "@/components/overlay/Drawer";
import { useStore } from "@/store";
import { getDrawerTitle } from "@/drawers/drawerTitle";
import { getDrawerRegistration } from "@/drawers/registry";

type HostProps = {
  refreshAll: () => Promise<void>;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
  refreshEncounter: (eid: string | null) => Promise<void>;
};

function DrawerLoadingFallback(props: { title: string; close: () => void }) {
  return (
    <Drawer title={props.title} isOpen onClose={props.close}>
      <div style={{ opacity: 0.7 }}>Loading…</div>
    </Drawer>
  );
}

export function DrawerHost(props: HostProps) {
  const { state, dispatch } = useStore();
  const d = state.drawer;

  const close = React.useCallback(() => dispatch({ type: "closeDrawer" }), [dispatch]);

  if (!d) return null;

  const title = getDrawerTitle(d);

  const reg = getDrawerRegistration(d, title, props, close);
  if (!reg) return null;

  return (
    <React.Suspense key={reg.key} fallback={<DrawerLoadingFallback title={title} close={close} />}>
      {reg.element}
    </React.Suspense>
  );
}
