import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { averageHpFromFormula, buildMonsterInfoLines, formatCr, parseSaves, parseSpeedDisplay, parseSpeedVal, readMonsterNumber } from "../../domain/monsters";
import { ordinal } from "../../domain/text/ordinal";
import { FormattedText } from "../../ui/FormattedText";
import { COMPENDIUM_COLORS as C, CompendiumButton, smallInputStyle } from "../compendium/compendiumStyle";
import { CharacterSheetPanel, MonsterSectionPanel, type CharacterSheetStats } from "./StatSheet";
import { useMonsterSpells, type MonsterSpells } from "./useMonsterSpells";

/** A per-encounter change to one attack's numbers (DM combat only). */
export type AttackOverride = { toHit?: number; damage?: string; damageType?: string };
type MonsterRecord = Record<string, unknown>;
type MonsterTextEntry = { name?: string; title?: string; text?: string | string[]; description?: string; attack?: unknown };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asTextEntries(value: unknown): MonsterTextEntry[] {
  return Array.isArray(value) ? value.filter((entry): entry is MonsterTextEntry => Boolean(entry && typeof entry === "object")) : [];
}

/** Spellcasting entries are shown by the spell panel instead of as text. */
function isSpellSection(name: unknown): boolean {
  return /spellcasting/i.test(String(name ?? ""));
}

function entryName(entry: MonsterTextEntry): string {
  return String(entry.name ?? entry.title ?? "");
}

/** The attack's own to-hit, damage and damage type, used when no override is set. */
function attackDefaults(entry: MonsterTextEntry): AttackOverride {
  const attack = asRecord(entry.attack);
  if (!attack) return {};
  const toHit = Number(attack.toHit);
  const damage = String(attack.damage ?? "").replace(/\s+/g, "");
  const damageType = String(attack.damageType ?? "").trim().toLowerCase();
  return { toHit: Number.isFinite(toHit) ? toHit : undefined, damage: damage || undefined, damageType: damageType || undefined };
}

const signed = (value: number | undefined) => (value == null ? "" : value >= 0 ? `+${value}` : String(value));

function AttackOverrideInputs(props: { name: string; override?: AttackOverride; defaults: AttackOverride; onChange: (name: string, patch: AttackOverride) => void }) {
  const translateUi = useUiTranslation("sharedUi");
  const fields = [
    {
      label: translateUi("To Hit"),
      value: props.override?.toHit != null ? signed(props.override.toHit) : signed(props.defaults.toHit),
      width: 60,
      onChange: (value: string) => {
        const digits = value.replace(/[^0-9+-]/g, "");
        props.onChange(props.name, { toHit: digits ? Number(digits) : undefined });
      },
    },
    { label: translateUi("Damage"), value: props.override?.damage ?? props.defaults.damage ?? "", width: 92, onChange: (value: string) => props.onChange(props.name, { damage: value }) },
    { label: translateUi("Type"), value: props.override?.damageType ?? props.defaults.damageType ?? "", width: 92, onChange: (value: string) => props.onChange(props.name, { damageType: value }) },
  ];
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {fields.map((field) => (
        <label key={field.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: C.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>{field.label}</span>
          <input value={field.value} onChange={(event) => field.onChange(event.target.value)} style={{ ...smallInputStyle, width: field.width }} />
        </label>
      ))}
    </div>
  );
}

