import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { TextArea } from "@/ui/TextArea";
import { Button } from "@/ui/Button";
import { api } from "@/services/api";

export type SpellForEdit = {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  classes: string | null;
  text: string[];
};

type FormData = {
  name: string;
  level: string;
  school: string;
  time: string;
  range: string;
  components: string;
  duration: string;
  classes: string;
  text: string;
};

const SCHOOLS = [
  "Abjuration", "Conjuration", "Divination", "Enchantment",
  "Evocation", "Illusion", "Necromancy", "Transmutation",
];

const EMPTY: FormData = {
  name: "", level: "", school: "", time: "",
  range: "", components: "", duration: "", classes: "", text: "",
};

function spellToForm(s: SpellForEdit): FormData {
  return {
    name:       s.name ?? "",
    level:      s.level != null ? String(s.level) : "",
    school:     s.school ?? "",
    time:       s.time ?? "",
    range:      s.range ?? "",
    components: s.components ?? "",
    duration:   s.duration ?? "",
    classes:    s.classes ?? "",
    text:       (s.text ?? []).join("\n\n"),
  };
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  color: theme.colors.muted,
};

export function SpellFormModal(props: {
  /** null = create mode, non-null = edit mode */
  spell: SpellForEdit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isCreate = props.spell == null;
  const [form, setForm] = React.useState<FormData>(() =>
    props.spell ? spellToForm(props.spell) : EMPTY
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") props.onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [props.onClose]);

  function set(field: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setBusy(true);
    setError(null);

    const levelNum = form.level.trim() !== "" ? Number(form.level) : null;
    const body = {
      name:       form.name.trim(),
      level:      levelNum != null && Number.isFinite(levelNum) ? levelNum : null,
      school:     form.school.trim() || null,
      time:       form.time.trim() || null,
      range:      form.range.trim() || null,
      components: form.components.trim() || null,
      duration:   form.duration.trim() || null,
      classes:    form.classes.trim() || null,
      text:       form.text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean),
    };

    try {
      if (isCreate) {
        await api("/api/spells", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        await api(`/api/spells/${encodeURIComponent(props.spell!.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      props.onSaved();
    } catch (err: unknown) {
      setError(String((err as any)?.message ?? err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: withAlpha("#000000", 0.65),
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div
        style={{
          background: theme.colors.panelBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 16,
          padding: 24,
          width: 580,
          maxHeight: "90vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        <h2 style={{ margin: "0 0 16px 0", color: theme.colors.text, fontSize: "var(--fs-large)", fontWeight: 900 }}>
          {isCreate ? "New Spell" : `Edit: ${props.spell!.name}`}
        </h2>

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Name */}
          <label style={labelStyle}>
            Name *
            <Input value={form.name} onChange={set("name")} placeholder="Fireball" autoFocus />
          </label>

          {/* Level + School */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
            <label style={labelStyle}>
              Level
              <Select value={form.level} onChange={set("level")}>
                <option value="">—</option>
                <option value="0">Cantrip (0)</option>
                {Array.from({ length: 9 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>Level {i + 1}</option>
                ))}
              </Select>
            </label>
            <label style={labelStyle}>
              School
              <Input value={form.school} onChange={set("school")} list="spell-schools-list" placeholder="Evocation" />
              <datalist id="spell-schools-list">
                {SCHOOLS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </label>
          </div>

          {/* Casting Time + Range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={labelStyle}>
              Casting Time
              <Input value={form.time} onChange={set("time")} placeholder="1 action" />
            </label>
            <label style={labelStyle}>
              Range
              <Input value={form.range} onChange={set("range")} placeholder="150 feet" />
            </label>
          </div>

          {/* Duration + Components */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={labelStyle}>
              Duration
              <Input value={form.duration} onChange={set("duration")} placeholder="Instantaneous" />
            </label>
            <label style={labelStyle}>
              Components
              <Input value={form.components} onChange={set("components")} placeholder="V, S, M (…)" />
            </label>
          </div>

          {/* Classes */}
          <label style={labelStyle}>
            Classes
            <Input value={form.classes} onChange={set("classes")} placeholder="Sorcerer, Wizard" />
          </label>

          {/* Description */}
          <label style={labelStyle}>
            Description
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginTop: -2 }}>
              Separate paragraphs with a blank line.
            </div>
            <TextArea
              value={form.text}
              onChange={set("text")}
              placeholder={"You hurl a bright streak of fire that explodes…\n\nAt Higher Levels: When you cast this spell…"}
              style={{ minHeight: 200 }}
            />
          </label>

          {error && (
            <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)", padding: "6px 8px", background: withAlpha(theme.colors.red, 0.1), borderRadius: 8 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4, paddingTop: 8, borderTop: `1px solid ${theme.colors.panelBorder}` }}>
            <Button type="button" variant="ghost" onClick={props.onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? "Saving…" : isCreate ? "Create Spell" : "Save Changes"}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
