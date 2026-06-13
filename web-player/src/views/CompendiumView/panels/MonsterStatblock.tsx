import * as React from "react";
import {
  buildMonsterInfoLines,
  parseSpeedDisplay,
  readMonsterNumber,
} from "@beholden/shared/domain";
import { C, withAlpha } from "@/lib/theme";
import { formatCr } from "@/lib/monsterPicker/utils";
import { formatModifier } from "@/views/character/CharacterSheetUtils";

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function isSpellSection(name: unknown): boolean {
  return /spellcasting/i.test(String(name ?? ""));
}

function IconShield({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size} fill="currentColor">
      <path d="M237.591 23.95c-15.487 9.433-34.17 12.319-44.167 12.319-10.004 0-23.8-.195-43.95-11.83-8.355-4.823-9.862-5.708-14.347-5.708-12.913 0-71.396 58.376-72.363 66.334-.967 7.959 32.12 28.164 33.712 57.151 1.592 28.987-19.183 61.807-27.756 87.397-17.765 52.95-22.581 58.95-22.581 85.86 3.916 77.651 56.61 131.685 130.916 144.25 31.846 4.83 44.873 9.464 59.112 21.023 5.935 4.35 12.478 10.69 19.744 11.52v.028c.03-.003.06-.01.089-.014.03.003.06.011.089.014v-.028c7.266-.83 13.809-7.17 19.744-11.52 14.239-11.56 27.266-16.193 59.112-21.024 74.307-12.564 127-66.598 130.916-144.25 0-26.91-4.816-32.909-22.581-85.859-8.573-25.59-29.348-58.41-27.756-87.397 1.591-28.987 34.679-49.192 33.712-57.15-.967-7.959-59.45-66.335-72.363-66.335-4.485 0-5.992.885-14.347 5.709-20.15 11.634-33.946 11.829-43.95 11.829-9.997 0-28.68-2.886-44.167-12.319-4.53-2.745-10.031-5.344-18.409-5.344-6.601 0-13.347 2.294-18.409 5.344z" />
    </svg>
  );
}

function IconHeart({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size} fill="currentColor">
      <path d="M366.688 30.027c-1.01-.01-2.022-.01-3.034.004h.002c-41.495.563-83.634 22.155-110.844 69.282-41.912-117.77-236.49-76.29-232 64.5.64 20.068 5.132 38.987 12.454 56.917h76.45l21.22-74.126 26.375 90.134 18.46-64.312 17.238 48.303H328.1l21.222-74.126 26.375 90.13 18.46-64.308 17.238 48.303h72.517c7.097-18.183 10.927-37.136 10.307-56.917-2.61-83.04-63.874-133.082-127.533-133.786zM131.125 211.34l-7.842 27.39h-81.58c54.51 103.006 197.737 172.59 216.172 241.395 16.782-62.62 165.07-139.482 217.855-241.396h-77.023l-2.69-7.542-20.154 70.208-26.353-90.054-7.84 27.387H180.32l-2.69-7.54-20.15 70.206-26.355-90.056z" />
    </svg>
  );
}

function IconSpeed({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size} fill="currentColor">
      <path d="M272.5 18.906c-12.775.17-26.23 2.553-40.344 7.594-30.165 55.31-68.313 120.904-125.72 178.5-21.19 21.26-39.23 44.94-52.28 68.313 1.294 6.312 4.984 11.65 10.72 17.406 10.992 11.032 30.86 21.618 54.593 33.25 46.313 22.695 107.284 50.39 146.374 108.467l195.625.032c-20.198-70.834-100.276-101.12-159.064-83.94-.073.03-.145.066-.22.095-1.61.633-3.27 1.138-4.967 1.563-.024.005-.04.025-.064.03-8.86 2.204-18.82 1.68-29.125-.406-24.79-5.02-52.76-19.695-61.342-45.687-28.615-86.673 16.65-179.742 78.156-223.28 23.064-16.328 49.06-25.848 74.47-24.47.144.008.29.023.436.03-24.19-22.74-53.33-37.95-87.25-37.5zm81.75 56c-19.213.01-39.414 7.59-58.625 21.188-54.644 38.682-96.652 125.024-71.188 202.156 5.127 15.53 27.25 29.162 47.282 33.22 10.015 2.027 19.218 1.518 23.717-.283 2.25-.9 3.173-1.84 3.594-2.562.422-.72.81-1.663.25-4.375-9.08-44.167-2.743-84.61 22.533-114.47 23.586-27.863 62.753-45.462 117.406-50.686-15.014-47.145-37.47-71.226-61.314-80.03-6.407-2.368-13.032-3.706-19.812-4.064a73.352 73.352 0 0 0-3.844-.094zM43.78 294.22c-5.405 12.554-9.136 24.756-10.905 36.186 7.178 27.76 51.898 55.43 91.094 61.344 1.703-5.973 5.832-11.475 10.28-14.25 51.01 28.844 86.18 60.704 102 101h229.594c.697-9.613.44-18.712-.625-27.344l-204.314-.03h-5.125l-2.75-4.345c-35.405-55.575-93.93-82.58-141.78-106.03-23.925-11.724-45.17-22.336-59.625-36.844-2.978-2.99-5.618-6.225-7.844-9.687z" />
    </svg>
  );
}

