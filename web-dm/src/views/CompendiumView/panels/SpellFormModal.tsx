import * as React from "react";
import { api } from "@/services/api";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { TextArea } from "@/ui/TextArea";
import { SpellChoiceMenu } from "./SpellFormControls";
import { togglePillStyle } from "./browserParts";
import {
  ACCESS_OPTIONS, CHECK_OPTIONS, EFFECT_OPTIONS, SCHOOLS,
  buildSpellPayload, emptySpellForm, spellToForm,
  type SpellForEdit, type SpellFormData,
} from "./SpellFormModel";

export type { SpellForEdit } from "./SpellFormModel";

const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, fontSize: "var(--fs-small)", fontWeight: 650, color: theme.colors.muted };
const sectionStyle: React.CSSProperties = { border: "1px solid rgba(120,150,200,0.14)", borderRadius: 10, padding: 14, background: "rgba(3,8,18,0.34)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.015)" };
const sectionTitle: React.CSSProperties = { margin: "0 0 10px", color: theme.colors.accentHighlight, fontSize: "var(--fs-small)", fontWeight: 800, letterSpacing: ".065em", textTransform: "uppercase" };

export function SpellFormModal({ spell, onClose, onSaved }: { spell: SpellForEdit | null; onClose: () => void; onSaved: () => void }) {
  const isCreate = spell == null;
  const [form, setForm] = React.useState<SpellFormData>(() => spell ? spellToForm(spell) : emptySpellForm());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [accessQuery, setAccessQuery] = React.useState("");
  const set = <K extends keyof SpellFormData>(key: K, value: SpellFormData[K]) => setForm((current) => ({ ...current, [key]: value }));

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const body = buildSpellPayload(form, spell);
      await api(isCreate ? "/api/spells" : `/api/spells/${encodeURIComponent(spell!.id)}`, { method: isCreate ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      onSaved();
    } catch (reason) {
      setError(String((reason as Error)?.message ?? reason));
    } finally { setBusy(false); }
  }

  const filteredAccess = ACCESS_OPTIONS.filter((option) => option.label.toLowerCase().includes(accessQuery.toLowerCase()));
  const baseAccess = ACCESS_OPTIONS.filter((option) => !option.id.slice(3).includes("_"));
  const subclassAccess = filteredAccess.filter((option) => option.id.slice(3).includes("_"));
  const selectedSubclassCount = form.access.filter((id) => id.slice(3).includes("_")).length;
  return <div onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: withAlpha("#000", .72), padding: 12 }}>
    <form onSubmit={save} style={{ width: "min(1180px, 100%)", height: "calc(100vh - 24px)", margin: "auto", background: "rgba(10,18,33,0.985)", border: "1px solid rgba(120,150,200,0.2)", borderRadius: 14, boxShadow: "0 26px 80px rgba(0,0,0,0.58)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ padding: "14px 20px", borderBottom: `1px solid ${theme.colors.panelBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}><strong style={{ fontSize: "var(--fs-body)" }}>{isCreate ? "New Spell" : `Edit: ${spell!.name}`}</strong><button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "transparent", color: theme.colors.muted, fontSize: 24, cursor: "pointer" }}>×</button></header>
      <div className="spell-form-workspace" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(340px, .85fr)", gap: 12, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section style={sectionStyle}><h3 style={sectionTitle}>Identity</h3>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 150px 180px", gap: 10 }}><label style={labelStyle}>Name *<Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} /></label><label style={labelStyle}>Ruleset<SpellChoiceMenu ariaLabel="Ruleset" value={form.ruleset} onChange={(value) => set("ruleset", value as SpellFormData["ruleset"])} options={[{ value: "5.5e", label: "5.5e (2024)" }, { value: "5e", label: "5e (2014)" }]} /></label><label style={labelStyle}>Level<SpellChoiceMenu ariaLabel="Spell level" value={form.level} onChange={(value) => set("level", value)} options={[{ value: "", label: "Unspecified" }, { value: "0", label: "Cantrip" }, ...Array.from({ length: 9 }, (_, i) => ({ value: String(i + 1), label: `Level ${i + 1}` }))]} /></label></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}><label style={labelStyle}>School<SpellChoiceMenu ariaLabel="Spell school" value={form.school} onChange={(value) => set("school", value)} options={[{ value: "", label: "Unspecified" }, ...SCHOOLS.map((school) => ({ value: school, label: school }))]} /></label><label style={labelStyle}>Source<Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Book and page, or Homebrew" /></label></div>
          </section>

          <section style={sectionStyle}><h3 style={sectionTitle}>Casting</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label style={labelStyle}>Casting time<Input value={form.time} onChange={(e) => set("time", e.target.value)} placeholder="1 action" /></label><label style={labelStyle}>Range<Input value={form.range} onChange={(e) => set("range", e.target.value)} placeholder="150 feet" /></label><label style={labelStyle}>Duration<Input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="Instantaneous" /></label><div style={{ display: "flex", alignItems: "end", gap: 6, paddingBottom: 3 }}><button type="button" style={togglePillStyle(form.concentration)} onClick={() => set("concentration", !form.concentration)}>Concentration</button><button type="button" style={togglePillStyle(form.ritual)} onClick={() => set("ritual", !form.ritual)}>Ritual</button></div></div>
            <div style={{ marginTop: 12 }}><div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, marginBottom: 6 }}>Components</div><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><button type="button" style={togglePillStyle(form.verbal)} onClick={() => set("verbal", !form.verbal)}>Verbal</button><button type="button" style={togglePillStyle(form.somatic)} onClick={() => set("somatic", !form.somatic)}>Somatic</button><button type="button" style={togglePillStyle(form.material)} onClick={() => set("material", !form.material)}>Material</button>{form.material ? <Input value={form.materialText} onChange={(e) => set("materialText", e.target.value)} placeholder="Material component (optional)" style={{ flex: 1, minWidth: 260 }} /> : null}</div></div>
          </section>

          <section style={sectionStyle}><h3 style={sectionTitle}>Resolution</h3><div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginBottom: 8 }}>Choose one resolution when the spell requires a spell attack or saving throw.</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{CHECK_OPTIONS.map((option) => <button key={option.value} type="button" style={togglePillStyle(form.check === option.value)} onClick={() => set("check", form.check === option.value ? "" : option.value)}>{option.label}</button>)}</div></section>

          <section style={sectionStyle}><h3 style={sectionTitle}>Description *</h3><div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginBottom: 7 }}>Separate paragraphs with a blank line.</div><TextArea value={form.text} onChange={(e) => set("text", e.target.value)} style={{ minHeight: 260 }} /></section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section style={sectionStyle}><h3 style={sectionTitle}>Spell lists</h3><div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginBottom: 8 }}>Choose the base class lists first. Add subclass lists only when the spell is granted specifically by that subclass.</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{baseAccess.map((option) => <button key={option.id} type="button" style={togglePillStyle(form.access.includes(option.id))} onClick={() => set("access", form.access.includes(option.id) ? form.access.filter((id) => id !== option.id) : [...form.access, option.id])}>{option.label}</button>)}</div><details style={{ marginTop: 10 }}><summary style={{ color: theme.colors.muted, cursor: "pointer", fontSize: "var(--fs-small)", fontWeight: 700 }}>Subclass lists{selectedSubclassCount ? ` · ${selectedSubclassCount} selected` : ""}</summary><div style={{ paddingTop: 8 }}><Input value={accessQuery} onChange={(e) => setAccessQuery(e.target.value)} placeholder="Filter subclass lists…" /><div style={{ maxHeight: 220, overflowY: "auto", marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>{subclassAccess.map((option) => <button key={option.id} type="button" style={togglePillStyle(form.access.includes(option.id))} onClick={() => set("access", form.access.includes(option.id) ? form.access.filter((id) => id !== option.id) : [...form.access, option.id])}>{option.label}</button>)}</div></div></details></section>

          <section style={sectionStyle}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={sectionTitle}>Damage, healing and scaling</h3><Button type="button" variant="ghost" onClick={() => set("rolls", [...form.rolls, { formula: "", effects: [], description: "", level: "" }])}>+ Roll</Button></div>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginBottom: 8 }}>For cantrips, Level is the character-level tier. For leveled spells, it is the slot level.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{form.rolls.map((roll, index) => <div key={index} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 9, padding: 9 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 100px 30px", gap: 6 }}><Input value={roll.formula} onChange={(e) => set("rolls", form.rolls.map((row, i) => i === index ? { ...row, formula: e.target.value } : row))} placeholder="8d6" /><Input type="number" min={0} max={20} value={roll.level} onChange={(e) => set("rolls", form.rolls.map((row, i) => i === index ? { ...row, level: e.target.value } : row))} placeholder="Level" /><button type="button" aria-label="Remove roll" onClick={() => set("rolls", form.rolls.filter((_, i) => i !== index))}>×</button></div><Input value={roll.description} onChange={(e) => set("rolls", form.rolls.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} placeholder="Optional roll description" style={{ marginTop: 6 }} /><div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>{EFFECT_OPTIONS.map((effect) => <button key={effect} type="button" style={togglePillStyle(roll.effects.includes(effect))} onClick={() => set("rolls", form.rolls.map((row, i) => i === index ? { ...row, effects: row.effects.includes(effect) ? row.effects.filter((value) => value !== effect) : [...row.effects, effect] } : row))}>{effect.replace("_", " ")}</button>)}</div></div>)}</div>
            {!form.rolls.length ? <div style={{ color: theme.colors.muted, fontStyle: "italic", fontSize: "var(--fs-small)" }}>No structured rolls.</div> : null}
          </section>
        </div>
      </div>
      {error ? <div style={{ margin: "0 20px 8px", padding: 8, color: theme.colors.red, background: withAlpha(theme.colors.red, .1), borderRadius: 8 }}>{error}</div> : null}
      <footer style={{ padding: "12px 20px", borderTop: `1px solid ${theme.colors.panelBorder}`, display: "flex", justifyContent: "flex-end", gap: 8 }}><Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : isCreate ? "Create Spell" : "Save Changes"}</Button></footer>
    </form>
  </div>;
}
