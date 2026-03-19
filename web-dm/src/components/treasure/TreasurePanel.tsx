import React from "react";
import { api, jsonInit } from "@/services/api";
import { useStore } from "@/store";
import { theme } from "@/theme/theme";
import type { TreasureEntry } from "@/domain/types/domain";
import { IconChest, IconPlus, IconTrash } from "@/icons";
import { IconButton } from "@/ui/IconButton";
import { Panel } from "@/ui/Panel";
import { ItemPickerModal, type AddItemPayload } from "@/views/CampaignView/components/ItemPickerModal";

function titleFromScope(opts: { selectedAdventureId: string | null; adventureName?: string | null }) {
  if (!opts.selectedAdventureId) return "Treasure (Campaign)";
  return opts.adventureName ? `Treasure (${opts.adventureName})` : "Treasure (Adventure)";
}

/**
 * Shared Treasure panel.
 *
 * - Scope is based on whether an adventure is selected.
 * - Friendly monsters never factor into treasure; treasure is stored per campaign/adventure.
 * - Uses ItemPickerModal (compendium + Create New).
 */
export function TreasurePanel(_props: { encounterId?: string } = {}) {
  const { state, dispatch } = useStore();
  const [isOpen, setIsOpen] = React.useState(false);

  const scopeAdventureId = state.selectedAdventureId;
  const treasure = scopeAdventureId ? state.adventureTreasure : state.campaignTreasure;

  const scopeAdventureName = React.useMemo(() => {
    if (!scopeAdventureId) return null;
    return state.adventures.find((a) => a.id === scopeAdventureId)?.name ?? null;
  }, [scopeAdventureId, state.adventures]);

  async function refreshTreasure() {
    if (!state.selectedCampaignId) return;
    const campaignTreasure = await api<TreasureEntry[]>(`/api/campaigns/${state.selectedCampaignId}/treasure`);
    dispatch({ type: "setCampaignTreasure", treasure: campaignTreasure });

    if (scopeAdventureId) {
      const adventureTreasure = await api<TreasureEntry[]>(`/api/adventures/${scopeAdventureId}/treasure`);
      dispatch({ type: "setAdventureTreasure", treasure: adventureTreasure });
    } else {
      dispatch({ type: "setAdventureTreasure", treasure: [] });
    }
  }

  React.useEffect(() => {
    refreshTreasure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedCampaignId, scopeAdventureId]);

  async function addItem(payload: AddItemPayload) {
    if (!state.selectedCampaignId) return;
    const endpoint = scopeAdventureId
      ? `/api/adventures/${scopeAdventureId}/treasure`
      : `/api/campaigns/${state.selectedCampaignId}/treasure`;

    if (payload.source === "compendium") {
      await api(endpoint, jsonInit("POST", { source: "compendium", itemId: payload.itemId, qty: payload.qty }));
    } else {
      await api(endpoint, jsonInit("POST", { source: "custom", custom: payload.custom, qty: payload.qty }));
    }

    setIsOpen(false);
    await refreshTreasure();
  }

  async function remove(id: string) {
    await api(`/api/treasure/${id}`, { method: "DELETE" });
    await refreshTreasure();
  }

  async function updateQty(id: string, qty: number) {
    await api(`/api/treasure/${id}/qty`, jsonInit("PATCH", { qty }));
    await refreshTreasure();
  }

  return (
    <>
      <Panel
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", color: theme.colors.text }}>
              <IconChest />
            </span>
            {titleFromScope({ selectedAdventureId: scopeAdventureId, adventureName: scopeAdventureName })}
          </span>
        }
        actions={
          <IconButton title="Add item" onClick={() => setIsOpen(true)}>
            <IconPlus />
          </IconButton>
        }
      >
        {treasure.length === 0 ? (
          <div style={{ color: theme.colors.muted }}>No treasure yet.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 8,
              maxHeight: 220,
              overflowY: "auto",
              paddingRight: 2,
            }}
          >
            {treasure.map((t) => (
              <div
                key={t.id}
                onClick={() =>
                  dispatch({
                    type: "openDrawer",
                    drawer: { type: "viewTreasure", treasureId: t.id, title: t.name }
                  })
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  cursor: "pointer"
                }}
              >
                {/* Item info */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
                    {t.name}
                    {t.magic ? (
                      <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: "#a78bfa", border: "1px solid #6d28d966", borderRadius: 6, padding: "1px 6px", lineHeight: 1.4 }}>
                        ✦ Magic
                      </span>
                    ) : null}
                  </div>
                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                    {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).join(" • ")}
                  </div>
                </div>

                {/* Qty stepper + delete */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", alignItems: "center", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8, overflow: "hidden" }}>
                    <button
                      type="button" title="Decrease quantity"
                      onClick={() => updateQty(t.id, Math.max(1, (t.qty ?? 1) - 1))}
                      style={{ width: 26, height: 26, border: "none", background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: 15, fontWeight: 700, flexShrink: 0 }}
                    >−</button>
                    <input
                      type="number" min={1}
                      value={t.qty ?? 1}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        if (v >= 1) updateQty(t.id, v);
                      }}
                      style={{
                        width: 40, textAlign: "center", fontSize: 13, fontWeight: 700,
                        background: "transparent", color: theme.colors.text,
                        border: "none", outline: "none",
                        appearance: "textfield", MozAppearance: "textfield", WebkitAppearance: "none",
                      } as React.CSSProperties}
                    />
                    <button
                      type="button" title="Increase quantity"
                      onClick={() => updateQty(t.id, (t.qty ?? 1) + 1)}
                      style={{ width: 26, height: 26, border: "none", background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: 15, fontWeight: 700, flexShrink: 0 }}
                    >+</button>
                  </div>
                  <IconButton title="Remove" onClick={() => remove(t.id)}>
                    <IconTrash />
                  </IconButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ItemPickerModal isOpen={isOpen} onClose={() => setIsOpen(false)} onAdd={addItem} />
    </>
  );
}
