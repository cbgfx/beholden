
import * as React from "react";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import { expandSchool } from "@/lib/format/expandSchool";
import { useSpellSearch } from "@/views/CompendiumView/hooks/useSpellSearch";
import {
  AbilityInput,
  baseInput,
  BlockEditor,
  Field,
  FieldRow,
  MonsterBlock,
  MonsterLairBlock,
  MonsterSpellReference,
  MonsterForEdit,
  normalizeBlocks,
  normalizeSize,
  SectionHeader,
  SIZES,
  TYPES,
} from "./MonsterFormParts";

export type NamedBonus = { name: string; bonus: string };

export type MonsterFormState = {
  name: string; ruleset: "5e" | "5.5e"; source: string; description: string;
  cr: string; xp: string; typeFull: string; size: string; alignment: string; environment: string;
  ac: string; acSource: string; hpAverage: string; hpFormula: string;
  walk: string; burrow: string; climb: string; fly: string; swim: string; hover: boolean;
  initiativeBonus: string; passivePerception: string;
  str: string; dex: string; con: string; int_: string; wis: string; cha: string;
  saves: NamedBonus[]; skills: NamedBonus[]; senses: string; languages: string;
  immune: string; resist: string; vulnerable: string; condImm: string; treasure: string;
  legendaryUses: string;
  traits: MonsterBlock[]; actions: MonsterBlock[]; reactions: MonsterBlock[]; legendary: MonsterBlock[];
  lair: MonsterLairBlock[]; spellcasting: MonsterBlock[]; spells: MonsterSpellReference[];
};

function namedBonuses(value: unknown): NamedBonus[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const row = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return { name: String(row.name ?? ""), bonus: row.bonus == null ? "" : String(row.bonus) };
  });
}

export function monsterToForm(monster: MonsterForEdit | null, isDuplicate: boolean): MonsterFormState {
  const classification = monster?.classification ?? {};
  const abilities = monster?.abilities ?? {};
  const defenses = monster?.defenses ?? {};
  return {
    name: isDuplicate ? `${monster?.name ?? ""} (Copy)` : (monster?.name ?? ""),
    ruleset: monster?.ruleset === "5e" ? "5e" : "5.5e",
    source: typeof monster?.source === "string" ? monster.source : "",
    description: typeof monster?.description === "string" ? monster.description : "",
    cr: monster?.challenge?.rating ?? "",
    xp: monster?.challenge?.xp != null ? String(monster.challenge.xp) : "",
    typeFull: classification.description ?? classification.type ?? "",
    size: normalizeSize(classification.size) || "Medium",
    alignment: typeof classification.alignment === "string" ? classification.alignment : "",
    environment: classification.environment?.join(", ") ?? "",
    ac: monster?.armorClass?.value != null ? String(monster.armorClass.value) : "",
    acSource: monster?.armorClass?.source ?? "",
    hpAverage: monster?.hitPoints?.average != null ? String(monster.hitPoints.average) : "",
    hpFormula: monster?.hitPoints?.formula ?? "",
    walk: monster?.movement?.walk != null ? String(monster.movement.walk) : "",
    burrow: monster?.movement?.burrow != null ? String(monster.movement.burrow) : "",
    climb: monster?.movement?.climb != null ? String(monster.movement.climb) : "",
    fly: monster?.movement?.fly != null ? String(monster.movement.fly) : "",
    swim: monster?.movement?.swim != null ? String(monster.movement.swim) : "",
    hover: monster?.movement?.hover === true,
    initiativeBonus: monster?.initiativeBonus != null ? String(monster.initiativeBonus) : "",
    passivePerception: monster?.passivePerception != null ? String(monster.passivePerception) : "",
    str: abilities.str != null ? String(abilities.str) : "",
    dex: abilities.dex != null ? String(abilities.dex) : "",
    con: abilities.con != null ? String(abilities.con) : "",
    int_: abilities.int != null ? String(abilities.int) : "",
    wis: abilities.wis != null ? String(abilities.wis) : "",
    cha: abilities.cha != null ? String(abilities.cha) : "",
    saves: namedBonuses(monster?.proficiencies?.savingThrows),
    skills: namedBonuses(monster?.proficiencies?.skills),
    senses: Array.isArray(monster?.senses) ? monster.senses.join(", ") : "",
    languages: Array.isArray(monster?.languages) ? monster.languages.join(", ") : "",
    immune: defenses.damageImmunities?.join(", ") ?? "",
    resist: defenses.resistances?.join(", ") ?? "",
    vulnerable: defenses.vulnerabilities?.join(", ") ?? "",
    condImm: defenses.conditionImmunities?.join(", ") ?? "",
    treasure: typeof monster?.treasure === "string" ? monster.treasure : "",
    legendaryUses: monster?.legendaryUses != null ? String(monster.legendaryUses) : "",
    traits: normalizeBlocks(monster?.traits),
    actions: normalizeBlocks(monster?.actions),
    reactions: normalizeBlocks(monster?.reactions),
    legendary: normalizeBlocks(monster?.legendaryActions),
    lair: Array.isArray(monster?.lair) ? monster.lair.map((entry) => ({ name: String(entry.name ?? ""), description: String(entry.description ?? "") })) : [],
    spellcasting: normalizeBlocks(monster?.spellcasting),
    spells: Array.isArray(monster?.spells) ? monster.spells.map((entry) => ({ id: String(entry.id ?? ""), ...(entry.level != null ? { level: Number(entry.level) } : {}) })) : [],
  };
}

