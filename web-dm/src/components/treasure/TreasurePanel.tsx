import React from "react";
import { api, jsonInit } from "@/services/api";
import { fetchAdventureTreasure, fetchCampaignTreasure } from "@/services/collectionApi";
import { useStore } from "@/store";
import { theme } from "@/theme/theme";
import type { TreasureEntry } from "@/domain/types/domain";
import { IconChest, IconPlus } from "@/icons";
import { IconButton } from "@/ui/IconButton";
import { Panel } from "@/ui/Panel";
import { ItemPickerModal, type AddItemPayload } from "@/views/CampaignView/components/ItemPickerModal";

const _qtyBtn: React.CSSProperties = {
  width: 22, height: 22, border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 6, background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.7)", cursor: "pointer",
  fontSize: "var(--fs-body)", fontWeight: 700, lineHeight: 1,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};

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
    const campaignTreasure = await fetchCampaignTreasure(state.selectedCampaignId) as TreasureEntry[];
    dispatch({ type: "setCampaignTreasure", treasure: campaignTreasure });

    if (scopeAdventureId) {
      const adventureTreasure = await fetchAdventureTreasure(scopeAdventureId) as TreasureEntry[];
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
        storageKey="treasure"
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex" }}>
              <IconChest />
            </span>
            {titleFromScope({ selectedAdventureId: scopeAdventureId, adventureName: scopeAdventureName })}
          </span>
        }
        actions={
          <IconButton title="Add item" onClick={() => setIsOpen(true)} variant="accent">
            <IconPlus />
          </IconButton>
        }
      >
        {treasure.length === 0 ? (
          <div style={{ color: theme.colors.muted }}>No treasure yet.</div>
        ) : (
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
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
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 4px",
                  borderBottom: `1px solid ${theme.colors.panelBorder}`,
                  cursor: "pointer",
                }}
              >
                {/* Item info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "var(--fs-subtitle)", color: theme.colors.text }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                    {t.magic ? (
                      <span style={{ flexShrink: 0, fontSize: "var(--fs-tiny)", fontWeight: 700, color: theme.colors.colorMagic, border: "1px solid #6d28d966", borderRadius: 5, padding: "1px 5px", lineHeight: 1.4 }}>
                        ✦ Magic
                      </span>
                    ) : null}
                  </div>
                  {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).length > 0 && (
                    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginTop: 1 }}>
                      {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).join(" • ")}
                    </div>
                  )}
                </div>

                {/* Qty stepper + delete */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  {(t.qty ?? 1) > 1 && (
                    <button
                      type="button" title="Decrease quantity"
                      onClick={() => updateQty(t.id, Math.max(1, (t.qty ?? 1) - 1))}
                      style={_qtyBtn}
                    >−</button>
                  )}
                  {(t.qty ?? 1) > 1 && (
                    <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted, minWidth: 18, textAlign: "center" }}>
                      ×{t.qty}
                    </span>
                  )}
                  <button
                    type="button" title="Increase quantity"
                    onClick={() => updateQty(t.id, (t.qty ?? 1) + 1)}
                    style={_qtyBtn}
                  >+</button>
                  <button
                    type="button" title="Remove"
                    onClick={() => remove(t.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,0.55)", fontSize: 16, padding: "0 2px", lineHeight: 1 }}
                  >×</button>
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
