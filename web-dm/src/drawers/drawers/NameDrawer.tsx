import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { api, jsonInit } from "@/services/api";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";

type NameDrawerState = Exclude<
  Extract<
    DrawerState,
    | { type: "createCampaign" }
    | { type: "editCampaign"; campaignId: string }
    | { type: "createAdventure"; campaignId: string }
    | { type: "editAdventure"; adventureId: string }
    | { type: "createEncounter"; adventureId: string }
    | { type: "editEncounter"; encounterId: string }
  >,
  null
>;

export function NameDrawer(props: {
  drawer: NameDrawerState;
  close: () => void;
  refreshAll: () => Promise<void>;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [name, setName] = React.useState("");

  React.useEffect(() => {
    const d = props.drawer;
    setName("");
    switch (d.type) {
      case "editCampaign": {
        const c = state.campaigns.find((x) => x.id === d.campaignId);
        if (c) setName(c.name);
        break;
      }
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
  }, [props.drawer, state.adventures, state.campaigns, state.encounters]);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    const safeName = (fallback: string) => {
      const s = name.trim();
      return s.length ? s : fallback;
    };

    switch (d.type) {
      case "createCampaign":
        await api(`/api/campaigns`, jsonInit("POST", { name: safeName("New Campaign") }));
        await props.refreshAll();
        props.close();
        return;
      case "editCampaign":
        await api(`/api/campaigns/${d.campaignId}`, jsonInit("PUT", { name: safeName("Campaign") }));
        await props.refreshAll();
        props.close();
        return;
      case "createAdventure":
        await api(`/api/campaigns/${d.campaignId}/adventures`, jsonInit("POST", { name: safeName("New Adventure") }));
        await props.refreshCampaign(d.campaignId);
        props.close();
        return;
      case "editAdventure":
        await api(`/api/adventures/${d.adventureId}`, jsonInit("PUT", { name: safeName("Adventure") }));
        await props.refreshCampaign(state.selectedCampaignId);
        props.close();
        return;
      case "createEncounter":
        await api(`/api/adventures/${d.adventureId}/encounters`, jsonInit("POST", { name: safeName("New Encounter") }));
        await props.refreshAdventure(d.adventureId);
        props.close();
        return;
      case "editEncounter":
        await api(`/api/encounters/${d.encounterId}`, jsonInit("PUT", { name: safeName("Encounter") }));
        await props.refreshAdventure(state.selectedAdventureId);
        props.close();
        return;
      default:
        props.close();
    }
  }, [name, props, state.selectedAdventureId, state.selectedCampaignId]);

  return {
    body: (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Name</div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // QoL: drawers with a single "name" field should save on Enter.
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Name"
        />
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