function StatBar({ icon, label, value, flex }: { icon: React.ReactNode; label: string; value: React.ReactNode; flex?: number }) {
  return (
    <div style={{ flex: flex ?? 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 10px" }}>
      <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: C.muted, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900, fontSize: "var(--fs-stat)", color: C.text }}>
        <span style={{ opacity: 0.65, display: "flex", alignItems: "center" }}>{icon}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
      </div>
    </div>
  );
}

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type MonsterRecord = Record<string, unknown>;
type MonsterTextEntry = { name?: string; title?: string; text?: string | string[]; description?: string };

function readNamedObjectValue(source: unknown, key: string): unknown {
  if (!source || typeof source !== "object") return null;
  return (source as Record<string, unknown>)[key];
}

function asMonsterEntryArray(value: unknown): MonsterTextEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is MonsterTextEntry => Boolean(entry && typeof entry === "object"));
}

function AbilityGroup({ keys, abilities, saves }: { keys: AbilityKey[]; abilities: Record<AbilityKey, number>; saves?: Partial<Record<AbilityKey, number>> }) {
  const cols = "48px 38px 1fr 1fr";
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, marginBottom: 6 }}>
        <div />
        {["Score", "Mod", "Save"].map((header) => (
          <div key={header} style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: C.muted, textAlign: "center" }}>
            {header}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {keys.map((key) => {
          const score = Number(abilities[key] ?? 10);
          const mod = abilityMod(score);
          const save = saves?.[key] != null ? Number(saves[key]) : mod;
          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center" }}>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, textTransform: "uppercase", color: C.muted }}>{key}</div>
              <div style={{ padding: "5px 8px", borderRadius: 8, background: withAlpha("rgba(0,0,0,0.80)", 0.5), border: `1px solid ${C.panelBorder}`, fontWeight: 900, fontSize: "var(--fs-medium)", textAlign: "center", color: C.text, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>
                {score}
              </div>
              <div style={{ fontWeight: 900, fontSize: "var(--fs-medium)", textAlign: "center", color: C.text, fontVariantNumeric: "tabular-nums" }}>{formatModifier(mod)}</div>
              <div style={{ fontWeight: 900, fontSize: "var(--fs-medium)", textAlign: "center", color: C.text, fontVariantNumeric: "tabular-nums" }}>{formatModifier(save)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AbilityTable({ abilities, saves }: { abilities: Record<AbilityKey, number>; saves?: Partial<Record<AbilityKey, number>> }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "10px 2px" }}>
      <AbilityGroup keys={["str", "dex", "con"]} abilities={abilities} saves={saves} />
      <div style={{ width: 1, background: C.panelBorder, alignSelf: "stretch" }} />
      <AbilityGroup keys={["int", "wis", "cha"]} abilities={abilities} saves={saves} />
    </div>
  );
}

function TextBlock({ items, title }: { items: MonsterTextEntry[]; title: string }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ color: C.accent, fontWeight: 900 }}>{title}</div>
      {items.map((item, index: number) => (
        <div key={index} style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 900 }}>{item.name ?? item.title ?? ""}</div>
          <div style={{ color: C.muted, whiteSpace: "pre-wrap", fontSize: "var(--fs-subtitle)" }}>
            {Array.isArray(item.text) ? item.text.join("\n") : (item.text ?? item.description ?? "")}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MonsterStatblock({ monster, hideSummaryBar = false }: { monster: MonsterRecord | null; hideSummaryBar?: boolean }) {
  const [infoOpen, setInfoOpen] = React.useState(true);

  if (!monster) {
    return <div style={{ color: C.muted }}>Select a monster to view its stat block.</div>;
  }

  const ac = readMonsterNumber(readNamedObjectValue(monster.ac, "value") ?? monster.ac ?? monster.armor_class);
  const hp = readMonsterNumber(readNamedObjectValue(monster.hp, "average") ?? monster.hp ?? monster.hit_points);
  const speedDisplay = parseSpeedDisplay(monster.speed) || "—";
  const hpValue = hp != null ? `${hp} / ${hp}` : "—";

  const abilities: Record<AbilityKey, number> = {
    str: readMonsterNumber(monster.str) ?? 10,
    dex: readMonsterNumber(monster.dex) ?? 10,
    con: readMonsterNumber(monster.con) ?? 10,
    int: readMonsterNumber(monster.int) ?? 10,
    wis: readMonsterNumber(monster.wis) ?? 10,
    cha: readMonsterNumber(monster.cha) ?? 10,
  };

  const infoLines = buildMonsterInfoLines(monster).filter((line) => line.value?.trim() && line.value.trim() !== "—");

  const type = ((): string | null => {
    if (typeof monster.type === "string") return monster.type;
    const nested = readNamedObjectValue(monster.type, "type");
    return typeof nested === "string" ? nested : null;
  })();
  const alignment = typeof monster.alignment === "string" ? monster.alignment : null;
  const cr = formatCr(monster.cr ?? monster.challenge_rating);

  const traitArr = asMonsterEntryArray(monster.traits ?? monster.trait);
  const actionArr = asMonsterEntryArray(monster.actions ?? monster.action);
  const reactionArr = asMonsterEntryArray(monster.reactions ?? monster.reaction);
  const legendary = asMonsterEntryArray(monster.legendary ?? monster.legendaryActions);

  const nonSpellTraits = traitArr.filter((trait) => !isSpellSection(trait?.name ?? trait?.title));
  const nonSpellActions = actionArr.filter((action) => !isSpellSection(action?.name ?? action?.title));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: C.text }}>{String(monster.name ?? "Monster")}</div>
        <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
          {[type, alignment, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}
        </div>
      </div>

      {!hideSummaryBar && (
        <div style={{ display: "flex", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, overflow: "hidden" }}>
          <StatBar icon={<IconShield />} label="Armor Class" value={ac != null ? ac : "—"} />
          <div style={{ width: 1, background: C.panelBorder }} />
          <StatBar icon={<IconHeart />} label="Hit Points" value={hpValue} flex={1.4} />
          <div style={{ width: 1, background: C.panelBorder }} />
          <StatBar icon={<IconSpeed />} label="Speed" value={speedDisplay} />
        </div>
      )}

      <div style={{ borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, padding: "8px 12px" }}>
        <AbilityTable abilities={abilities} />
      </div>

      {infoLines.length > 0 && (
        <div style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 12, background: C.panelBg, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setInfoOpen((value) => !value)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "transparent", border: 0, cursor: "pointer", color: C.text, fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}
          >
            <span>Details</span>
            <span style={{ color: C.muted }}>{infoOpen ? "▲" : "▼"}</span>
          </button>
          {infoOpen && (
            <div style={{ padding: "0 12px 10px", display: "grid", gap: 4 }}>
              {infoLines.map((line) => (
                <div key={line.label} style={{ display: "flex", gap: 6, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
                  <span style={{ color: C.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{line.label}</span>
                  <span style={{ color: C.text }}>{line.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TextBlock items={nonSpellTraits} title="Traits" />
      <TextBlock items={nonSpellActions} title="Actions" />
      <TextBlock items={reactionArr} title="Reactions" />
      <TextBlock items={legendary} title="Legendary Actions" />
    </div>
  );
}
