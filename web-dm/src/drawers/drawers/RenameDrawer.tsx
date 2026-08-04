import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { api, jsonInit } from "@/services/api";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { putEncounter } from "@/services/encounterApi";

type RenameDrawerState = Exclude<
  Extract<
    DrawerState,
    | { type: "createAdventure"; campaignId: string }
    | { type: "editAdventure"; adventureId: string }
    | { type: "createEncounter"; adventureId: string }
    | { type: "editEncounter"; encounterId: string }
  >,
  null
>;

// A single-field rename/create drawer for Adventures and Encounters. Campaigns need color/Binder/
// current-date/active-status fields alongside the name, so they get their own CampaignNameDrawer.
export function RenameDrawer(props: {
  drawer: RenameDrawerState;
  close: () => void;
}): DrawerContent {
  const { state } = useStore();
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    const d = props.drawer;
    setName("");
    switch (d.type) {
      case "editAdventure": {
        const a = state.adventures.find((x) => x.id === d.adventureId);
        if (a) setName(a.name);
        break;
      }
      case "editEncounter": {
        const e = state.encounters.find((x) => x.id === d.encounterId);
        if (e) setName(e.name);
        break;
      }
      default:
        break;
    }
  }, [props.drawer, state.adventures, state.encounters]);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    const safeName = (fallback: string) => {
      const s = name.trim();
      return s.length ? s : fallback;
    };

    switch (d.type) {
      case "createAdventure":
        await api(`/api/campaigns/${d.campaignId}/adventures`, jsonInit("POST", { name: safeName("New Adventure") }));
        props.close();
        return;
      case "editAdventure":
        await api(`/api/adventures/${d.adventureId}`, jsonInit("PUT", { name: safeName("Adventure") }));
        props.close();
        return;
      case "createEncounter":
        await api(`/api/adventures/${d.adventureId}/encounters`, jsonInit("POST", { name: safeName("New Encounter") }));
        props.close();
        return;
      case "editEncounter":
        await putEncounter(d.encounterId, { name: safeName("Encounter") });
        props.close();
        return;
      default:
        props.close();
    }
  }, [name, props]);

  return {
    body: (
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Name</div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Name"
          />
        </div>
      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={props.close}>
          Cancel
        </Button>
        <Button onClick={submit}>Save</Button>
      </div>
    )
  };
}
