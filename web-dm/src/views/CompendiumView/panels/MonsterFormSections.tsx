
import * as React from "react";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { accentButtonStyle } from "@beholden/shared/ui";
import { api } from "@/services/api";
import { expandSchool } from "@beholden/shared/domain/compendium/expandSchool";
import { useSpellSearch } from "@/views/CompendiumView/hooks/useSpellSearch";
import {
  AbilityInput,
  baseInput,
  BlockEditor,
  Field,
  FieldRow,
  MonsterLairBlock,
  MonsterSpellReference,
  SectionHeader,
  SIZES,
  TYPES,
} from "./MonsterFormParts";
import { type MonsterFormState, type NamedBonus } from "./monsterFormMapping";

type SetField = <K extends keyof MonsterFormState>(field: K, value: MonsterFormState[K]) => void;

function NamedBonusEditor({ label, rows, onChange, namePlaceholder }: {
  label: string;
  rows: NamedBonus[];
  onChange: (rows: NamedBonus[]) => void;
  namePlaceholder: string;
}) {
  const update = (index: number, field: keyof NamedBonus, value: string) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  return (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 600 }}>{label}</span>
        <button
          type="button" onClick={() => onChange([...rows, { name: "", bonus: "" }])}
          style={{
            ...accentButtonStyle(theme.colors.accentPrimary, { padding: "2px 8px", fontSize: "var(--fs-small)", borderRadius: 6 }),
            fontWeight: 700,
          }}
        >
          + Add
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map((row, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 28px", gap: 5 }}>
            <Input value={row.name} onChange={(event) => update(index, "name", event.target.value)} placeholder={namePlaceholder} />
            <Input type="number" value={row.bonus} onChange={(event) => update(index, "bonus", event.target.value)} placeholder="Bonus" />
            <Button
              type="button" variant="danger" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              aria-label={`Remove ${label} row`}
              style={{ padding: 0, borderRadius: 6 }}
            >
              ×
            </Button>
          </div>
        ))}
        {rows.length === 0 ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", fontStyle: "italic" }}>None</div> : null}
      </div>
    </div>
  );
}

