import React from "react";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { titleCase } from "@/lib/format/titleCase";

type ItemFull = {
  id: string; name: string;
  rarity: string | null; type: string | null;
  attunement: boolean; magic: boolean;
  text: string | string[];
};

function rarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":    return C.muted;
    case "uncommon":  return "#1eff00";
    case "rare":      return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact":  return "#e6cc80";
    default:          return C.muted;
  }
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      border: `1px solid ${color}33`, background: `${color}1a`,
      color, fontSize: 11, fontWeight: 700,
    }}>{label}</span>
  );
}

export function ItemDetailPanel(props: { itemId: string }) {
  const [item, setItem] = React.useState<ItemFull | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!props.itemId) { setItem(null); return; }
    setBusy(true);
    api<ItemFull>(`/api/compendium/items/${encodeURIComponent(props.itemId)}`)
      .then((d) => { if (!cancelled) setItem(d ?? null); })
      .catch(() => { if (!cancelled) setItem(null); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [props.itemId]);

  const meta = item
    ? [item.rarity ? titleCase(item.rarity) : null, item.type, item.attunement ? "Requires Attunement" : null]
        .filter(Boolean).join(" • ")
    : "";

  const textParagraphs: string[] = item
    ? Array.isArray(item.text) ? item.text : [item.text ?? ""]
    : [];

  return (
    <Panel
      title={item ? item.name : "Item"}
      actions={<div style={{ color: C.muted, fontSize: 12 }}>{busy ? "Loading…" : meta}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {!item ? (
        <div style={{ color: C.muted }}>Pick an item on the left to view details.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.magic && <Tag label="Magic" color="#a335ee" />}
            {item.attunement && <Tag label="Attunement" color={C.accentHl} />}
            {item.rarity && <Tag label={titleCase(item.rarity)} color={rarityColor(item.rarity)} />}
          </div>
          <div style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            border: `1px solid ${C.panelBorder}`, borderRadius: 12,
            padding: 10, whiteSpace: "pre-wrap", lineHeight: 1.5,
          }}>
            {textParagraphs.join("\n\n") || <span style={{ color: C.muted }}>No description.</span>}
          </div>
        </>
      )}
    </Panel>
  );
}
