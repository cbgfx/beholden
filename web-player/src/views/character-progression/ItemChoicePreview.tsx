import { C } from "@/lib/theme";
import type { ItemChoiceDetail } from "./useItemChoiceDetails";

export function ItemChoicePreview({ item, detail }: {
  item: { name: string; rarity?: string | null; type?: string | null; attunement?: boolean };
  detail?: ItemChoiceDetail;
}) {
  return <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.panelBorder}`, background: C.panelBg }}>
    <div style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.accentHl }}>{item.name}</div>
    <div style={{ marginTop: 6, fontSize: "var(--fs-small)", color: C.muted }}>
      {[item.rarity, item.type, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
    </div>
    {detail && <div style={{ marginTop: 8, fontSize: "var(--fs-small)", lineHeight: 1.55, color: "rgba(191,227,255,0.82)", whiteSpace: "pre-wrap" }}>
      {Array.isArray(detail.text) ? detail.text.join("\n\n").trim() : String(detail.text ?? "").trim()}
    </div>}
  </div>;
}