const splitList = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
const actionBlocks = (blocks: MonsterBlock[]) => blocks.filter((block) => block.name || block.text).map((block, index) => {
  const { text, ...facts } = block;
  return { ...facts, id: block.id || `action_${index + 1}`, name: block.name.trim(), description: text };
});

export function buildMonsterPayload(form: MonsterFormState, original: MonsterForEdit | null) {
  const type = form.typeFull.trim();
  const size = ({ Tiny: "T", Small: "S", Medium: "M", Large: "L", Huge: "H", Gargantuan: "G" } as Record<string, string>)[form.size] ?? form.size;
  const parseInteger = (value: string, label: string, min?: number) => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || (min != null && parsed < min)) throw new Error(`${label} must be an integer${min != null ? ` of at least ${min}` : ""}.`);
    return parsed;
  };
  if (!form.name.trim()) throw new Error("Name is required.");
  const positiveInteger = (value: string, label: string) => parseInteger(value, label, 1);
  positiveInteger(form.ac, "Armor Class");
  positiveInteger(form.hpAverage, "Average hit points");
  parseInteger(form.xp, "XP", 0);
  parseInteger(form.initiativeBonus, "Initiative bonus");
  parseInteger(form.passivePerception, "Passive Perception", 0);
  const movement: Record<string, number | true> = {};
  for (const key of ["walk", "burrow", "climb", "fly", "swim"] as const) {
    const value = parseInteger(form[key], `${key} speed`, 0);
    if (value != null) movement[key] = value;
  }
  if (form.hover) movement.hover = true;
  const toNamedBonuses = (rows: NamedBonus[], label: string) => rows.filter((entry) => entry.name.trim() || entry.bonus.trim()).map((entry, index) => {
    if (!entry.name.trim()) throw new Error(`${label} row ${index + 1} needs a name.`);
    if (entry.bonus.trim() && !Number.isFinite(Number(entry.bonus))) throw new Error(`${label} row ${index + 1} has an invalid bonus.`);
    return { name: entry.name.trim(), ...(entry.bonus.trim() ? { bonus: Number(entry.bonus) } : {}) };
  });
  const savingThrows = toNamedBonuses(form.saves, "Saving throw");
  const skills = toNamedBonuses(form.skills, "Skill");
  for (const [ability, value] of [["STR", form.str], ["DEX", form.dex], ["CON", form.con], ["INT", form.int_], ["WIS", form.wis], ["CHA", form.cha]] as const) {
    const score = parseInteger(value, ability, 1);
    if (score != null && score > 30) throw new Error(`${ability} must be no greater than 30.`);
  }
  const abilities = Object.fromEntries([
    ["str", form.str], ["dex", form.dex], ["con", form.con], ["int", form.int_], ["wis", form.wis], ["cha", form.cha],
  ].filter(([, value]) => value.trim()).map(([key, value]) => [key, Number(value)]));
  const traits = actionBlocks(form.traits);
  const actions = actionBlocks(form.actions);
  const reactions = actionBlocks(form.reactions);
  const legendaryActions = actionBlocks(form.legendary);
  for (const [label, blocks] of [["Trait", traits], ["Action", actions], ["Reaction", reactions], ["Legendary action", legendaryActions]] as const) {
    const missingName = blocks.findIndex((block) => !block.name);
    if (missingName >= 0) throw new Error(`${label} ${missingName + 1} needs a name.`);
  }
  const defenses = {
    ...(splitList(form.vulnerable).length ? { vulnerabilities: splitList(form.vulnerable) } : {}),
    ...(splitList(form.resist).length ? { resistances: splitList(form.resist) } : {}),
    ...(splitList(form.immune).length ? { damageImmunities: splitList(form.immune) } : {}),
    ...(splitList(form.condImm).length ? { conditionImmunities: splitList(form.condImm) } : {}),
  };
  const payload: Record<string, unknown> = { ...(original ?? {}), ruleset: form.ruleset, name: form.name.trim() };
  const setOptional = (key: string, value: unknown) => { payload[key] = value; };
  setOptional("source", form.source.trim() || undefined);
  setOptional("description", form.description.trim() || undefined);
  const classification: Record<string, unknown> = { ...(original?.classification ?? {}) };
  if (size) classification.size = size;
  if (type) { classification.type = type.split(/\s/u)[0]?.toLowerCase(); classification.description = type; }
  if (form.alignment.trim()) classification.alignment = form.alignment.trim();
  else delete classification.alignment;
  if (splitList(form.environment).length) classification.environment = splitList(form.environment); else delete classification.environment;
  setOptional("classification", Object.keys(classification).length ? classification : undefined);
  setOptional("challenge", form.cr.trim() || form.xp.trim() ? { ...(form.cr.trim() ? { rating: form.cr.trim() } : {}), ...(form.xp.trim() ? { xp: Number(form.xp) } : {}) } : undefined);
  setOptional("armorClass", form.ac.trim() ? { value: Number(form.ac), ...(form.acSource.trim() ? { source: form.acSource.trim() } : {}) } : undefined);
  setOptional("hitPoints", form.hpFormula.trim() ? { formula: form.hpFormula.trim() } : form.hpAverage.trim() ? { average: Number(form.hpAverage) } : undefined);
  setOptional("movement", Object.keys(movement).length ? movement : undefined);
  setOptional("initiativeBonus", form.initiativeBonus.trim() ? Number(form.initiativeBonus) : undefined);
  setOptional("passivePerception", form.passivePerception.trim() ? Number(form.passivePerception) : undefined);
  setOptional("abilities", Object.keys(abilities).length ? abilities : undefined);
  setOptional("proficiencies", savingThrows.length || skills.length ? { ...(savingThrows.length ? { savingThrows } : {}), ...(skills.length ? { skills } : {}) } : undefined);
  setOptional("senses", splitList(form.senses).length ? splitList(form.senses) : undefined);
  setOptional("languages", splitList(form.languages).length ? splitList(form.languages) : undefined);
  setOptional("defenses", Object.keys(defenses).length ? defenses : undefined);
  setOptional("treasure", form.treasure.trim() || undefined);
  setOptional("traits", traits.length ? traits : undefined);
  setOptional("actions", actions.length ? actions : undefined);
  setOptional("reactions", reactions.length ? reactions : undefined);
  setOptional("legendaryActions", legendaryActions.length ? legendaryActions : undefined);
  setOptional("legendaryUses", legendaryActions.length ? parseInteger(form.legendaryUses || "3", "Legendary uses", 1) : undefined);
  const lair = form.lair.filter((entry) => entry.name.trim() || entry.description.trim()).map((entry) => ({ name: entry.name.trim(), description: entry.description.trim() }));
  const spellcasting = actionBlocks(form.spellcasting);
  lair.forEach((entry, index) => { if (!entry.name || !entry.description) throw new Error(`Lair entry ${index + 1} needs both a name and description.`); });
  spellcasting.forEach((entry, index) => { if (!entry.name) throw new Error(`Spellcasting entry ${index + 1} needs a name.`); });
  const spells = form.spells.filter((entry) => entry.id.trim()).map((entry) => ({ id: entry.id.trim(), ...(entry.level != null ? { level: entry.level } : {}) }));
  spells.forEach((entry, index) => { if (entry.level != null && (!Number.isInteger(entry.level) || entry.level < 1 || entry.level > 9)) throw new Error(`Spell reference ${index + 1} cast level must be from 1 to 9.`); });
  setOptional("lair", lair.length ? lair : undefined);
  setOptional("spellcasting", spellcasting.length ? spellcasting : undefined);
  setOptional("spells", spells.length ? spells : undefined);
  return payload;
}

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
        <button type="button" onClick={() => onChange([...rows, { name: "", bonus: "" }])} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 6, background: withAlpha(theme.colors.accentPrimary, 0.12), color: theme.colors.accentPrimary, cursor: "pointer", fontWeight: 700 }}>+ Add</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {rows.map((row, index) => (
          <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 90px 28px", gap: 5 }}>
            <Input value={row.name} onChange={(event) => update(index, "name", event.target.value)} placeholder={namePlaceholder} />
            <Input type="number" value={row.bonus} onChange={(event) => update(index, "bonus", event.target.value)} placeholder="Bonus" />
            <button type="button" onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))} aria-label={`Remove ${label} row`} style={{ border: `1px solid ${withAlpha(theme.colors.red, 0.35)}`, borderRadius: 6, background: withAlpha(theme.colors.red, 0.12), color: theme.colors.red, cursor: "pointer" }}>×</button>
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
      <SpellReferenceEditor spells={form.spells} onChange={(value) => setField("spells", value)} />
    </>
  );
}