/** Traits, actions, reactions or legendary actions, one bordered card per entry. */
function EntrySection(props: { title: string; entries: MonsterTextEntry[]; renderExtra?: (entry: MonsterTextEntry) => React.ReactNode }) {
  if (!props.entries.length) return null;
  return (
    <MonsterSectionPanel title={props.title}>
      <div style={{ display: "grid", gap: 8 }}>
        {props.entries.map((entry, index) => (
          <div key={index} style={{ display: "grid", gap: 4, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.panelBorder}`, background: C.panelBg }}>
            <div style={{ fontWeight: 900 }}>{entryName(entry)}</div>
            <div style={{ color: C.muted, whiteSpace: "pre-wrap", fontSize: "var(--fs-subtitle)" }}>
              <FormattedText text={entry.text ?? entry.description} />
            </div>
            {props.renderExtra?.(entry)}
          </div>
        ))}
      </div>
    </MonsterSectionPanel>
  );
}

function MonsterSpellPanel({ spells }: { spells: MonsterSpells }) {
  const translateUi = useUiTranslation("sharedUi");
  const detailText = spells.spellDetail?.text;
  return (
    <MonsterSectionPanel title={translateUi("Spells")}>
      <div style={{ display: "grid", gap: 5 }}>
        {spells.groupedSpells.map((group) => (
          <div key={group.level} style={{ display: "grid", gap: 4 }}>
            <div style={{ color: C.muted, fontWeight: 900, fontSize: "var(--fs-medium)" }}>
              {group.level === 0 ? translateUi("Cantrips (at will)") : translateUi("{{value1}} level", { value1: ordinal(group.level) })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {group.spells.map((spell) => (
                <CompendiumButton
                  key={spell.key}
                  type="button"
                  variant="ghost"
                  title={translateUi("Open spell")}
                  onClick={() => spells.openSpell({ id: spell.spellId, name: spell.display })}
                  style={{ background: C.panelBg, padding: "6px 10px", borderRadius: 999, fontWeight: 800 }}
                >
                  {spell.display}
                </CompendiumButton>
              ))}
            </div>
          </div>
        ))}
      </div>
      {spells.spellOpen && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 14, border: `1px solid ${C.panelBorder}`, background: C.panelBg }}>
          {spells.spellLoading ? (
            <div style={{ color: C.muted }}>{translateUi("Loading spell...")}</div>
          ) : spells.spellError ? (
            <div style={{ color: C.red }}>{spells.spellError === "not-found" ? translateUi("Spell not found in compendium.") : spells.spellError}</div>
          ) : spells.spellDetail ? (
            <div>
              <div style={{ fontWeight: 900, marginBottom: 4 }}>{spells.spellDetail.name}</div>
              <div style={{ color: C.muted, fontSize: "var(--fs-subtitle)", whiteSpace: "pre-wrap" }}>
                <FormattedText text={detailText ?? ""} />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </MonsterSectionPanel>
  );
}

/**
 * A monster's full stat block: name line, vitals, ability scores with saves, details, spells,
 * traits, actions, reactions and legendary actions. Used by both compendiums, the DM's monster
 * picker and combatant views, and the player's creature views.
 */
export function MonsterStatblock(props: {
  monster: MonsterRecord | null;
  /** Hide the name/type/CR line when the surrounding panel already shows it. */
  hideSummary?: boolean;
  /** Hide AC, hit points and speed when the surrounding view shows its own live values. */
  hideVitals?: boolean;
  attackOverrides?: Record<string, AttackOverride>;
  /** When given, attack actions show editable to-hit and damage (DM combat). */
  onChangeAttack?: (actionName: string, patch: AttackOverride) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const monster = props.monster;
  // Every hook runs before the early return below.
  const spells = useMonsterSpells(monster);

  const stats: CharacterSheetStats | null = React.useMemo(() => {
    if (!monster) return null;
    const raw = (monster.raw_json ?? monster) as MonsterRecord;
    const acRecord = asRecord(monster.ac);
    const hpRecord = asRecord(monster.hp);
    const ac = readMonsterNumber(acRecord?.value ?? monster.ac ?? monster.armor_class);
    const hp = readMonsterNumber(hpRecord?.average)
      ?? averageHpFromFormula(typeof hpRecord?.formula === "string" ? hpRecord.formula : null)
      ?? readMonsterNumber(monster.hp ?? monster.hit_points);
    const ability = (key: string) => readMonsterNumber(monster[key]) ?? 10;
    return {
      ac: ac ?? NaN,
      hpCur: hp ?? NaN,
      hpMax: hp ?? NaN,
      speed: parseSpeedVal(raw.speed ?? monster.speed),
      speedDisplay: parseSpeedDisplay(raw.speed ?? monster.speed),
      abilities: { str: ability("str"), dex: ability("dex"), con: ability("con"), int: ability("int"), wis: ability("wis"), cha: ability("cha") },
      saves: parseSaves(asRecord(monster.proficiencies)?.savingThrows),
      infoLines: buildMonsterInfoLines(raw),
    };
  }, [monster]);

  if (!monster || !stats) {
    return <div style={{ color: C.muted }}>{translateUi("Select a monster to preview its stats.")}</div>;
  }

  const typeRecord = asRecord(monster.type);
  const type = typeof monster.type === "string" ? monster.type : typeof typeRecord?.type === "string" ? typeRecord.type : typeof monster.typeFull === "string" ? monster.typeFull : null;
  const alignment = typeof monster.alignment === "string" ? monster.alignment : null;
  const cr = formatCr(monster.cr ?? monster.challenge_rating);

  const withoutSpellcasting = (entries: MonsterTextEntry[]) => entries.filter((entry) => !isSpellSection(entryName(entry)));
  const traits = withoutSpellcasting(asTextEntries(monster.traits ?? monster.trait)).filter((entry) => !/^proficiency bonus$/i.test(entryName(entry).trim()));
  const actions = withoutSpellcasting(asTextEntries(monster.actions ?? monster.action));
  const reactions = withoutSpellcasting(asTextEntries(monster.reactions ?? monster.reaction));
  const legendary = asTextEntries(monster.legendary ?? monster.legendaryActions);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!props.hideSummary && (
        <div>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: C.text }}>{String(monster.name ?? "")}</div>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{[type, alignment, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}</div>
        </div>
      )}

      <CharacterSheetPanel stats={stats} compact hideVitals={props.hideVitals} />

      {spells.groupedSpells.length > 0 && <MonsterSpellPanel spells={spells} />}

      <EntrySection title={translateUi("Traits")} entries={traits} />
      <EntrySection
        title={translateUi("Actions")}
        entries={actions}
        renderExtra={props.onChangeAttack ? (entry) => asRecord(entry.attack) && (
          <AttackOverrideInputs
            name={entryName(entry)}
            override={props.attackOverrides?.[entryName(entry)]}
            defaults={attackDefaults(entry)}
            onChange={props.onChangeAttack!}
          />
        ) : undefined}
      />
      <EntrySection title={translateUi("Reactions")} entries={reactions} />
      <EntrySection title={translateUi("Legendary Actions")} entries={legendary} />
    </div>
  );
}
