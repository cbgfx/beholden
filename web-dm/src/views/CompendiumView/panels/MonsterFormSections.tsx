import * as React from "react";

import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import {
  AbilityInput,
  baseInput,
  BlockEditor,
  Field,
  FieldRow,
  MonsterBlock,
  MonsterForEdit,
  normalizeBlocks,
  normalizeSize,
  SectionHeader,
  SIZES,
  toStr,
  TYPES,
} from "./MonsterFormParts";

export type MonsterFormState = {
  name: string;
  cr: string;
  typeFull: string;
  size: string;
  environment: string;
  ac: string;
  hp: string;
  speed: string;
  str: string;
  dex: string;
  con: string;
  int_: string;
  wis: string;
  cha: string;
  save: string;
  skill: string;
  senses: string;
  languages: string;
  immune: string;
  resist: string;
  vulnerable: string;
  condImm: string;
  traits: MonsterBlock[];
  actions: MonsterBlock[];
  reactions: MonsterBlock[];
  legendary: MonsterBlock[];
};

export function monsterToForm(monster: MonsterForEdit | null, isDuplicate: boolean): MonsterFormState {
  return {
    name: isDuplicate ? `${monster?.name ?? ""} (Copy)` : (monster?.name ?? ""),
    cr: toStr(monster?.cr),
    typeFull: toStr(monster?.typeFull ?? (monster as any)?.typeKey),
    size: normalizeSize(monster?.size) || "Medium",
    environment: toStr(monster?.environment),
    ac: toStr(monster?.ac),
    hp: toStr(monster?.hp),
    speed: toStr(monster?.speed),
    str: monster?.str != null ? String(monster.str) : "",
    dex: monster?.dex != null ? String(monster.dex) : "",
    con: monster?.con != null ? String(monster.con) : "",
    int_: monster?.int != null ? String(monster.int) : "",
    wis: monster?.wis != null ? String(monster.wis) : "",
    cha: monster?.cha != null ? String(monster.cha) : "",
    save: toStr(monster?.save),
    skill: toStr(monster?.skill),
    senses: toStr(monster?.senses),
    languages: toStr(monster?.languages),
    immune: toStr(monster?.immune),
    resist: toStr(monster?.resist),
    vulnerable: toStr(monster?.vulnerable),
    condImm: toStr(monster?.conditionImmune),
    traits: normalizeBlocks(monster?.trait),
    actions: normalizeBlocks(monster?.action),
    reactions: normalizeBlocks(monster?.reaction),
    legendary: normalizeBlocks(monster?.legendary),
  };
}

export function buildMonsterPayload(form: MonsterFormState) {
  return {
    name: form.name.trim(),
    cr: form.cr.trim() || null,
    typeFull: form.typeFull.trim() || null,
    size: form.size || null,
    environment: form.environment.trim() || null,
    ac: form.ac.trim() || null,
    hp: form.hp.trim() || null,
    speed: form.speed.trim() || null,
    str: form.str.trim() ? Number(form.str.trim()) : null,
    dex: form.dex.trim() ? Number(form.dex.trim()) : null,
    con: form.con.trim() ? Number(form.con.trim()) : null,
    int: form.int_.trim() ? Number(form.int_.trim()) : null,
    wis: form.wis.trim() ? Number(form.wis.trim()) : null,
    cha: form.cha.trim() ? Number(form.cha.trim()) : null,
    save: form.save.trim() || null,
    skill: form.skill.trim() || null,
    senses: form.senses.trim() || null,
    languages: form.languages.trim() || null,
    immune: form.immune.trim() || null,
    resist: form.resist.trim() || null,
    vulnerable: form.vulnerable.trim() || null,
    conditionImmune: form.condImm.trim() || null,
    trait: form.traits.filter((block) => block.name || block.text),
    action: form.actions.filter((block) => block.name || block.text),
    reaction: form.reactions.filter((block) => block.name || block.text),
    legendary: form.legendary.filter((block) => block.name || block.text),
  };
}

type SetField = <K extends keyof MonsterFormState>(field: K, value: MonsterFormState[K]) => void;

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
      <FieldRow>
        <Field label="AC" grow>
          <Input value={form.ac} onChange={(e) => setField("ac", e.target.value)} placeholder="e.g. 17 (natural armor)" />
        </Field>
        <Field label="HP" grow>
          <Input value={form.hp} onChange={(e) => setField("hp", e.target.value)} placeholder="e.g. 256 (19d20 + 57)" />
        </Field>
        <Field label="Speed" grow>
          <Input value={form.speed} onChange={(e) => setField("speed", e.target.value)} placeholder="e.g. 40 ft., fly 80 ft." />
        </Field>
      </FieldRow>
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
          <Field label="Saving Throws" grow>
            <Input value={form.save} onChange={(e) => setField("save", e.target.value)} placeholder="e.g. STR +9, CON +9" />
          </Field>
          <Field label="Skills" grow>
            <Input value={form.skill} onChange={(e) => setField("skill", e.target.value)} placeholder="e.g. Perception +5, Stealth +4" />
          </Field>
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
      <BlockEditor label="Legendary Actions" blocks={form.legendary} onChange={(value) => setField("legendary", value)} />
    </>
  );
}
