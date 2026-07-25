import React from "react";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { inputStyle, labelStyle } from "./CharacterCreatorStyles";

type ItemDetailPreview = {
  text?: string[] | string | null;
};

export function ItemPicker<T extends { id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>({
  title,
  sourceLabel,
  items,
  chosen,
  disabledIds,
  max,
  emptyMsg,
  onToggle,
}: {
  title: string;
  sourceLabel?: string | null;
  items: T[];
  chosen: string[];
  disabledIds?: string[];
  max: number;
  emptyMsg: string;
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, ItemDetailPreview>>({});
  const trimmedSourceLabel = String(sourceLabel ?? "").trim();
  const disabledIdSet = React.useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const filtered = q
    ? items.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()))
    : items;
  const activeItem =
    filtered.find((item) => item.id === activeId)
    ?? items.find((item) => item.id === activeId)
    ?? (filtered[0] ?? items[0] ?? null);

  React.useEffect(() => {
    if (!activeItem) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId == null || !items.some((item) => item.id === activeId)) {
      setActiveId(activeItem.id);
    }
  }, [activeId, activeItem, items]);

  React.useEffect(() => {
    const ids = filtered
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
  }, [details, filtered]);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ ...labelStyle, margin: 0 }}>
          {title}
          {trimmedSourceLabel ? <span style={{ marginLeft: 8, fontSize: "var(--fs-small)", color: C.accentHl }}>{trimmedSourceLabel}</span> : null}
        </div>
        <span style={{ fontSize: "var(--fs-small)", color: chosen.length >= max ? C.accentHl : C.muted }}>
          {chosen.length} / {max}
        </span>
      </div>
      {items.length === 0 ? (
        <p style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{emptyMsg}</p>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 240, overflowY: "auto", padding: "2px 0" }}>
            {filtered.map((item) => {
              const sel = chosen.includes(item.id);
              const takenElsewhere = !sel && disabledIdSet.has(item.id);
              const locked = (!sel && chosen.length >= max) || takenElsewhere;
              const active = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setActiveId(item.id);
                    onToggle(item.id);
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: "var(--fs-small)",
                    cursor: locked ? "default" : "pointer",
                    border: `1px solid ${sel || active ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                    background: sel
                      ? "rgba(56,182,255,0.18)"
                      : active
                        ? "rgba(56,182,255,0.10)"
                        : "rgba(255,255,255,0.055)",
                    color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                    fontWeight: sel ? 700 : 400,
                    textAlign: "left",
                    minWidth: 180,
                    maxWidth: 280,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ marginTop: 4, fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1.35 }}>
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
          {activeItem && (
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
              {details[activeItem.id] && (
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
                    ? (details[activeItem.id].text as string[]).join("\n\n").trim()
                    : String(details[activeItem.id].text ?? "").trim()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
