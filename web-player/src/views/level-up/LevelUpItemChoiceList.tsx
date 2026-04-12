import React from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";

type ItemDetailPreview = {
  text?: string[] | string | null;
};

export function LevelUpItemChoiceList({
  title,
  caption,
  items,
  chosen,
  disabledIds,
  max,
  onToggle,
}: {
  title: string;
  caption: string;
  items: Array<{ id: string; name: string; rarity?: string | null; type?: string | null; attunement?: boolean }>;
  chosen: string[];
  disabledIds?: string[];
  max: number;
  onToggle: (id: string) => void;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, ItemDetailPreview>>({});
  const disabledIdSet = React.useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const availableItems = React.useMemo(
    () => items.filter((item) => !chosen.includes(item.id)),
    [chosen, items],
  );
  const activeItem =
    availableItems.find((item) => item.id === activeId)
    ?? availableItems[0]
    ?? null;

  React.useEffect(() => {
    const ids = availableItems
      .map((item) => item.id)
      .filter((id) => !details[id])
      .slice(0, 48);
    if (ids.length === 0) return;
    let alive = true;
    api<{ rows: Array<{ id: string; text?: string[] | null }> }>("/api/compendium/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, includeText: true }),
    })
      .then((result) => {
        if (!alive) return;
        const patch: Record<string, ItemDetailPreview> = {};
        for (const row of result.rows ?? []) patch[row.id] = { text: row.text ?? null };
        if (Object.keys(patch).length === 0) return;
        setDetails((prev) => ({ ...prev, ...patch }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [availableItems, details]);

  React.useEffect(() => {
    if (!activeItem) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId == null || !availableItems.some((item) => item.id === activeId)) {
      setActiveId(activeItem.id);
    }
  }, [activeId, activeItem, availableItems]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
          {chosen.length} / {max} · {caption}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {availableItems.map((item) => {
          const focused = activeItem?.id === item.id;
          const takenElsewhere = disabledIdSet.has(item.id);
          const blocked = chosen.length >= max || takenElsewhere;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveId(item.id);
                if (!blocked) onToggle(item.id);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: blocked ? "not-allowed" : "pointer",
                border: `2px solid ${focused ? C.accentHl : "rgba(255,255,255,0.1)"}`,
                background: focused ? "rgba(56,182,255,0.08)" : "rgba(255,255,255,0.03)",
                color: blocked ? C.muted : C.text,
                textAlign: "left",
                opacity: blocked ? 0.6 : 1,
                minHeight: 72,
              }}
            >
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{item.name}</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 4 }}>
                {[item.rarity, item.type, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
              </div>
              {takenElsewhere && (
                <div style={{ marginTop: 3, fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>
                  Already selected elsewhere
                </div>
              )}
            </button>
          );
        })}
      </div>
      {activeItem && details[activeItem.id] && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.accentHl }}>
            {activeItem.name}
          </div>
          <div style={{ marginTop: 6, fontSize: "var(--fs-small)", color: C.muted }}>
            {[activeItem.rarity, activeItem.type, activeItem.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: "var(--fs-small)",
              lineHeight: 1.55,
              color: "rgba(191,227,255,0.82)",
              whiteSpace: "pre-wrap",
            }}
          >
            {Array.isArray(details[activeItem.id].text)
              ? details[activeItem.id].text.join("\n\n").trim()
              : String(details[activeItem.id].text ?? "").trim()}
          </div>
        </div>
      )}
      {availableItems.length === 0 && (
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>No eligible options found in compendium.</div>
      )}
    </div>
  );
}
