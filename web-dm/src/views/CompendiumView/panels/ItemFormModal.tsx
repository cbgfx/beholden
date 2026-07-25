import * as React from "react";
import { api } from "@/services/api";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { ItemBasicsView } from "./ItemFormBasics";
import { ItemMechanicsView } from "./ItemFormMechanics";
import { ItemSpellsView } from "./ItemFormSpells";
import { buildItemPayload, emptyItemForm, itemToForm, type ItemForEdit, type ItemFormData } from "./ItemFormModel";

export type { ItemForEdit } from "./ItemFormModel";
type ItemFormTab = "basics" | "mechanics" | "spells";
const TABS: Array<{ id: ItemFormTab; label: string }> = [{ id: "basics", label: "Basics" }, { id: "mechanics", label: "Mechanics" }, { id: "spells", label: "Spells" }];

export function ItemFormModal({ item, onClose, onSaved }: { item: ItemForEdit | null; onClose: () => void; onSaved: () => void }) {
  const create = item == null;
  const [form, setForm] = React.useState<ItemFormData>(() => item ? itemToForm(item) : emptyItemForm());
  const [tab, setTab] = React.useState<ItemFormTab>("basics");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof ItemFormData>(key: K, value: ItemFormData[K]) => setForm((current) => ({ ...current, [key]: value }));
  React.useEffect(() => { const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", escape); return () => window.removeEventListener("keydown", escape); }, [onClose]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      if (!form.name.trim() || !form.type.trim() || !form.rarity.trim()) { setTab("basics"); throw new Error("Name, type, and rarity are required."); }
      const body = buildItemPayload(form, item);
      await api(create ? "/api/compendium/items" : `/api/compendium/items/${encodeURIComponent(item!.id)}`, { method: create ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onSaved();
    } catch (reason) { setError(String((reason as Error)?.message ?? reason)); } finally { setBusy(false); }
  }
  const mechanicCount = Number(form.isWeapon) + Number(form.isArmor) + Number(form.usesEnabled) + form.modifiers.length + form.rolls.length;
  return <div onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: withAlpha("#000", .72), padding: 12 }}>
    <form onSubmit={save} style={{ width: "min(1240px, 100%)", height: "calc(100vh - 24px)", margin: "auto", background: "rgba(10,18,33,.985)", border: "1px solid rgba(120,150,200,.2)", borderRadius: 14, boxShadow: "0 26px 80px rgba(0,0,0,.58)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ padding: "14px 20px 0", borderBottom: `1px solid ${theme.colors.panelBorder}` }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12 }}><strong>{create ? "New Item" : `Edit: ${item!.name}`}</strong><button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "transparent", color: theme.colors.muted, fontSize: 24, cursor: "pointer" }}>×</button></div><nav aria-label="Item editor sections" style={{ display: "flex", gap: 4 }}>{TABS.map((entry) => { const active = tab === entry.id; const count = entry.id === "mechanics" ? mechanicCount : entry.id === "spells" ? form.spells.length : 0; return <button key={entry.id} type="button" onClick={() => setTab(entry.id)} style={{ border: 0, borderBottom: `2px solid ${active ? theme.colors.accentHighlight : "transparent"}`, background: active ? withAlpha(theme.colors.accentHighlight, .08) : "transparent", color: active ? theme.colors.accentHighlight : theme.colors.muted, padding: "9px 14px", cursor: "pointer", fontWeight: 750, borderRadius: "7px 7px 0 0" }}>{entry.label}{count ? ` · ${count}` : ""}</button>; })}</nav></header>
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>{tab === "basics" ? <ItemBasicsView form={form} set={set} /> : tab === "mechanics" ? <ItemMechanicsView form={form} set={set} /> : <ItemSpellsView form={form} set={set} />}</main>
      {error ? <div style={{ margin: "0 20px 8px", padding: 8, color: theme.colors.red, background: withAlpha(theme.colors.red, .1), borderRadius: 8 }}>{error}</div> : null}
      <footer style={{ padding: "12px 20px", borderTop: `1px solid ${theme.colors.panelBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{form.name.trim() || "Unnamed item"} · {form.type || "No type"}</span><div style={{ display: "flex", gap: 8 }}><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : create ? "Create Item" : "Save Changes"}</Button></div></footer>
    </form>
  </div>;
}
