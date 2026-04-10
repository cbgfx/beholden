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

const CAMPAIGN_COLOR_PRESETS = [
  "#a78bfa", // purple (default)
  "#38b6ff", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ff5d5d", // red
  "#8b5cf6", // violet
  "#fb7185", // rose
  "#f97316", // orange
  "#d946ef", // fuchsia
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#6366f1", // indigo
  "#d08ce9", // light purple
  "#68b38c", // sage
  "#d4b24c", // gold
  "#8f46d9", // deep violet
  "#ff6b3d", // coral
  "#5bc0eb", // sky
  "#94a3b8", // slate
  "#cf4444", // crimson
];

export function NameDrawer(props: {
  drawer: NameDrawerState;
  close: () => void;
  refreshAll: () => Promise<void>;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string | null>(null);

  React.useEffect(() => {
    const d = props.drawer;
    setName("");
    setColor(null);
    switch (d.type) {
      case "editCampaign": {
        const c = state.campaigns.find((x) => x.id === d.campaignId);
        if (c) {
          setName(c.name);
          setColor(c.color ?? null);
        }
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
        await api(`/api/campaigns/${d.campaignId}`, jsonInit("PUT", { name: safeName("Campaign"), color }));
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
  }, [name, color, props, state.selectedAdventureId, state.selectedCampaignId]);

  const isEditCampaign = props.drawer.type === "editCampaign";

  return {
    body: (
      <div style={{ display: "grid", gap: 16 }}>
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

        {isEditCampaign && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Theme color</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CAMPAIGN_COLOR_PRESETS.map((c) => {
                const selected = color === c || (!color && c === "#a78bfa");
                return (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    title={c}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: c,
                      border: selected
                        ? `2px solid #fff`
                        : "2px solid transparent",
                      boxShadow: selected ? `0 0 0 2px ${c}` : "none",
                      cursor: "pointer",
                      padding: 0,
                      flexShrink: 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}
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
