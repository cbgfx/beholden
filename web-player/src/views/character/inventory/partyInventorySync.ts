import type { PartyCurrencyMap, PartyInventoryResult } from "@/services/inventoryApi";

type Item = PartyInventoryResult["items"][number];

/** One campaign's synchronization lifecycle. Disposal retires outstanding responses. */
export function createPartyInventorySync(io: {
  inventory: () => Promise<PartyInventoryResult>;
  item: (id: string) => Promise<Item>;
  currency: () => Promise<PartyCurrencyMap>;
  patchCurrency: (patch: Partial<PartyCurrencyMap>) => Promise<PartyCurrencyMap>;
  snapshot: (result: PartyInventoryResult) => void;
  upsert: (item: Item) => void;
  remove: (id: string) => void;
  setCurrency: (value: PartyCurrencyMap) => void;
  scheduleRefresh: () => void;
}) {
  let active = true;
  let revision = 0;
  let listRequest = 0;
  let currencyRequest = 0;
  let currencySaving = false;
  const itemRequests = new Map<string, number>();
  async function refresh() {
    if (!active) return;
    const request = ++listRequest;
    const started = revision;
    try {
      const result = await io.inventory();
      if (!active || request !== listRequest) return;
      if (started !== revision) { io.scheduleRefresh(); return; }
      itemRequests.clear();
      io.snapshot(result);
    } catch { /* Keep the last usable inventory on transient read failure. */ }
  }
  async function refreshCurrency() {
    if (!active || currencySaving) return;
    const request = ++currencyRequest;
    try {
      const result = await io.currency();
      if (active && request === currencyRequest) io.setCurrency(result);
    } catch { /* Keep the last usable balance on transient read failure. */ }
  }
  async function saveCurrency(patch: Partial<PartyCurrencyMap>) {
    if (!active || currencySaving) return false;
    currencySaving = true;
    ++currencyRequest; // Retire reads started before this write.
    try {
      const value = await io.patchCurrency(patch);
      if (!active) return false;
      io.setCurrency(value);
      return true;
    } catch (error) {
      if (!active) return false;
      throw error;
    } finally {
      currencySaving = false;
      // Reconcile websocket events received during the write, including on failure.
      void refreshCurrency();
    }
  }
  async function delta(action?: string, id?: string) {
    if (!active) return;
    const request = ++revision;
    if (!id || (action !== "delete" && action !== "upsert")) {
      itemRequests.clear();
      io.scheduleRefresh();
      return;
    }
    itemRequests.set(id, request);
    if (action === "delete") { itemRequests.delete(id); io.remove(id); return; }
    try {
      const item = await io.item(id);
      if (active && itemRequests.get(id) === request) io.upsert(item);
    } catch {
      if (active && itemRequests.get(id) === request) io.scheduleRefresh();
    } finally {
      if (itemRequests.get(id) === request) itemRequests.delete(id);
    }
  }
  return { refresh, refreshCurrency, saveCurrency, delta, dispose() { active = false; itemRequests.clear(); } };
}