export function MonsterIdentitySection({
  form,
  setField,
}: {
  form: MonsterFormState;
  setField: SetField;
}) {
  return (
    <div>
      <SectionHeader title="Identity" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FieldRow>
          <Field label="Name *" grow>
            <Input
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Ancient Red Dragon"
              required
            />
          </Field>
          <Field label="CR" style={{ minWidth: 90 }}>
            <Input value={form.cr} onChange={(e) => setField("cr", e.target.value)} placeholder="e.g. 17 or 1/4" />
          </Field>
          <Field label="Ruleset" style={{ minWidth: 120 }}>
            <Select value={form.ruleset} onChange={(e) => setField("ruleset", e.target.value as MonsterFormState["ruleset"])} style={{ width: "100%" }}>
              <option value="5.5e">5.5e (2024)</option>
              <option value="5e">5e (2014)</option>
            </Select>
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Source" grow><Input value={form.source} onChange={(e) => setField("source", e.target.value)} placeholder="e.g. Homebrew or book and page" /></Field>
          <Field label="XP" style={{ minWidth: 140 }}><Input type="number" min={0} value={form.xp} onChange={(e) => setField("xp", e.target.value)} placeholder="Optional" /></Field>
        </FieldRow>
        <FieldRow>
          <Field label="Type" grow>
            <input
              value={form.typeFull}
              onChange={(e) => setField("typeFull", e.target.value)}
              placeholder="e.g. humanoid (goblinoid)"
              list="mfm-type-list"
              style={baseInput}
            />
            <datalist id="mfm-type-list">
              {TYPES.map((type) => (
                <option key={type} value={type} />
              ))}
            </datalist>
          </Field>
          <Field label="Size" style={{ minWidth: 130 }}>
            <Select value={form.size} onChange={(e) => setField("size", e.target.value)} style={{ width: "100%" }}>
              <option value="">-</option>
              {SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Environment" grow>
            <Input
              value={form.environment}
              onChange={(e) => setField("environment", e.target.value)}
              placeholder="e.g. forest, mountain"
            />
          </Field>
        </FieldRow>
        <Field label="Alignment"><Input value={form.alignment} onChange={(e) => setField("alignment", e.target.value)} placeholder="e.g. Chaotic Evil" /></Field>
        <Field label="Description">
          <textarea value={form.description} onChange={(e) => setField("description", e.target.value)} rows={4} placeholder="Monster lore or overview" style={{ ...baseInput, resize: "vertical", fontFamily: "inherit" }} />
        </Field>
      </div>
    </div>
  );
}

export function MonsterCombatStatsSection({
  form,
  setField,
}: {
  form: MonsterFormState;
  setField: SetField;
}) {
  return (
    <div>
      <SectionHeader title="Combat Stats" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FieldRow>
          <Field label="AC" style={{ minWidth: 100 }}><Input type="number" min={1} value={form.ac} onChange={(e) => setField("ac", e.target.value)} placeholder="17" /></Field>
          <Field label="AC Source" grow><Input value={form.acSource} onChange={(e) => setField("acSource", e.target.value)} placeholder="e.g. natural armor" /></Field>
          <Field label="Average HP" style={{ minWidth: 130 }}><Input type="number" min={1} value={form.hpAverage} onChange={(e) => setField("hpAverage", e.target.value)} placeholder="256" /></Field>
          <Field label="Hit Dice Formula" grow><Input value={form.hpFormula} onChange={(e) => setField("hpFormula", e.target.value)} placeholder="19d20 + 57" /></Field>
        </FieldRow>
        <FieldRow>
          {(["walk", "burrow", "climb", "fly", "swim"] as const).map((field) => (
            <Field key={field} label={`${field[0]!.toUpperCase()}${field.slice(1)} speed`} grow>
              <Input type="number" min={0} value={form[field]} onChange={(e) => setField(field, e.target.value)} placeholder="ft." />
            </Field>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 7, color: theme.colors.text, fontSize: "var(--fs-small)", paddingTop: 20 }}><input type="checkbox" checked={form.hover} onChange={(e) => setField("hover", e.target.checked)} /> Hover</label>
        </FieldRow>
        <FieldRow>
          <Field label="Initiative bonus" grow><Input type="number" value={form.initiativeBonus} onChange={(e) => setField("initiativeBonus", e.target.value)} placeholder="Optional" /></Field>
          <Field label="Passive Perception" grow><Input type="number" min={0} value={form.passivePerception} onChange={(e) => setField("passivePerception", e.target.value)} placeholder="Optional" /></Field>
        </FieldRow>
      </div>
    </div>
  );
}

export function MonsterAbilityScoresSection({
  form,
  setField,
}: {
  form: MonsterFormState;
  setField: SetField;
}) {
  return (
    <div>
      <SectionHeader title="Ability Scores" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {([
          ["STR", "str"],
          ["DEX", "dex"],
          ["CON", "con"],
          ["INT", "int_"],
          ["WIS", "wis"],
          ["CHA", "cha"],
        ] as const).map(([label, field]) => (
          <AbilityInput
            key={label}
            label={label}
            value={form[field]}
            onChange={(value) => setField(field, value)}
          />
        ))}
      </div>
    </div>
  );
}

export function MonsterProficienciesSection({
  form,
  setField,
}: {
  form: MonsterFormState;
  setField: SetField;
}) {
  return (
    <div>
      <SectionHeader title="Proficiencies &amp; Senses" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FieldRow>
          <NamedBonusEditor label="Saving Throws" rows={form.saves} onChange={(rows) => setField("saves", rows)} namePlaceholder="e.g. STR" />
          <NamedBonusEditor label="Skills" rows={form.skills} onChange={(rows) => setField("skills", rows)} namePlaceholder="e.g. Perception" />
        </FieldRow>
        <FieldRow>
          <Field label="Senses" grow>
            <Input
              value={form.senses}
              onChange={(e) => setField("senses", e.target.value)}
              placeholder="e.g. darkvision 60 ft., passive Perception 14"
            />
          </Field>
          <Field label="Languages" grow>
            <Input value={form.languages} onChange={(e) => setField("languages", e.target.value)} placeholder="e.g. Common, Draconic" />
          </Field>
        </FieldRow>
      </div>
    </div>
  );
}

export function MonsterDamageConditionsSection({
  form,
  setField,
}: {
  form: MonsterFormState;
  setField: SetField;
}) {
  return (
    <div>
      <SectionHeader title="Damage &amp; Conditions" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <FieldRow>
          <Field label="Immunities" grow>
            <Input value={form.immune} onChange={(e) => setField("immune", e.target.value)} placeholder="e.g. fire, poison" />
          </Field>
          <Field label="Resistances" grow>
            <Input value={form.resist} onChange={(e) => setField("resist", e.target.value)} placeholder="e.g. cold, lightning" />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="Vulnerabilities" grow>
            <Input
              value={form.vulnerable}
              onChange={(e) => setField("vulnerable", e.target.value)}
              placeholder="e.g. thunder"
            />
          </Field>
          <Field label="Condition Immunities" grow>
            <Input
              value={form.condImm}
              onChange={(e) => setField("condImm", e.target.value)}
              placeholder="e.g. charmed, frightened"
            />
          </Field>
        </FieldRow>
        <Field label="Treasure"><Input value={form.treasure} onChange={(e) => setField("treasure", e.target.value)} placeholder="Optional treasure guidance" /></Field>
      </div>
    </div>
  );
}

export function MonsterBlocksSection({
  form,
  setField,
}: {
  form: MonsterFormState;
  setField: SetField;
}) {
  return (
    <>
      <BlockEditor label="Traits" blocks={form.traits} onChange={(value) => setField("traits", value)} />
      <BlockEditor label="Actions" blocks={form.actions} onChange={(value) => setField("actions", value)} />
      <BlockEditor label="Reactions" blocks={form.reactions} onChange={(value) => setField("reactions", value)} />
      <div style={{ maxWidth: 180 }}><Field label="Legendary uses"><Input type="number" min={1} value={form.legendaryUses} onChange={(e) => setField("legendaryUses", e.target.value)} placeholder="3" /></Field></div>
      <BlockEditor label="Legendary Actions" blocks={form.legendary} onChange={(value) => setField("legendary", value)} />
      <BlockEditor label="Spellcasting traits" help="Rules text and structured mechanics for features such as Innate Spellcasting or a monster's prepared spellcasting ability." blocks={form.spellcasting} onChange={(value) => setField("spellcasting", value)} />
      <LairEditor blocks={form.lair} onChange={(value) => setField("lair", value)} />
      <SpellReferenceEditor spells={form.spells} ruleset={form.ruleset} onChange={(value) => setField("spells", value)} />
    </>
  );
}

function LairEditor({ blocks, onChange }: { blocks: MonsterLairBlock[]; onChange: (value: MonsterLairBlock[]) => void }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader title="Lair" />
        <button
          type="button" onClick={() => onChange([...blocks, { name: "", description: "" }])}
          style={{
            ...accentButtonStyle(theme.colors.accentPrimary, { padding: "2px 8px", fontSize: "var(--fs-small)", borderRadius: 6 }),
            fontWeight: 700,
          }}
        >
          + Add
        </button>
      </div>
      {blocks.map((block, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(180px,.35fr) minmax(0,1fr) 30px", gap: 6, marginBottom: 6 }}><Input value={block.name} onChange={(event) => onChange(blocks.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} placeholder="Lair action name" /><Input value={block.description} onChange={(event) => onChange(blocks.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} placeholder="Description" /><Button type="button" variant="danger" title="Remove" onClick={() => onChange(blocks.filter((_, i) => i !== index))} style={{ padding: 0, borderRadius: 6 }}>×</Button></div>)}
      {!blocks.length ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontStyle: "italic" }}>None</div> : null}
    </div>
  );
}

function SpellReferenceEditor({ spells, ruleset, onChange }: { spells: MonsterSpellReference[]; ruleset: "5e" | "5.5e"; onChange: (value: MonsterSpellReference[]) => void }) {
  const { q, setQ, level, setLevel, schoolFilter, setSchoolFilter, schoolOptions, rulesetFilter, setRulesetFilter, rows, busy } = useSpellSearch();
  const [names, setNames] = React.useState<Record<string, string>>({});
  // A monster's spell references aren't individually ruleset-tagged (schema is `.strict()` on
  // {id, level?} -- one fact, one home) -- the monster's own ruleset field is the implicit
  // ruleset for every spell it knows, so the picker/lookup are scoped to match it.
  React.useEffect(() => {
    if (rulesetFilter !== ruleset) setRulesetFilter(ruleset);
  }, [ruleset, rulesetFilter, setRulesetFilter]);
  React.useEffect(() => {
    const ids = spells.map((spell) => spell.id).filter((id) => id && !names[id]);
    if (!ids.length) return;
    let alive = true;
    api<{ rows: Array<{ id: string; name: string }> }>("/api/spells/lookup", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ruleset }),
    }).then((result) => { if (alive) setNames((current) => ({ ...current, ...Object.fromEntries(result.rows.map((row) => [row.id, row.name])) })); }).catch(() => {});
    return () => { alive = false; };
  }, [spells, names, ruleset]);
  const selectedIds = new Set(spells.map((spell) => spell.id));
  const results = rows.filter((row) => !selectedIds.has(row.id)).slice(0, 12);
  return (
    <div>
      <SectionHeader title="Monster spells" />
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginBottom: 8 }}>Search the compendium and add every spell this monster can cast. Cast level is only needed when the stat block specifies an override.</div>
      {spells.map((spell, index) => <div key={spell.id || index} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px 30px", gap: 6, marginBottom: 6, alignItems: "center" }}><div style={{ color: theme.colors.text, fontWeight: 650 }}>{names[spell.id] ?? spell.id}</div><Input type="number" min={1} max={9} value={spell.level ?? ""} onChange={(event) => onChange(spells.map((row, i) => i === index ? { ...row, level: event.target.value ? Number(event.target.value) : undefined } : row))} placeholder="Cast level (optional)" /><Button type="button" variant="danger" aria-label={`Remove ${names[spell.id] ?? "spell"}`} onClick={() => onChange(spells.filter((_, i) => i !== index))} style={{ padding: 0, borderRadius: 6 }}>×</Button></div>)}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 150px 180px", gap: 6, marginTop: 10 }}>
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search spells by name…" />
        <Select value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option><option value="0">Cantrip</option>{Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={String(i + 1)}>Level {i + 1}</option>)}</Select>
        <Select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>{schoolOptions.map((school) => <option key={school} value={school}>{school === "all" ? "All schools" : expandSchool(school)}</option>)}</Select>
      </div>
      <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 8, marginTop: 6, maxHeight: 240, overflowY: "auto" }}>
        {busy ? <div style={{ padding: 10, color: theme.colors.muted }}>Loading spells…</div> : results.map((spell) => <button key={spell.id} type="button" onClick={() => { setNames((current) => ({ ...current, [spell.id]: spell.name })); onChange([...spells, { id: spell.id }]); }} style={{ width: "100%", border: 0, borderBottom: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, padding: "8px 10px", display: "flex", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}><span>{spell.name}</span><span style={{ color: theme.colors.muted }}>{spell.level === 0 ? "Cantrip" : `Level ${spell.level ?? "?"}`} · {spell.school ? expandSchool(spell.school) : "Unknown school"} &nbsp; <strong style={{ color: theme.colors.accentPrimary }}>+ Add</strong></span></button>)}
        {!busy && !results.length ? <div style={{ padding: 10, color: theme.colors.muted }}>No matching spells.</div> : null}
      </div>
    </div>
  );
}