function LairEditor({ blocks, onChange }: { blocks: MonsterLairBlock[]; onChange: (value: MonsterLairBlock[]) => void }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><SectionHeader title="Lair" /><button type="button" onClick={() => onChange([...blocks, { name: "", description: "" }])} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 6, background: withAlpha(theme.colors.accentPrimary, 0.12), color: theme.colors.accentPrimary, cursor: "pointer", fontWeight: 700 }}>+ Add</button></div>
      {blocks.map((block, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "minmax(180px,.35fr) minmax(0,1fr) 30px", gap: 6, marginBottom: 6 }}><Input value={block.name} onChange={(event) => onChange(blocks.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} placeholder="Lair action name" /><Input value={block.description} onChange={(event) => onChange(blocks.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} placeholder="Description" /><button type="button" onClick={() => onChange(blocks.filter((_, i) => i !== index))} style={{ border: `1px solid ${withAlpha(theme.colors.red, .35)}`, borderRadius: 6, background: withAlpha(theme.colors.red, .12), color: theme.colors.red }}>×</button></div>)}
      {!blocks.length ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontStyle: "italic" }}>None</div> : null}
    </div>
  );
}

function SpellReferenceEditor({ spells, onChange }: { spells: MonsterSpellReference[]; onChange: (value: MonsterSpellReference[]) => void }) {
  const { q, setQ, level, setLevel, schoolFilter, setSchoolFilter, schoolOptions, rows, busy } = useSpellSearch();
  const [names, setNames] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    const ids = spells.map((spell) => spell.id).filter((id) => id && !names[id]);
    if (!ids.length) return;
    let alive = true;
    api<{ rows: Array<{ id: string; name: string }> }>("/api/spells/lookup", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
    }).then((result) => { if (alive) setNames((current) => ({ ...current, ...Object.fromEntries(result.rows.map((row) => [row.id, row.name])) })); }).catch(() => {});
    return () => { alive = false; };
  }, [spells, names]);
  const selectedIds = new Set(spells.map((spell) => spell.id));
  const results = rows.filter((row) => !selectedIds.has(row.id)).slice(0, 12);
  return (
    <div>
      <SectionHeader title="Monster spells" />
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-tiny)", marginBottom: 8 }}>Search the compendium and add every spell this monster can cast. Cast level is only needed when the stat block specifies an override.</div>
      {spells.map((spell, index) => <div key={spell.id || index} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px 30px", gap: 6, marginBottom: 6, alignItems: "center" }}><div style={{ color: theme.colors.text, fontWeight: 650 }}>{names[spell.id] ?? spell.id}</div><Input type="number" min={1} max={9} value={spell.level ?? ""} onChange={(event) => onChange(spells.map((row, i) => i === index ? { ...row, level: event.target.value ? Number(event.target.value) : undefined } : row))} placeholder="Cast level (optional)" /><button type="button" aria-label={`Remove ${names[spell.id] ?? "spell"}`} onClick={() => onChange(spells.filter((_, i) => i !== index))} style={{ border: `1px solid ${withAlpha(theme.colors.red, .35)}`, borderRadius: 6, background: withAlpha(theme.colors.red, .12), color: theme.colors.red }}>×</button></div>)}
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
