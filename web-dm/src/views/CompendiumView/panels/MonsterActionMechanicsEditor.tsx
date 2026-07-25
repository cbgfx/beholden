import type * as React from "react";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { theme, withAlpha } from "@/theme/theme";
import type { MonsterBlock } from "./MonsterFormParts";

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>;
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: grow ? 1 : undefined, minWidth: 0 }}><label style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 600 }}>{label}</label>{children}</div>;
}

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asRows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(asRecord) : [];
const optionalNumber = (value: string) => value === "" ? undefined : Number(value);

const miniButton: React.CSSProperties = {
  border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 6,
  background: withAlpha(theme.colors.accentPrimary, 0.12), color: theme.colors.accentPrimary,
  cursor: "pointer", fontWeight: 700, padding: "3px 8px",
};

export function MonsterActionMechanicsEditor({ block, onChange }: { block: MonsterBlock; onChange: (block: MonsterBlock) => void }) {
  const set = (field: string, value: unknown) => {
    const next = { ...block };
    if (value === undefined) delete next[field]; else next[field] = value;
    onChange(next);
  };
  const attack = asRecord(block.attack);
  const damage = Array.isArray(block.damage) ? asRows(block.damage) : Object.keys(asRecord(block.damage)).length ? [asRecord(block.damage)] : [];
  const recharge = asRecord(block.recharge);
  const routines = asRows(block.routine);
  const replacement = asRecord(block.replace);
  const spellSlots = Object.entries(asRecord(block.spellSlots));
  const rechargeKind = recharge.roll != null ? "roll" : recharge.uses != null && recharge.period === "day" ? "day" : recharge.uses != null ? "turn" : recharge.period === "short_rest" ? "short_rest" : recharge.period === "long_rest" ? "long_rest" : "";

  const updateDamage = (index: number, field: "roll" | "type", value: string) => {
    const fieldValue = field === "type" && value.includes(",") ? value.split(",").map((part) => part.trim()).filter(Boolean) : value;
    const rows = damage.map((row, i) => i === index ? { ...row, [field]: fieldValue } : row);
    set("damage", rows.length === 1 ? rows[0] : rows);
  };
  const updateRoutine = (index: number, next: Record<string, unknown>) => set("routine", routines.map((row, i) => i === index ? next : row));

  return (
    <details style={{ borderTop: `1px solid ${theme.colors.panelBorder}`, paddingTop: 7 }}>
      <summary style={{ color: theme.colors.accentPrimary, cursor: "pointer", fontSize: "var(--fs-small)", fontWeight: 700 }}>Structured mechanics (optional)</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
        <FieldRow>
          <Field label="Stable action ID" grow><Input value={block.id ?? ""} onChange={(event) => set("id", event.target.value || undefined)} placeholder="Generated if empty" /></Field>
          <Field label="Area" grow><Select value={typeof block.area === "string" ? block.area : ""} onChange={(event) => { set("area", event.target.value || undefined); if (event.target.value) set("targets", undefined); }}><option value="">None</option>{["cone", "line", "sphere", "cube", "emanation"].map((area) => <option key={area} value={area}>{area}</option>)}</Select></Field>
          <Field label="Selected targets" grow><Input type="number" min={2} value={typeof block.targets === "number" ? block.targets : ""} disabled={Boolean(block.area)} onChange={(event) => set("targets", optionalNumber(event.target.value))} placeholder="2+" /></Field>
        </FieldRow>

        <div>
          <label style={{ color: theme.colors.text, fontSize: "var(--fs-small)", fontWeight: 650 }}><input type="checkbox" checked={Object.keys(attack).length > 0} onChange={(event) => set("attack", event.target.checked ? { toHit: 0 } : undefined)} /> Attack roll</label>
          {Object.keys(attack).length > 0 ? <FieldRow>
            <Field label="To hit" grow><Input type="number" value={typeof attack.toHit === "number" ? attack.toHit : 0} onChange={(event) => set("attack", { ...attack, toHit: Number(event.target.value) })} /></Field>
            <Field label="Reach" grow><Input value={typeof attack.reach === "string" ? attack.reach : ""} onChange={(event) => set("attack", { ...attack, reach: event.target.value || undefined })} placeholder="5 ft." /></Field>
            <Field label="Range" grow><Input value={typeof attack.range === "string" ? attack.range : ""} onChange={(event) => set("attack", { ...attack, range: event.target.value || undefined })} placeholder="30/120 ft." /></Field>
            <label style={{ paddingTop: 22 }}><input type="checkbox" checked={attack.melee === true} onChange={(event) => set("attack", { ...attack, melee: event.target.checked || undefined })} /> Melee</label>
            <label style={{ paddingTop: 22 }}><input type="checkbox" checked={attack.ranged === true} onChange={(event) => set("attack", { ...attack, ranged: event.target.checked || undefined })} /> Ranged</label>
          </FieldRow> : null}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ fontSize: "var(--fs-small)" }}>Damage components</strong><button type="button" style={miniButton} onClick={() => set("damage", [...damage, { roll: "", type: "" }])}>+ Damage</button></div>
          {damage.map((row, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 30px", gap: 6, marginTop: 5 }}><Input value={String(row.roll ?? "")} onChange={(event) => updateDamage(index, "roll", event.target.value)} placeholder="2d10 + 4" /><Input value={Array.isArray(row.type) ? row.type.join(", ") : String(row.type ?? "")} onChange={(event) => updateDamage(index, "type", event.target.value)} placeholder="piercing" /><button type="button" onClick={() => { const rows = damage.filter((_, i) => i !== index); set("damage", rows.length === 0 ? undefined : rows.length === 1 ? rows[0] : rows); }}>×</button></div>)}
        </div>

        <FieldRow>
          <Field label="Recharge" grow><Select value={rechargeKind} onChange={(event) => { const kind = event.target.value; set("recharge", kind === "roll" ? { roll: 5 } : kind === "day" ? { uses: 1, period: "day" } : kind === "turn" ? { uses: 1, period: "turn" } : kind ? { period: kind } : undefined); }}><option value="">None</option><option value="roll">Die roll</option><option value="day">Uses / day</option><option value="turn">Uses / turn</option><option value="short_rest">Short rest</option><option value="long_rest">Long rest</option></Select></Field>
          {rechargeKind === "roll" ? <Field label="Minimum d6 roll" grow><Input type="number" min={1} max={6} value={Number(recharge.roll ?? 5)} onChange={(event) => set("recharge", { roll: Number(event.target.value) })} /></Field> : null}
          {rechargeKind === "day" || rechargeKind === "turn" ? <Field label="Uses" grow><Input type="number" min={1} value={Number(recharge.uses ?? 1)} onChange={(event) => set("recharge", { uses: Number(event.target.value), period: rechargeKind })} /></Field> : null}
        </FieldRow>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ fontSize: "var(--fs-small)" }}>Multiattack routine</strong><button type="button" style={miniButton} onClick={() => set("routine", [...routines, { use: "" }])}>+ Step</button></div>
          {routines.map((row, index) => {
            const choose = Array.isArray(row.choose);
            const refs = choose ? (row.choose as string[]).join(", ") : String(row.use ?? "");
            return <div key={index} style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr) 90px 90px 30px", gap: 5, marginTop: 5 }}><Select value={choose ? "choose" : "use"} onChange={(event) => updateRoutine(index, event.target.value === "choose" ? { choose: ["", ""] } : { use: "" })}><option value="use">Use action</option><option value="choose">Choose from</option></Select><Input value={refs} onChange={(event) => updateRoutine(index, { ...row, ...(choose ? { choose: event.target.value.split(",").map((id) => id.trim()) } : { use: event.target.value }) })} placeholder={choose ? "action_a, action_b" : "action_id"} /><Input type="number" min={2} value={typeof row.count === "number" ? row.count : ""} onChange={(event) => updateRoutine(index, { ...row, count: optionalNumber(event.target.value) })} placeholder="Count" /><label><input type="checkbox" checked={row.optional === true} onChange={(event) => updateRoutine(index, { ...row, optional: event.target.checked || undefined })} /> Optional</label><button type="button" onClick={() => set("routine", routines.filter((_, i) => i !== index).length ? routines.filter((_, i) => i !== index) : undefined)}>×</button></div>;
          })}
        </div>

        <div>
          <label style={{ fontSize: "var(--fs-small)", fontWeight: 650 }}><input type="checkbox" checked={Object.keys(replacement).length > 0} onChange={(event) => set("replace", event.target.checked ? { with: [""] } : undefined)} /> Replaces attacks in a routine</label>
          {Object.keys(replacement).length > 0 ? <FieldRow><Field label="Replacement action IDs (comma separated)" grow><Input value={Array.isArray(replacement.with) ? replacement.with.join(", ") : ""} onChange={(event) => set("replace", { ...replacement, with: event.target.value.split(",").map((id) => id.trim()) })} /></Field><Field label="Count" grow><Input type="number" min={2} value={typeof replacement.count === "number" ? replacement.count : ""} onChange={(event) => set("replace", { ...replacement, count: optionalNumber(event.target.value) })} /></Field></FieldRow> : null}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><strong style={{ fontSize: "var(--fs-small)" }}>Spell slots</strong><button type="button" style={miniButton} onClick={() => set("spellSlots", Object.fromEntries([...spellSlots, ["1", 0]]))}>+ Level</button></div>
          {spellSlots.map(([level, slots], index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 30px", gap: 5, marginTop: 5 }}><Input value={level} onChange={(event) => { const rows = [...spellSlots]; rows[index] = [event.target.value, slots]; set("spellSlots", Object.fromEntries(rows)); }} placeholder="Level or pact" /><Input type="number" min={0} value={Number(slots)} onChange={(event) => { const rows = [...spellSlots]; rows[index] = [level, Number(event.target.value)]; set("spellSlots", Object.fromEntries(rows)); }} placeholder="Slots" /><button type="button" onClick={() => { const rows = spellSlots.filter((_, i) => i !== index); set("spellSlots", rows.length ? Object.fromEntries(rows) : undefined); }}>×</button></div>)}
        </div>
      </div>
    </details>
  );
}
