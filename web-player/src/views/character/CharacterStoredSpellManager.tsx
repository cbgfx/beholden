import React from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { Select } from "@/ui/Select";
import { Button } from "@/ui/Button";
import { inputStyle } from "@/views/character/CharacterInventoryPanelHelpers";
import type { InventoryItem, StoredItemSpell } from "@/views/character/CharacterInventoryTypes";
import { getStoredSpellTemplate, storedSpellLevelsUsed, validStoredSlotLevels } from "./CharacterStoredSpellUtils";

type SpellResult = { id: string; name: string; level: number | null; school?: string | null };

export function CharacterStoredSpellManager({ item, ruleset, onSave }: {
  item: InventoryItem;
  ruleset?: "5e" | "5.5e";
  accentColor: string;
  onSave: (patch: Partial<InventoryItem>) => Promise<void>;
}) {
  const template = getStoredSpellTemplate(item.spellTemplate);
  const spells = item.storedSpells ?? [];
  const used = storedSpellLevelsUsed(spells);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SpellResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [slotLevels, setSlotLevels] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    const value = query.trim();
    if (!template || value.length < 2 || used >= template.capacity) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    const rulesetParam = ruleset ? `&ruleset=${encodeURIComponent(ruleset)}` : "";
    setLoading(true);
    api<SpellResult[]>(`/api/spells/search?q=${encodeURIComponent(value)}&minLevel=${template.minLevel ?? 1}&maxLevel=${template.maxLevel ?? 9}&limit=12&lite=1&excludeSpecial=1${rulesetParam}`)
      .then((rows) => { if (active) setResults(Array.isArray(rows) ? rows.filter((spell) => spell.level != null && spell.level > 0) : []); })
      .catch(() => { if (active) setResults([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, ruleset, template, used]);

  if (!template) return null;

  async function store(spell: SpellResult) {
    if (spell.level == null) return;
    const allowed = validStoredSlotLevels(template!, spell.level, used);
    const slotLevel = slotLevels[spell.id] ?? allowed[0];
    if (!allowed.includes(slotLevel)) return;
    const stored: StoredItemSpell = {
      instanceId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      id: spell.id,
      name: spell.name,
      level: spell.level,
      slotLevel,
    };
    await onSave({ storedSpells: [...spells, stored] });
    setQuery("");
    setResults([]);
  }

  async function remove(instanceId: string) {
    await onSave({ storedSpells: spells.filter((spell) => spell.instanceId !== instanceId) });
  }

  return (
    <section style={{ display: "grid", gap: 8, padding: 12, border: `1px solid ${C.panelBorder}`, borderRadius: 12, background: "rgba(255,255,255,0.025)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <span style={labelStyle}>Stored Spells</span>
        <span style={{ color: used > template.capacity ? C.red : C.muted, fontSize: "var(--fs-small)", fontWeight: 800 }}>{used} / {template.capacity} spell levels</span>
      </div>
      {spells.length ? spells.map((spell) => (
        <div key={spell.instanceId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 800 }}>{spell.name}</div>
            <div style={{ color: C.muted, fontSize: "var(--fs-tiny)" }}>Stored at level {spell.slotLevel}</div>
          </div>
          <Button type="button" variant="primary" onClick={() => { void remove(spell.instanceId); }} style={{ padding: "5px 9px", borderRadius: 7 }}>Cast</Button>
          <Button type="button" variant="ghost" title="Remove without casting" onClick={() => { void remove(spell.instanceId); }} style={{ padding: "5px 9px", borderRadius: 7 }}>Remove</Button>
        </div>
      )) : <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>The ring is empty.</div>}
      {used < template.capacity ? (
        <div style={{ position: "relative", display: "grid", gap: 6 }}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a spell to store..." style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          {loading ? <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>Searching...</div> : null}
          {results.map((spell) => {
            const allowed = validStoredSlotLevels(template, spell.level ?? 0, used);
            if (!allowed.length) return null;
            const selected = slotLevels[spell.id] ?? allowed[0];
            return <div key={spell.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.panelBorder}` }}>
              <span style={{ flex: 1, color: C.text }}>{spell.name} <span style={{ color: C.muted }}>(level {spell.level})</span></span>
              <Select aria-label={`Slot level for ${spell.name}`} value={selected} onChange={(event) => setSlotLevels((current) => ({ ...current, [spell.id]: Number(event.target.value) }))}>
                {allowed.map((level) => <option key={level} value={level}>Level {level}</option>)}
              </Select>
              <Button type="button" variant="primary" onClick={() => { void store(spell); }} style={{ padding: "5px 9px", borderRadius: 7 }}>Store</Button>
            </div>;
          })}
        </div>
      ) : <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>The ring is full.</div>}
    </section>
  );
}

const labelStyle: React.CSSProperties = { color: C.muted, fontSize: "var(--fs-small)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" };
