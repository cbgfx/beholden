import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { TextArea } from "@/ui/TextArea";
import { ITEM_RARITY_ORDER, KNOWN_ITEM_TYPES } from "@beholden/shared/domain";
import { CheckRow, FieldGrid, FormField } from "@beholden/shared/ui";

export type ItemForEdit = {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  attunement: boolean;
  magic: boolean;
  text: string | string[];
};

const RARITIES = ["", ...ITEM_RARITY_ORDER];
const KNOWN_TYPES = [...KNOWN_ITEM_TYPES];

type Props = {
  item: ItemForEdit | null;
  onClose: () => void;
  onSaved: () => void;
};

const fieldLabelStyle: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  color: theme.colors.muted,
};

const checkStyle: React.CSSProperties = {
  fontSize: "var(--fs-subtitle)",
  color: theme.colors.text,
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
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
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
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: withAlpha(theme.colors.shadowColor, 0.72),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={props.onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.colors.panelBg,
          borderRadius: 16,
          border: `1px solid ${theme.colors.panelBorder}`,
          padding: 24,
          width: 540,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          color: theme.colors.text,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "var(--fs-title)" }}>
          {isEdit ? `Edit: "${props.item!.name}"` : "New Item"}
        </div>

        <FormField label="Name *" labelStyle={fieldLabelStyle}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </FormField>

        <FieldGrid columns="1fr 1fr" gap={12}>
          <FormField label="Rarity" labelStyle={fieldLabelStyle}>
            <Select value={rarity} onChange={(e) => setRarity(e.target.value)}>
              <option value="">None</option>
              {RARITIES.filter(Boolean).map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Type" labelStyle={fieldLabelStyle}>
            <Input value={type} onChange={(e) => setType(e.target.value)} list="item-type-list" placeholder="e.g. Wondrous Item" />
            <datalist id="item-type-list">
              {KNOWN_TYPES.map((t) => <option key={t} value={t} />)}
            </datalist>
          </FormField>
        </FieldGrid>

        <div style={{ display: "flex", gap: 20 }}>
          <CheckRow label="Requires Attunement" checked={attunement} onChange={setAttunement} style={checkStyle} />
          <CheckRow label="Magic Item" checked={magic} onChange={setMagic} style={checkStyle} />
        </div>

        <FormField label="Description (blank lines = new paragraph)" labelStyle={fieldLabelStyle}>
          <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={8} style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
        </FormField>

        {error && <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={props.onClose} style={btnStyle("secondary")}>Cancel</button>
          <button type="submit" disabled={saving} style={btnStyle("primary")}>
            {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Item"}
          </button>
        </div>
      </form>
    </div>
  );
}

function btnStyle(variant: "primary" | "secondary"): React.CSSProperties {
  const isPrimary = variant === "primary";
  return {
    padding: "8px 20px",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "var(--fs-medium)",
    border: `1px solid ${isPrimary ? theme.colors.accentPrimary : theme.colors.panelBorder}`,
    background: isPrimary ? theme.colors.accentPrimary : "transparent",
    color: isPrimary ? theme.colors.textDark : theme.colors.text,
  };
}
