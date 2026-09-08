import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedSingleflight } from "@beholden/shared/ui/useDebouncedSingleflight";
import { fetchPartyInventory, fetchPartyInventoryItem, fetchPartyCurrency, patchPartyCurrency, type PartyCurrencyMap } from "@/services/inventoryApi";
import { useWs } from "@/services/ws";
import type { PartyStashItem } from "./CharacterInventoryPanelRows";
import { createPartyInventorySync } from "./partyInventorySync";

export function usePartyInventorySync(campaignId?: string | null) {
  const [partyStashItems, setPartyStashItems] = useState<PartyStashItem[]>([]);
  const [partyCapacityLbs, setPartyCapacityLbs] = useState<number | null>(null);
  const [partyCurrency, setPartyCurrency] = useState<PartyCurrencyMap>({ PP: 0, GP: 0, SP: 0, CP: 0 });
  const owner = useRef<ReturnType<typeof createPartyInventorySync> | null>(null);
  const enqueue = useDebouncedSingleflight(useCallback(() => owner.current?.refresh(), []));
  useEffect(() => {
    setPartyStashItems([]);
    setPartyCapacityLbs(null);
    setPartyCurrency({ PP: 0, GP: 0, SP: 0, CP: 0 });
    if (!campaignId) return;
    const sync = createPartyInventorySync({
      inventory: () => fetchPartyInventory(campaignId),
      item: (id) => fetchPartyInventoryItem(campaignId, id),
      currency: () => fetchPartyCurrency(campaignId),
      patchCurrency: (patch) => patchPartyCurrency(campaignId, patch),
      snapshot: ({ items, partyCapacityLbs: capacity }) => { setPartyStashItems(items as PartyStashItem[]); setPartyCapacityLbs(capacity); },
      upsert: (item) => setPartyStashItems((previous) => {
        const index = previous.findIndex((entry) => entry.id === item.id);
        if (index < 0) return [...previous, item as PartyStashItem];
        return previous.map((entry, i) => i === index ? item as PartyStashItem : entry);
      }),
      remove: (id) => setPartyStashItems((previous) => previous.filter((item) => item.id !== id)),
      setCurrency: setPartyCurrency,
      scheduleRefresh: () => enqueue(),
    });
    owner.current = sync;
    void sync.refresh();
    void sync.refreshCurrency();
    return () => { sync.dispose(); owner.current = null; };
  }, [campaignId, enqueue]);
  useWs(useCallback((message) => {
    const payload = message.payload as { campaignId?: string; action?: string; itemId?: string } | undefined;
    if (!campaignId || payload?.campaignId !== campaignId) return;
    if (message.type === "partyCurrency:delta") void owner.current?.refreshCurrency();
    if (message.type === "partyInventory:delta") void owner.current?.delta(payload.action, payload.itemId);
  }, [campaignId]));
  const savePartyCurrency = useCallback((patch: Partial<PartyCurrencyMap>) =>
    owner.current?.saveCurrency(patch) ?? Promise.resolve(false), []);
  return { partyStashItems, setPartyStashItems, partyCapacityLbs, partyCurrency, savePartyCurrency };
}
