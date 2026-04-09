import React from "react";
import { CollectionRow, QuantityStepper, Tag } from "@beholden/shared/ui";
import { api, jsonInit } from "@/services/api";
import { fetchAdventureTreasure, fetchCampaignTreasure } from "@/services/collectionApi";
import type { TreasureEntry } from "@/domain/types/domain";
import { IconPlus } from "@/icons";
import { useStore } from "@/store";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { Panel } from "@/ui/Panel";
import { ItemPickerModal, type AddItemPayload } from "@/views/CampaignView/components/ItemPickerModal";
import { RarityDot } from "@/views/CampaignView/components/ItemPickerModalParts";

function titleFromScope(opts: { selectedAdventureId: string | null; adventureName?: string | null }) {
  if (!opts.selectedAdventureId) return "Treasure (Campaign)";
  return opts.adventureName ? `Treasure (${opts.adventureName})` : "Treasure (Adventure)";
}

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
        title={titleFromScope({ selectedAdventureId: scopeAdventureId, adventureName: scopeAdventureName })}
        actions={(
          <IconButton title="Add item" onClick={() => setIsOpen(true)} variant="accent">
            <IconPlus />
          </IconButton>
        )}
      >
        {treasure.length === 0 ? (
          <div style={{ color: theme.colors.muted }}>No treasure yet.</div>
        ) : (
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {treasure.map((t) => (
              <CollectionRow
                key={t.id}
                onClick={() =>
                  dispatch({
                    type: "openDrawer",
                    drawer: { type: "viewTreasure", treasureId: t.id, title: t.name },
                  })
                }
                borderColor={theme.colors.panelBorder}
                padding="6px 4px"
                main={(
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "var(--fs-subtitle)", color: theme.colors.text }}>
                      {t.rarity ? <RarityDot rarity={t.rarity} /> : null}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{t.name}</span>
                      {t.magic ? <Tag label="Magic" color={theme.colors.colorMagic} /> : null}
                    </div>
                    {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).length > 0 ? (
                      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginTop: 1 }}>
                        {[t.rarity, t.type, t.attunement ? "attunement" : null].filter(Boolean).join(" • ")}
                      </div>
                    ) : null}
                  </>
                )}
                trailing={(
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <QuantityStepper
                      value={(t.qty ?? 1) > 1 ? t.qty : null}
                      valuePrefix="x"
                      onDecrement={(t.qty ?? 1) > 1 ? () => updateQty(t.id, Math.max(1, (t.qty ?? 1) - 1)) : undefined}
                      decrementDisabled={(t.qty ?? 1) <= 1}
                      onIncrement={() => updateQty(t.id, (t.qty ?? 1) + 1)}
                      theme={{
                        buttonBackground: "rgba(255,255,255,0.05)",
                        buttonBorder: "rgba(255,255,255,0.12)",
                        buttonColor: "rgba(255,255,255,0.7)",
                        valueColor: theme.colors.muted,
                        buttonSize: 22,
                        borderRadius: 6,
                        fontSize: "var(--fs-body)",
                        valueMinWidth: 18,
                      }}
                    />
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => remove(t.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,0.55)", fontSize: 16, padding: "0 2px", lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </Panel>

      <ItemPickerModal isOpen={isOpen} onClose={() => setIsOpen(false)} onAdd={addItem} />
    </>
  );
}
