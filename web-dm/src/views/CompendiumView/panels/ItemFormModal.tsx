import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";

export type ItemForEdit = {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  attunement: boolean;
  magic: boolean;
  text: string | string[];
};

const RARITIES = ["", "common", "uncommon", "rare", "very rare", "legendary", "artifact"];
const KNOWN_TYPES = [
  "Light Armor", "Medium Armor", "Heavy Armor", "Shield",
  "Melee Weapon", "Ranged Weapon", "Ammunition",
  "Potion", "Scroll", "Wand", "Rod", "Staff", "Ring",
  "Wondrous Item", "Adventuring Gear", "Currency", "Other",
];

type Props = {
  item: ItemForEdit | null; // null = create mode
  onClose: () => void;
  onSaved: () => void;
};

export function ItemFormModal(props: Props) {
  const isEdit = props.item != null;

  const [name, setName] = React.useState(props.item?.name ?? "");
  const [rarity, setRarity] = React.useState(props.item?.rarity ?? "");
  const [type, setType] = React.useState(props.item?.type ?? "");
  const [attunement, setAttunement] = React.useState(props.item?.attunement ?? false);
  const [magic, setMagic] = React.useState(props.item?.magic ?? false);
  const [text, setText] = React.useState(() => {
    const t = props.item?.text ?? "";
    return Array.isArray(t) ? t.join("\n\n") : t;
  });

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        rarity: rarity.trim() || null,
        type: type.trim() || null,
        attunement,
        magic,
        text: text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean),
      };
      if (isEdit) {
        await api(`/api/compendium/items/${encodeURIComponent(props.item!.id)}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api("/api/compendium/items", { method: "POST", body: JSON.stringify(body) });
      }
      props.onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1200,
        background: withAlpha(theme.colors.shadowColor, 0.72),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={props.onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.colors.cardBg, borderRadius: 16,
          border: `1px solid ${theme.colors.panelBorder}`,
          padding: 24, width: 540, maxWidth: "95vw",
          maxHeight: "90vh", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: 16,
          color: theme.colors.text,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18 }}>
          {isEdit ? `Edit: "${props.item!.name}"` : "New Item"}
        </div>

        {/* Name */}
        <Field label="Name *">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            required
            style={inputStyle()}
          />
        </Field>

        {/* Rarity + Type */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Rarity">
            <select value={rarity} onChange={(e) => setRarity(e.target.value)} style={inputStyle()}>
              <option value="">— None —</option>
              {RARITIES.filter(Boolean).map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <input
              value={type} onChange={(e) => setType(e.target.value)}
              list="item-type-list"
              placeholder="e.g. Wondrous Item"
              style={inputStyle()}
            />
            <datalist id="item-type-list">
              {KNOWN_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
        </div>

        {/* Attunement + Magic */}
        <div style={{ display: "flex", gap: 20 }}>
          <CheckField label="Requires Attunement" checked={attunement} onChange={setAttunement} />
          <CheckField label="Magic Item" checked={magic} onChange={setMagic} />
        </div>

        {/* Description */}
        <Field label="Description (blank lines = new paragraph)">
          <textarea
            value={text} onChange={(e) => setText(e.target.value)}
            rows={8}
            style={{ ...inputStyle(), resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          />
        </Field>

        {error && <div style={{ color: theme.colors.red, fontSize: 13 }}>{error}</div>}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={props.onClose} style={btnStyle("secondary")}>Cancel</button>
          <button type="submit" disabled={saving} style={btnStyle("primary")}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600, color: theme.colors.muted }}>
      <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11 }}>{label}</span>
      {children}
    </label>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: theme.colors.text }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
      {label}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    background: theme.colors.panelBg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: 8,
    padding: "8px 10px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontSize: 14,
  };
}

function btnStyle(variant: "primary" | "secondary"): React.CSSProperties {
  const isPrimary = variant === "primary";
  return {
    padding: "8px 20px", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontSize: 14,
    border: `1px solid ${isPrimary ? theme.colors.accentPrimary : theme.colors.panelBorder}`,
    background: isPrimary ? theme.colors.accentPrimary : "transparent",
    color: isPrimary ? theme.colors.textDark : theme.colors.text,
  };
}
