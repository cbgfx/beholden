import React from "react";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { api } from "@/services/api";
import { titleCase } from "@/lib/format/titleCase";

type ItemFull = {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  attunement: boolean;
  magic: boolean;
  text: string | string[];
};

function rarityLabel(rarity: string | null): string {
  if (!rarity) return "";
  return titleCase(rarity);
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
    ? [rarityLabel(item.rarity), item.type, item.attunement ? "Requires Attunement" : null]
        .filter(Boolean).join(" • ")
    : "";

  const textParagraphs: string[] = item
    ? Array.isArray(item.text) ? item.text : [item.text ?? ""]
    : [];

  return (
    <Panel
      title={item ? item.name : "Item"}
      actions={<div style={{ color: theme.colors.muted, fontSize: 12 }}>{busy ? "Loading…" : meta}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {!item ? (
        <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>Pick an item on the left to view details.</div>
      ) : (
        <>
          {/* Tags row */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.magic && <Tag label="Magic" color="#a335ee" />}
            {item.attunement && <Tag label="Attunement" color={theme.colors.accentHighlight} />}
            {item.rarity && <Tag label={rarityLabel(item.rarity)} color={rarityColor(item.rarity)} />}
          </div>

          {/* Description */}
          <div
            style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: 12, padding: 10,
              whiteSpace: "pre-wrap", lineHeight: 1.5,
            }}
          >
            {textParagraphs.join("\n\n") || <span style={{ color: theme.colors.muted }}>No description.</span>}
          </div>
        </>
      )}
    </Panel>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      border: `1px solid ${color}33`,
      background: `${color}1a`,
      color, fontSize: 11, fontWeight: 700,
    }}>
      {label}
    </span>
  );
}

function rarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":    return theme.colors.muted;
    case "uncommon":  return "#1eff00";
    case "rare":      return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact":  return "#e6cc80";
    default:          return theme.colors.muted;
  }
}
