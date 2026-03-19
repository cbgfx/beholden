import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { IconClose, IconPlus } from "@/icons";
import { Modal } from "@/components/overlay/Modal";
import type { CompendiumItemDetail, CompendiumItemRow } from "@/domain/types/compendium";
import { titleCase } from "@/lib/format/titleCase";
import { Select } from "@/ui/Select";
import { useVirtualList } from "@/views/CampaignView/monsterPicker/hooks/useVirtualList";
import {
  RARITY_ORDER, KNOWN_TYPES,
  uniqSorted, sortedRarities, rarityChipColor,
  searchStyle, fieldInput,
  MagicBadge, RarityDot, FormField, CheckRow, Chip,
} from "./ItemPickerModalParts";

const ROW_HEIGHT = 52;

export type AddItemPayload =
  | { source: "compendium"; itemId: string; qty: number }
  | { source: "custom"; qty: number; custom: { name: string; rarity: string | null; type: string | null; attunement: boolean; magic: boolean; text: string } };

export function ItemPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (payload: AddItemPayload) => void;
}) {
  const [rows, setRows] = React.useState<CompendiumItemRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [rarity, setRarity] = React.useState("");
  const [type, setType] = React.useState("");
  const [magicFilter, setMagicFilter] = React.useState<"" | "magic" | "nonmagic">("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CompendiumItemDetail | null>(null);

  const [qty, setQty] = React.useState(1);
  const [createMode, setCreateMode] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customRarity, setCustomRarity] = React.useState("");
  const [customType, setCustomType] = React.useState("");
  const [customAttune, setCustomAttune] = React.useState(false);
  const [customMagic, setCustomMagic] = React.useState(false);
  const [customText, setCustomText] = React.useState("");

  React.useEffect(() => {
    if (!props.isOpen) return;
    let alive = true;
    setLoading(true);
    api<CompendiumItemRow[]>("/api/compendium/items")
      .then((r) => { if (alive) setRows(r); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [props.isOpen]);

  React.useEffect(() => {
    if (props.isOpen) return;
    setQ(""); setRarity(""); setType(""); setMagicFilter("");
    setQty(1); setSelectedId(null); setDetail(null); setCreateMode(false);
    setCustomName(""); setCustomRarity(""); setCustomType("");
    setCustomAttune(false); setCustomMagic(false); setCustomText("");
  }, [props.isOpen]);

  React.useEffect(() => {
    if (!props.isOpen || !selectedId) { setDetail(null); return; }
    let alive = true;
    api<CompendiumItemDetail>(`/api/compendium/items/${selectedId}`)
      .then((d) => { if (alive) setDetail(d); })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [props.isOpen, selectedId]);

  const vl = useVirtualList({ isEnabled: true, rowHeight: ROW_HEIGHT, overscan: 6 });

  const rarityOptions = React.useMemo(() =>
    sortedRarities(rows.map((r) => (r.rarity ?? "").trim())), [rows]);

  const typeOptions = React.useMemo(() =>
    uniqSorted(rows.map((r) => (r.type ?? "").trim())), [rows]);

  const filtered = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows
      .filter((r) => !rarity || r.rarity === rarity)
      .filter((r) => !type || r.type === type)
      .filter((r) => !magicFilter || (magicFilter === "magic" ? r.magic : !r.magic))
      .filter((r) => !ql || r.name.toLowerCase().includes(ql));
  }, [rows, q, rarity, type, magicFilter]);

  const { start, end, padTop, padBottom } = vl.getRange(filtered.length);

  React.useEffect(() => {
    const el = vl.scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarity, type, magicFilter]);

  function addSelected() {
    if (!selectedId) return;
    props.onAdd({ source: "compendium", itemId: selectedId, qty });
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    props.onAdd({
      source: "custom",
      qty,
      custom: {
        name,
        rarity: customRarity.trim() || null,
        type: customType.trim() || null,
        attunement: customAttune,
        magic: customMagic,
        text: customText,
      },
    });
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="Add items" width={960}>
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 12, height: 560 }}>

        {/* ── Left: filter + list ─────────────────────────────────────── */}
        <Panel
          title="Browse"
          actions={
            <button
              type="button"
              title={createMode ? "Back to browse" : "Create new item"}
              onClick={() => { setCreateMode((v) => !v); setSelectedId(null); }}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 8,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: createMode ? theme.colors.panelBg : theme.colors.accentPrimary,
                color: createMode ? theme.colors.muted : theme.colors.textDark,
                cursor: "pointer", fontSize: 18, lineHeight: 1, fontWeight: 700,
              }}
            >
              {createMode ? "×" : <IconPlus size={14} />}
            </button>
          }
          style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}
          bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}
        >
          {/* Search */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items…"
            style={searchStyle()}
          />

          {/* Rarity + Type + Magic — 3-column grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <Select value={rarity} onChange={(e) => setRarity(e.target.value)} style={{ width: "100%" }}>
              <option value="">All Rarities</option>
              {rarityOptions.map((r) => (
                <option key={r} value={r}>{titleCase(r)}</option>
              ))}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%" }}>
              <option value="">All Types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Select value={magicFilter} onChange={(e) => setMagicFilter(e.target.value as "" | "magic" | "nonmagic")} style={{ width: "100%" }}>
              <option value="">Any magic</option>
              <option value="magic">✦ Magic only</option>
              <option value="nonmagic">Non-magic</option>
            </Select>
          </div>

          {/* Count */}
          <div style={{ fontSize: 12, color: theme.colors.muted }}>
            {loading ? "Loading…" : `${filtered.length} of ${rows.length}`}
          </div>

          {/* Virtual list */}
          <div
            ref={vl.scrollRef}
            onScroll={vl.onScroll}
            style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: 10,
            }}
          >
            <div style={{ height: padTop }} />

            {!loading && filtered.length === 0 && (
              <div style={{ padding: 12, color: theme.colors.muted }}>No items found.</div>
            )}

            {filtered.slice(start, end).map((r) => {
              const isSelected = r.id === selectedId;
              const subtitle = [
                r.rarity ? titleCase(r.rarity) : null,
                r.type ?? null,
                r.attunement ? "Attunement" : null,
              ].filter(Boolean).join(" • ");

              return (
                <div
                  key={r.id}
                  onClick={() => { setSelectedId(r.id); setCreateMode(false); }}
                  style={{
                    height: ROW_HEIGHT, display: "flex", flexDirection: "column",
                    justifyContent: "center", padding: "0 12px",
                    borderBottom: `1px solid ${theme.colors.panelBorder}`,
                    background: isSelected ? withAlpha(theme.colors.accentHighlight, 0.15) : "transparent",
                    cursor: "pointer", color: theme.colors.text, flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {r.rarity && <RarityDot rarity={r.rarity} />}
                    <span style={{ fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    {r.magic && <MagicBadge />}
                  </div>
                  {subtitle && (
                    <div style={{ color: theme.colors.muted, fontSize: 12, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>
                  )}
                </div>
              );
            })}

            <div style={{ height: padBottom }} />
          </div>
        </Panel>

        {/* ── Right: detail or create form ────────────────────────────── */}
        <Panel
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>{createMode ? "New Item" : detail?.name ?? "Select an item"}</span>
              <div style={{ flex: 1 }} />
              <IconButton title="Close" variant="ghost" onClick={props.onClose}>
                <IconClose />
              </IconButton>
            </div>
          }
          actions={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Qty stepper */}
              <div style={{ display: "flex", alignItems: "center", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8, overflow: "hidden" }}>
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))}
                  style={{ width: 28, height: 28, border: "none", background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>−</button>
                <input
                  type="number" min={1} value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: 48, textAlign: "center", fontSize: 14, fontWeight: 700,
                    background: "transparent", color: theme.colors.text,
                    border: "none", outline: "none",
                    appearance: "textfield", MozAppearance: "textfield", WebkitAppearance: "none",
                  } as React.CSSProperties}
                />
                <button type="button" onClick={() => setQty((q) => q + 1)}
                  style={{ width: 28, height: 28, border: "none", background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>+</button>
              </div>
              {createMode ? (
                <Button onClick={addCustom} disabled={!customName.trim()}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IconPlus size={14} /> Add
                  </span>
                </Button>
              ) : (
                <Button disabled={!selectedId} onClick={addSelected}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IconPlus size={14} /> Add
                  </span>
                </Button>
              )}
            </div>
          }
          bodyStyle={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}
        >
          {createMode ? (
            /* ── Create form ── */
            <>
              <FormField label="Name *">
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Item name" style={fieldInput()} />
              </FormField>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FormField label="Rarity">
                  <select value={customRarity} onChange={(e) => setCustomRarity(e.target.value)} style={fieldInput()}>
                    <option value="">— None —</option>
                    {RARITY_ORDER.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                  </select>
                </FormField>
                <FormField label="Type">
                  <input value={customType} onChange={(e) => setCustomType(e.target.value)} list="ipm-type-list" placeholder="e.g. Wondrous Item" style={fieldInput()} />
                  <datalist id="ipm-type-list">{KNOWN_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
                </FormField>
              </div>

              <div style={{ display: "flex", gap: 20 }}>
                <CheckRow label="Requires Attunement" checked={customAttune} onChange={setCustomAttune} />
                <CheckRow label="✦ Magic Item" checked={customMagic} onChange={setCustomMagic} />
              </div>

              <FormField label="Description">
                <textarea value={customText} onChange={(e) => setCustomText(e.target.value)} rows={10}
                  placeholder="Notes / description…"
                  style={{ ...fieldInput(), resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
              </FormField>
            </>
          ) : detail ? (
            /* ── Detail view ── */
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {detail.magic && <MagicBadge />}
                {detail.attunement && <Chip label="Attunement" color={theme.colors.accentHighlight} />}
                {detail.rarity && <Chip label={titleCase(detail.rarity)} color={rarityChipColor(detail.rarity)} />}
                {detail.type && <span style={{ fontSize: 12, color: theme.colors.muted }}>{detail.type}</span>}
              </div>
              <div style={{
                flex: 1, minHeight: 0, overflowY: "auto",
                padding: 12, borderRadius: 10,
                border: `1px solid ${theme.colors.panelBorder}`,
                whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14,
              }}>
                {typeof detail.text === "string"
                  ? detail.text.trim() || <span style={{ color: theme.colors.muted }}>No description.</span>
                  : (Array.isArray(detail.text) ? (detail.text as string[]).join("\n\n") : "") || <span style={{ color: theme.colors.muted }}>No description.</span>
                }
              </div>
            </>
          ) : (
            <div style={{ color: theme.colors.muted, lineHeight: 1.5 }}>
              Select an item from the list on the left, or click <strong>Create New</strong> to add a custom item.
            </div>
          )}
        </Panel>
      </div>
    </Modal>
  );
}
