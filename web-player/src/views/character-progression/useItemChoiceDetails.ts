import { useEffect, useState } from "react";
import { api } from "@/services/api";

export type ItemChoiceDetail = { text?: string[] | string | null };

/** Both progression flows load and cache item descriptions in batches of 48. */
export function useItemChoiceDetails(items: Array<{ id: string }>) {
  const [details, setDetails] = useState<Record<string, ItemChoiceDetail>>({});
  useEffect(() => {
    const ids = items.map((item) => item.id).filter((id) => !details[id]).slice(0, 48);
    if (!ids.length) return;
    let alive = true;
    api<{ rows: Array<{ id: string; text?: string[] | null }> }>("/api/compendium/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, includeText: true }),
    }).then((result) => {
      if (!alive) return;
      const patch = Object.fromEntries((result.rows ?? []).map((row) => [row.id, { text: row.text ?? null }]));
      if (Object.keys(patch).length) setDetails((previous) => ({ ...previous, ...patch }));
    }).catch(() => {});
    return () => { alive = false; };
  }, [items, details]);
  return details;
}
