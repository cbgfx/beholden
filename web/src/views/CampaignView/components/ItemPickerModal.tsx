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

export type AddItemPayload =
  | { source: "compendium"; itemId: string }
  | { source: "custom"; custom: { name: string; rarity: string | null; type: string | null; attunement: boolean; magic: boolean; text: string } };

function uniqSorted(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function MagicBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontSize: "var(--fs-small)",
        fontWeight: 700,
        color: "#6ea8fe",
        border: "1px solid #3d6db0",
        borderRadius: 6,
        padding: "1px 6px",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      ✦ Magic
    </span>
  );
}

export function ItemPickerModal(props: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (payload: AddItemPayload) => void;
}) {
  const [rows, setRows] = React.useState<CompendiumItemRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [rarity, setRarity] = React.useState<string>("");
  const [type, setType] = React.useState<string>("");
  const [magicFilter, setMagicFilter] = React.useState<"" | "magic" | "nonmagic">("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CompendiumItemDetail | null>(null);

  const [createMode, setCreateMode] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customRarity, setCustomRarity] = React.useState<string>("");
  const [customType, setCustomType] = React.useState<string>("");
  const [customAttune, setCustomAttune] = React.useState(false);
  const [customMagic, setCustomMagic] = React.useState(false);
  const [customText, setCustomText] = React.useState("");

  // Load index on open (keeps App lightweight).
  React.useEffect(() => {
    if (!props.isOpen) return;
    let alive = true;
    setLoading(true);
    api<CompendiumItemRow[]>("/api/compendium/items")
      .then((r) => {
        if (!alive) return;
        setRows(r);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [props.isOpen]);

  // Reset selection when closed.
  React.useEffect(() => {
    if (props.isOpen) return;
    setQ("");
    setRarity("");
    setType("");
    setMagicFilter("");
    setSelectedId(null);
    setDetail(null);
    setCreateMode(false);
    setCustomName("");
    setCustomRarity("");
    setCustomType("");
    setCustomAttune(false);
    setCustomMagic(false);
    setCustomText("");
  }, [props.isOpen]);

  React.useEffect(() => {
    if (!props.isOpen) return;
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    api<CompendiumItemDetail>(`/api/compendium/items/${selectedId}`)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
      })
      .catch(() => {
        if (!alive) return;
        setDetail(null);
      });
    return () => {
      alive = false;
    };
  }, [props.isOpen, selectedId]);

  const rarityOptions = React.useMemo(() => {
    return uniqSorted(rows.map((r) => (r.rarity ?? "").trim()).filter(Boolean));
  }, [rows]);

  const typeOptions = React.useMemo(() => {
    return uniqSorted(rows.map((r) => (r.type ?? "").trim()).filter(Boolean));
  }, [rows]);

  const filtered = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows
      .filter((r) => (!rarity ? true : String(r.rarity ?? "") === rarity))
      .filter((r) => (!type ? true : String(r.type ?? "") === type))
      .filter((r) => {
        if (!magicFilter) return true;
        if (magicFilter === "magic") return Boolean(r.magic);
        if (magicFilter === "nonmagic") return !r.magic;
        return true;
      })
      .filter((r) => (!ql ? true : String(r.name ?? "").toLowerCase().includes(ql)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, q, rarity, type, magicFilter]);

  function addSelected() {
    if (!selectedId) return;
    props.onAdd({ source: "compendium", itemId: selectedId });
  }

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    props.onAdd({
      source: "custom",
      custom: {
        name,
        rarity: customRarity.trim() ? customRarity.trim() : null,
        type: customType.trim() ? customType.trim() : null,
        attunement: Boolean(customAttune),
        magic: Boolean(customMagic),
        text: customText
      }
    });
  }

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={"Add items"} width={960}>
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12, minHeight: 520 }}>
        {/* Left: list */}
        <Panel
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>Add items</span>
              <div style={{ flex: 1 }} />
              <Button
                variant={createMode ? "primary" : "ghost"}
                onClick={() => setCreateMode((v) => !v)}
              >
                Create New
              </Button>
            </div>
          }
        >
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              style={{ width: "100%", padding: "10px 12px", background: theme.colors.panelBg, color: theme.colors.text }}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Select value={rarity} onChange={(e) => setRarity((e.target as any).value)}>
                <option value="">All rarities</option>
                {rarityOptions.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </Select>
              <Select value={type} onChange={(e) => setType((e.target as any).value)}>
                <option value="">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, whiteSpace: "nowrap" }}>✦ Magic</span>
              <Select style={{ flex: 1 } as any} value={magicFilter} onChange={(e) => setMagicFilter((e.target as any).value as "" | "magic" | "nonmagic")}>
                <option value="">All items</option>
                <option value="magic">Magic only</option>
                <option value="nonmagic">Non-magic only</option>
              </Select>
            </div>

            <div
              style={{
                border: `1px solid ${theme.colors.panelBorder}`,
                borderRadius: 10,
                overflow: "hidden",
                maxHeight: 320
              }}
            >
              <div style={{ overflowY: "auto", maxHeight: 320 }}>
                {loading ? <div style={{ padding: 10, color: theme.colors.muted }}>Loading...</div> : null}
                {!loading && filtered.length === 0 ? (
                  <div style={{ padding: 10, color: theme.colors.muted }}>No items found.</div>
                ) : null}

                {filtered.map((r) => {
                  const isSelected = r.id === selectedId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedId(r.id);
                        setCreateMode(false);
                      }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: 10,
                        border: "none",
                        background: isSelected ? theme.colors.panelBg : "transparent",
                        cursor: "pointer",
                        color: theme.colors.text
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontWeight: 900 }}>{r.name}</span>
                        {r.magic ? <MagicBadge /> : null}
                      </div>
                      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                        {[r.rarity ? titleCase(r.rarity) : null, r.type ? titleCase(r.type) : null, r.attunement ? "Attunement" : null]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Panel>

        {/* Right: detail / create */}
        <Panel
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span>{createMode ? "New item" : detail?.name ?? "Select an item"}</span>
              <div style={{ flex: 1 }} />
              <IconButton title="Close" variant="ghost" onClick={props.onClose}>
                <IconClose />
              </IconButton>
            </div>
          }
          actions={
            createMode ? (
              <Button onClick={addCustom}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <IconPlus /> Add
                </span>
              </Button>
            ) : (
              <Button disabled={!selectedId} onClick={addSelected}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <IconPlus /> Add
                </span>
              </Button>
            )
          }
        >
          {createMode ? (
            <div style={{ display: "grid", gap: 8 }}>
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Name" />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input value={customRarity} onChange={(e) => setCustomRarity(e.target.value)} placeholder="Rarity (e.g. rare)" />
                <input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Type (e.g. Weapon)" />
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, color: theme.colors.muted }}>
                <input type="checkbox" checked={customAttune} onChange={(e) => setCustomAttune(e.target.checked)} />
                Requires attunement
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, color: theme.colors.muted }}>
                <input type="checkbox" checked={customMagic} onChange={(e) => setCustomMagic(e.target.checked)} />
                ✦ Magical item
              </label>

              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Description / notes"
                rows={12}
                style={{ resize: "vertical" }}
              />
            </div>
          ) : detail ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: theme.colors.muted }}>
                  {[detail.rarity ? titleCase(detail.rarity) : null, detail.type ? titleCase(detail.type) : null, detail.attunement ? "Requires Attunement" : null]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
                {detail.magic ? <MagicBadge /> : null}
              </div>
              <div
                className="bh-prewrap"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: withAlpha(theme.colors.shadowColor, 0.14),
                  maxHeight: 420,
                  overflowY: "auto"
                }}
              >
                {detail.text?.trim() ? detail.text : <span style={{ color: theme.colors.muted }}>No description.</span>}
              </div>
            </div>
          ) : (
            <div style={{ color: theme.colors.muted }}>Select an item on the left, or create a new one.</div>
          )}
        </Panel>
      </div>
    </Modal>
  );
}
