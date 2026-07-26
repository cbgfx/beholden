import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { api, jsonInit } from "@/services/api";
import { fetchBinders, type BinderSummary } from "@/services/binderApi";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { putEncounter } from "@/services/encounterApi";
import { ENTITY_COLOR_PRESETS } from "@/theme/colorPresets";

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
  const [color, setColor] = React.useState<string | null>("#f59e0b");
  const [binders, setBinders] = React.useState<BinderSummary[]>([]);
  const [binderId, setBinderId] = React.useState("");
  const [currentDateText, setCurrentDateText] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  React.useEffect(() => {
    const d = props.drawer;
    setName("");
    setColor("#f59e0b");
    setBinderId("");
    setCurrentDateText("");
    setIsActive(true);
    switch (d.type) {
      case "editCampaign": {
        const c = state.campaigns.find((x) => x.id === d.campaignId);
        if (c) {
          setName(c.name);
          setColor(c.color ?? null);
          setBinderId(c.binderId ?? "");
          setCurrentDateText(c.currentDate?.text ?? "");
          setIsActive(c.isActive);
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

  React.useEffect(() => {
    if (props.drawer.type !== "editCampaign") return;
    let cancelled = false;
    fetchBinders()
      .then((rows) => {
        if (!cancelled) setBinders(rows);
      })
      .catch(() => {
        if (!cancelled) setBinders([]);
      });
    return () => {
      cancelled = true;
    };
  }, [props.drawer]);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    const safeName = (fallback: string) => {
      const s = name.trim();
      return s.length ? s : fallback;
    };

    switch (d.type) {
      case "createCampaign":
        await api(`/api/campaigns`, jsonInit("POST", { name: safeName("New Campaign"), color }));
        props.close();
        return;
      case "editCampaign": {
        await api(`/api/campaigns/${d.campaignId}`, jsonInit("PUT", { name: safeName("Campaign"), color, isActive }));
        await api(`/api/campaigns/${d.campaignId}/binder`, jsonInit("PUT", {
          binderId: binderId || null,
          currentDateText: currentDateText.trim() || null,
          currentDateSort: /^-?\d+$/.test(currentDateText.trim()) ? Number(currentDateText.trim()) : null,
        }));
        await props.refreshAll();
        props.close();
        return;
      }
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
  }, [name, color, binderId, currentDateText, isActive, props]);

  const showColorPicker = props.drawer.type === "editCampaign" || props.drawer.type === "createCampaign";

  return {
    body: (
      <div style={{ display: "grid", gap: 18 }}>
        {showColorPicker ? (
          <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, letterSpacing: "0.08em", opacity: 0.55 }}>
            CAMPAIGN
          </div>
        ) : null}
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

        {showColorPicker && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Theme color</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {ENTITY_COLOR_PRESETS.map((c) => {
                const selected = color === c || (!color && c === "#f59e0b");
                return (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    title={c}
                    style={{
                      width: 24,
                      height: 24,
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

        {props.drawer.type === "editCampaign" && (
          <>
            <div
              style={{
                borderTop: "1px solid rgba(148,163,184,0.18)",
                paddingTop: 16,
                fontSize: "var(--fs-small)",
                fontWeight: 800,
                letterSpacing: "0.08em",
                opacity: 0.55,
              }}
            >
              SETTING
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Binder</div>
              <Select style={{ width: "100%" }} value={binderId} onChange={(event) => setBinderId(event.target.value)}>
                <option value="">No Binder</option>
                {binders.map((binder) => (
                  <option key={binder.id} value={binder.id}>{binder.name}</option>
                ))}
              </Select>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Current date</div>
                <Input
                  value={currentDateText}
                  onChange={(event) => setCurrentDateText(event.target.value)}
                  placeholder="Uses Binder date"
                />
              </div>
            </div>
            <div style={{ marginTop: -8, fontSize: "var(--fs-small)", opacity: 0.6 }}>
              This campaign date may differ from the Binder’s setting-level reference date.
            </div>
            <div
              style={{
                borderTop: "1px solid rgba(148,163,184,0.18)",
                paddingTop: 16,
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, letterSpacing: "0.08em", opacity: 0.55 }}>
                STATUS
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                <span>
                  <strong>Active</strong>
                  <span style={{ display: "block", fontSize: "var(--fs-small)", opacity: 0.55 }}>
                    Inactive campaigns are kept in Archived.
                  </span>
                </span>
              </label>
            </div>
          </>
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
