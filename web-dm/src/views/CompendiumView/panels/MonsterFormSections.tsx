
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
  const classification = monster?.classification ?? {};
  const abilities = monster?.abilities ?? {};
  const defenses = monster?.defenses ?? {};
  return {
    name: isDuplicate ? `${monster?.name ?? ""} (Copy)` : (monster?.name ?? ""),
    cr: monster?.challenge?.rating ?? "",
    typeFull: classification.description ?? classification.type ?? "",
    size: normalizeSize(classification.size) || "Medium",
    environment: classification.environment?.join(", ") ?? "",
    ac: monster?.armorClass?.value != null ? String(monster.armorClass.value) : "",
    hp: monster?.hitPoints?.formula ?? (monster?.hitPoints?.average != null ? String(monster.hitPoints.average) : ""),
    speed: monster?.movement ? JSON.stringify(monster.movement) : "",
    str: abilities.str != null ? String(abilities.str) : "",
    dex: abilities.dex != null ? String(abilities.dex) : "",
    con: abilities.con != null ? String(abilities.con) : "",
    int_: abilities.int != null ? String(abilities.int) : "",
    wis: abilities.wis != null ? String(abilities.wis) : "",
    cha: abilities.cha != null ? String(abilities.cha) : "",
    save: monster?.proficiencies ? JSON.stringify(monster.proficiencies.savingThrows ?? []) : "",
    skill: monster?.proficiencies ? JSON.stringify(monster.proficiencies.skills ?? []) : "",
    senses: Array.isArray(monster?.senses) ? monster.senses.join(", ") : "",
    languages: Array.isArray(monster?.languages) ? monster.languages.join(", ") : "",
    immune: defenses.damageImmunities?.join(", ") ?? "",
    resist: defenses.resistances?.join(", ") ?? "",
    vulnerable: defenses.vulnerabilities?.join(", ") ?? "",
    condImm: defenses.conditionImmunities?.join(", ") ?? "",
    traits: normalizeBlocks(monster?.traits),
    actions: normalizeBlocks(monster?.actions),
    reactions: normalizeBlocks(monster?.reactions),
    legendary: normalizeBlocks(monster?.legendaryActions),
  };
}

const splitList = (value: string) => value.split(",").map((part) => part.trim()).filter(Boolean);
const jsonObject = (value: string, label: string): Record<string, unknown> | undefined => {
  if (!value.trim()) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`${label} must be a Grand JSON object.`);
  return parsed as Record<string, unknown>;
};
const jsonArray = (value: string, label: string): unknown[] | undefined => {
  if (!value.trim()) return undefined;
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${label} must be a Grand JSON array.`);
  return parsed;
};
const actionBlocks = (blocks: MonsterBlock[]) => blocks.filter((block) => block.name || block.text).map((block, index) => {
  const { text, ...facts } = block;
  return { ...facts, id: block.id || `action_${index + 1}`, name: block.name.trim(), description: text };
});

export function buildMonsterPayload(form: MonsterFormState, original: MonsterForEdit | null) {
  const type = form.typeFull.trim();
  const size = ({ Tiny: "T", Small: "S", Medium: "M", Large: "L", Huge: "H", Gargantuan: "G" } as Record<string, string>)[form.size] ?? form.size;
  const movement = jsonObject(form.speed, "Movement");
  const savingThrows = jsonArray(form.save, "Saving throws");
  const skills = jsonArray(form.skill, "Skills");
  const hp = form.hp.trim();
  const abilities = Object.fromEntries([
    ["str", form.str], ["dex", form.dex], ["con", form.con], ["int", form.int_], ["wis", form.wis], ["cha", form.cha],
  ].filter(([, value]) => value.trim()).map(([key, value]) => [key, Number(value)]));
  const traits = actionBlocks(form.traits);
  const actions = actionBlocks(form.actions);
  const reactions = actionBlocks(form.reactions);
  const legendaryActions = actionBlocks(form.legendary);
  const defenses = {
    ...(splitList(form.vulnerable).length ? { vulnerabilities: splitList(form.vulnerable) } : {}),
    ...(splitList(form.resist).length ? { resistances: splitList(form.resist) } : {}),
    ...(splitList(form.immune).length ? { damageImmunities: splitList(form.immune) } : {}),
    ...(splitList(form.condImm).length ? { conditionImmunities: splitList(form.condImm) } : {}),
  };
  return {
    ...(original ?? {}),
    name: form.name.trim(),
    classification: { ...(original?.classification ?? {}), ...(size ? { size } : {}), ...(type ? { type: type.split(/\s/u)[0]?.toLowerCase(), description: type } : {}), ...(splitList(form.environment).length ? { environment: splitList(form.environment) } : {}) },
    ...(form.cr.trim() ? { challenge: { ...(original?.challenge ?? {}), rating: form.cr.trim() } } : { challenge: undefined }),
    ...(form.ac.trim() ? { armorClass: { ...(original?.armorClass ?? {}), value: Number(form.ac) } } : { armorClass: undefined }),
    ...(hp ? { hitPoints: hp.toLowerCase().includes("d") ? { formula: hp } : { average: Number(hp) } } : { hitPoints: undefined }),
    ...(movement ? { movement } : { movement: undefined }),
    ...(Object.keys(abilities).length ? { abilities } : { abilities: undefined }),
    ...(savingThrows?.length || skills?.length ? { proficiencies: { ...(savingThrows?.length ? { savingThrows } : {}), ...(skills?.length ? { skills } : {}) } } : { proficiencies: undefined }),
    ...(splitList(form.senses).length ? { senses: splitList(form.senses) } : { senses: undefined }),
    ...(splitList(form.languages).length ? { languages: splitList(form.languages) } : { languages: undefined }),
    ...(Object.keys(defenses).length ? { defenses } : { defenses: undefined }),
    ...(traits.length ? { traits } : { traits: undefined }),
    ...(actions.length ? { actions } : { actions: undefined }),
    ...(reactions.length ? { reactions } : { reactions: undefined }),
    ...(legendaryActions.length ? { legendaryActions } : { legendaryActions: undefined }),
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
            <Input value={form.speed} onChange={(e) => setField("speed", e.target.value)} placeholder={'{"walk":40,"fly":80}'} />
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
            <Input value={form.save} onChange={(e) => setField("save", e.target.value)} placeholder={'[{"name":"STR","bonus":9}]'} />
          </Field>
          <Field label="Skills" grow>
            <Input value={form.skill} onChange={(e) => setField("skill", e.target.value)} placeholder={'[{"name":"Perception","bonus":5}]'} />
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
