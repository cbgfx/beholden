import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { api, jsonInit } from "@/services/api";
import { fetchBinders, createBinder, type BinderSummary } from "@/services/binderApi";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { ENTITY_COLOR_PRESETS } from "@/theme/colorPresets";

const NEW_BINDER_VALUE = "__new_binder__";

type CampaignNameDrawerState = Exclude<
  Extract<DrawerState, { type: "createCampaign" } | { type: "editCampaign"; campaignId: string }>,
  null
>;

export function CampaignNameDrawer(props: {
  drawer: CampaignNameDrawerState;
  close: () => void;
  refreshAll: () => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string | null>("#f59e0b");
  const [ruleset, setRuleset] = React.useState<"5e" | "5.5e">("5.5e");
  const [binders, setBinders] = React.useState<BinderSummary[]>([]);
  const [binderId, setBinderId] = React.useState("");
  const [currentDateText, setCurrentDateText] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [creatingNewBinder, setCreatingNewBinder] = React.useState(false);
  const [newBinderName, setNewBinderName] = React.useState("");
  const [newBinderDate, setNewBinderDate] = React.useState("");
  const [newBinderBusy, setNewBinderBusy] = React.useState(false);
  const [newBinderError, setNewBinderError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const d = props.drawer;
    setName("");
    setColor("#f59e0b");
    setRuleset("5.5e");
    setBinderId("");
    setCurrentDateText("");
    setIsActive(true);
    setCreatingNewBinder(false);
    setNewBinderName("");
    setNewBinderDate("");
    setNewBinderError(null);
    if (d.type === "editCampaign") {
      const c = state.campaigns.find((x) => x.id === d.campaignId);
      if (c) {
        setName(c.name);
        setColor(c.color ?? null);
        setRuleset(c.ruleset ?? "5.5e");
        setBinderId(c.binderId ?? "");
        setCurrentDateText(c.currentDate?.text ?? "");
        setIsActive(c.isActive);
      }
    }
  }, [props.drawer, state.campaigns]);

  React.useEffect(() => {
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
  }, []);

  const handleCreateBinder = React.useCallback(async () => {
    const trimmedName = newBinderName.trim();
    const trimmedDate = newBinderDate.trim();
    const parsedDate = Number(trimmedDate);
    if (!trimmedName || !trimmedDate || !Number.isInteger(parsedDate)) {
      setNewBinderError("Enter a name and a whole-number current date.");
      return;
    }
    setNewBinderBusy(true);
    setNewBinderError(null);
    try {
      const created = await createBinder(trimmedName, "#38b6ff", parsedDate);
      setBinders((current) => [created, ...current]);
      setBinderId(created.id);
      setCreatingNewBinder(false);
      setNewBinderName("");
      setNewBinderDate("");
    } catch (cause) {
      setNewBinderError(cause instanceof Error ? cause.message : "Unable to create Binder.");
    } finally {
      setNewBinderBusy(false);
    }
  }, [newBinderName, newBinderDate]);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    const safeName = (fallback: string) => {
      const s = name.trim();
      return s.length ? s : fallback;
    };

    if (d.type === "createCampaign") {
      const created = await api<{ id: string }>(`/api/campaigns`, jsonInit("POST", { name: safeName("New Campaign"), color, ruleset }));
      if (binderId) {
        await api(`/api/campaigns/${created.id}/binder`, jsonInit("PUT", { binderId, currentDateText: null, currentDateSort: null }));
      }
      await props.refreshAll();
      props.close();
      return;
    }
    await api(`/api/campaigns/${d.campaignId}`, jsonInit("PUT", { name: safeName("Campaign"), color, ruleset, isActive }));
    await api(`/api/campaigns/${d.campaignId}/binder`, jsonInit("PUT", {
      binderId: binderId || null,
      currentDateText: currentDateText.trim() || null,
      currentDateSort: /^-?\d+$/.test(currentDateText.trim()) ? Number(currentDateText.trim()) : null,
    }));
    await props.refreshAll();
    props.close();
  }, [name, color, ruleset, binderId, currentDateText, isActive, props]);

  return {
    body: (
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, letterSpacing: "0.08em", opacity: 0.55 }}>
          CAMPAIGN
        </div>
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

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Ruleset</div>
          <Select value={ruleset} onChange={(event) => setRuleset(event.target.value as "5e" | "5.5e")}>
            <option value="5.5e">5.5e (2024)</option>
            <option value="5e">5e (2014)</option>
          </Select>
          <div style={{ fontSize: "var(--fs-small)", opacity: 0.6 }}>
            Used to resolve Compendium entries when the same ID exists in both rulesets.
          </div>
        </div>

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
          <Select
            style={{ width: "100%" }}
            value={creatingNewBinder ? NEW_BINDER_VALUE : binderId}
            onChange={(event) => {
              const value = event.target.value;
              if (value === NEW_BINDER_VALUE) {
                setCreatingNewBinder(true);
                return;
              }
              setCreatingNewBinder(false);
              setBinderId(value);
            }}
          >
            <option value="">No Binder</option>
            {binders.map((binder) => (
              <option key={binder.id} value={binder.id}>{binder.name}</option>
            ))}
            <option value={NEW_BINDER_VALUE}>+ New Binder…</option>
          </Select>

          {creatingNewBinder && (
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                borderRadius: 10,
                background: "rgba(148,163,184,0.08)",
                border: "1px solid rgba(148,163,184,0.18)",
              }}
            >
              <Input
                value={newBinderName}
                onChange={(event) => setNewBinderName(event.target.value)}
                placeholder="Binder name"
                autoFocus
              />
              <Input
                value={newBinderDate}
                onChange={(event) => setNewBinderDate(event.target.value)}
                placeholder="Current date (e.g. 2438)"
              />
              {newBinderError ? (
                <div style={{ fontSize: "var(--fs-small)", color: "#f87171" }}>{newBinderError}</div>
              ) : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCreatingNewBinder(false);
                    setNewBinderError(null);
                    setBinderId("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateBinder}
                  disabled={newBinderBusy || !newBinderName.trim() || !newBinderDate.trim()}
                >
                  {newBinderBusy ? "Creating…" : "Create Binder"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {props.drawer.type === "editCampaign" && (
          <>
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
