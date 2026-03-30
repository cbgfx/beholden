import * as React from "react";
import { C, withAlpha } from "@/lib/theme";
import { formatCr } from "@/lib/monsterPicker/utils";
import { formatModifier } from "@/views/character/CharacterSheetUtils";

// ─── Utilities ───────────────────────────────────────────────────────────────

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function readNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (Array.isArray(v)) return readNumber(v[0]);
  if (typeof v === "object") {
    const inner = (v as any).value ?? (v as any).average ?? (v as any).avg ?? (v as any).ac ?? (v as any).hit_points;
    if (inner != null && inner !== v) return readNumber(inner);
  }
  return null;
}

function listToString(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v.map((x) => {
      if (x == null) return "";
      if (typeof x === "string") return x;
      if (typeof x === "number") return String(x);
      if (typeof x === "object") {
        const o = x as Record<string, unknown>;
        if (typeof o["name"] === "string") return o["name"];
        if (typeof o["note"] === "string" && typeof o["type"] === "string") return `${o["type"]} ${o["note"]}`;
        if (typeof o["type"] === "string") return o["type"];
      }
      return String(x);
    }).map(s => s.trim()).filter(Boolean).join(", ");
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).map(([k, val]) => `${k} ${String(val).trim()}`).join(", ");
  }
  return "";
}

function parseSpeedDisplay(sp: unknown): string {
  if (sp == null) return "";
  if (typeof sp === "string") return sp;
  if (typeof sp === "number") return `${sp} ft.`;
  if (typeof sp === "object") {
    const obj = sp as Record<string, unknown>;
    const parts: string[] = [];
    const push = (label: string, val: unknown) => {
      if (val == null) return;
      const s = String(val).trim();
      if (!s) return;
      parts.push(label === "walk" ? s : `${label} ${s}`);
    };
    if (obj["walk"] != null) push("walk", obj["walk"]);
    else if (obj["speed"] != null) push("walk", obj["speed"]);
    else if (obj["value"] != null) push("walk", obj["value"]);
    if (obj["fly"] != null) push("fly", obj["fly"]);
    if (obj["climb"] != null) push("climb", obj["climb"]);
    if (obj["swim"] != null) push("swim", obj["swim"]);
    if (obj["burrow"] != null) push("burrow", obj["burrow"]);
    return parts.join(", ");
  }
  return "";
}

const SIZE_CODE: Record<string, string> = { T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan" };

function buildInfoLines(m: any): Array<{ label: string; value: string }> {
  const sizeStr = SIZE_CODE[String(m.size ?? "").trim().toUpperCase()] ?? String(m.size ?? "").trim();
  const typeRaw = m.type?.type ?? m.type ?? "";
  const typeStr = typeof typeRaw === "string" ? typeRaw : "";
  const typeDisplay = typeStr ? typeStr.charAt(0).toUpperCase() + typeStr.slice(1) : "";
  const skillsStr = listToString(m.skill ?? m.skills ?? "");
  const sensesStr = listToString(m.senses ?? "");
  const langsStr = listToString(m.languages ?? "");
  const cr = m.cr ?? m.challenge_rating ?? m.challengeRating;
  const crStr = cr != null ? String(cr) : "";
  const dmgRes = listToString(m.damageResist ?? m.resist ?? m.resistance ?? "");
  const dmgImm = listToString(m.damageImmune ?? m.immune ?? m.immunity ?? "");
  const dmgVuln = listToString(m.damageVulnerable ?? m.vulnerable ?? m.vulnerability ?? "");
  const condImm = listToString(m.conditionImmune ?? m.conditionImmunity ?? m.condImmune ?? "");

  return [
    ...(sizeStr ? [{ label: "Size", value: sizeStr }] : []),
    ...(typeDisplay ? [{ label: "Type", value: typeDisplay }] : []),
    { label: "Skills", value: skillsStr || "—" },
    { label: "Senses", value: sensesStr || "—" },
    { label: "Languages", value: langsStr || "—" },
    { label: "Challenge Rating", value: crStr || "—" },
    { label: "Damage Resistances", value: dmgRes || "—" },
    { label: "Damage Vulnerabilities", value: dmgVuln || "—" },
    { label: "Damage Immunities", value: dmgImm || "—" },
    { label: "Condition Immunities", value: condImm || "—" },
  ];
}

function isSpellSection(name: unknown): boolean {
  return /spellcasting/i.test(String(name ?? ""));
}

// ─── Icon SVGs ────────────────────────────────────────────────────────────────

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

// ─── StatBar ─────────────────────────────────────────────────────────────────

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

// ─── AbilityTable ─────────────────────────────────────────────────────────────

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

function AbilityGroup({ keys, abilities, saves }: { keys: AbilityKey[]; abilities: Record<AbilityKey, number>; saves?: Partial<Record<AbilityKey, number>> }) {
  const cols = "48px 38px 1fr 1fr";
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, marginBottom: 6 }}>
        <div />
        {["Score", "Mod", "Save"].map(h => (
          <div key={h} style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: C.muted, textAlign: "center" }}>{h}</div>
        ))}
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        {keys.map((k) => {
          const score = Number(abilities[k] ?? 10);
          const mod = abilityMod(score);
          const save = saves?.[k] != null ? Number(saves[k]) : mod;
          return (
            <div key={k} style={{ display: "grid", gridTemplateColumns: cols, gap: 6, alignItems: "center" }}>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 900, textTransform: "uppercase", color: C.muted }}>{k}</div>
              <div style={{ padding: "5px 8px", borderRadius: 8, background: withAlpha("rgba(0,0,0,0.80)", 0.5), border: `1px solid ${C.panelBorder}`, fontWeight: 900, fontSize: "var(--fs-medium)", textAlign: "center", color: C.text, fontVariantNumeric: "tabular-nums", minWidth: 32 }}>{score}</div>
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

// ─── TextBlock ───────────────────────────────────────────────────────────────

function TextBlock({ items, title }: { items: any[]; title: string }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ color: C.accent, fontWeight: 900 }}>{title}</div>
      {items.map((t: any, i: number) => (
        <div key={i} style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 900 }}>{t.name ?? t.title ?? ""}</div>
          <div style={{ color: C.muted, whiteSpace: "pre-wrap", fontSize: "var(--fs-subtitle)" }}>
            {Array.isArray(t.text) ? t.text.join("\n") : (t.text ?? t.description ?? "")}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MonsterStatblock({ monster, hideSummaryBar = false }: { monster: any | null; hideSummaryBar?: boolean }) {
  const [infoOpen, setInfoOpen] = React.useState(true);

  if (!monster) {
    return <div style={{ color: C.muted }}>Select a monster to view its stat block.</div>;
  }

  const m = monster;

  const ac = readNumber(m.ac?.value ?? m.ac ?? m.armor_class);
  const hp = readNumber(m.hp?.average ?? m.hp ?? m.hit_points);
  const speedDisplay = parseSpeedDisplay(m.speed) || "—";
  const hpValue = hp != null ? `${hp} / ${hp}` : "—";

  const abilities: Record<AbilityKey, number> = {
    str: readNumber(m.str) ?? 10,
    dex: readNumber(m.dex) ?? 10,
    con: readNumber(m.con) ?? 10,
    int: readNumber(m.int) ?? 10,
    wis: readNumber(m.wis) ?? 10,
    cha: readNumber(m.cha) ?? 10,
  };

  const infoLines = buildInfoLines(m).filter(l => l.value?.trim() && l.value.trim() !== "—");

  const type = m.type?.type ?? m.type;
  const alignment = m.alignment;
  const cr = formatCr(m.cr ?? m.challenge_rating);

  const traitArr: any[] = Array.isArray(m.traits ?? m.trait) ? (m.traits ?? m.trait) : [];
  const actionArr: any[] = Array.isArray(m.actions ?? m.action) ? (m.actions ?? m.action) : [];
  const reactionArr: any[] = Array.isArray(m.reactions ?? m.reaction) ? (m.reactions ?? m.reaction) : [];
  const legendary: any[] = Array.isArray(m.legendary ?? m.legendaryActions) ? (m.legendary ?? m.legendaryActions) : [];

  const nonSpellTraits = traitArr.filter(t => !isSpellSection(t?.name ?? t?.title));
  const nonSpellActions = actionArr.filter(a => !isSpellSection(a?.name ?? a?.title));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Summary */}
      <div>
        <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: C.text }}>{m.name}</div>
        <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
          {[type, alignment, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}
        </div>
      </div>

      {/* AC / HP / Speed bar */}
      {!hideSummaryBar && (
        <div style={{ display: "flex", borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, overflow: "hidden" }}>
          <StatBar icon={<IconShield />} label="Armor Class" value={ac != null ? ac : "—"} />
          <div style={{ width: 1, background: C.panelBorder }} />
          <StatBar icon={<IconHeart />} label="Hit Points" value={hpValue} flex={1.4} />
          <div style={{ width: 1, background: C.panelBorder }} />
          <StatBar icon={<IconSpeed />} label="Speed" value={speedDisplay} />
        </div>
      )}

      {/* Ability table */}
      <div style={{ borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, padding: "8px 12px" }}>
        <AbilityTable abilities={abilities} />
      </div>

      {/* Details (collapsible) */}
      {infoLines.length > 0 && (
        <div style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 12, background: C.panelBg, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setInfoOpen(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "transparent", border: 0, cursor: "pointer", color: C.text, fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase" }}
          >
            <span>Details</span>
            <span style={{ color: C.muted }}>{infoOpen ? "▲" : "▼"}</span>
          </button>
          {infoOpen && (
            <div style={{ padding: "0 12px 10px", display: "grid", gap: 4 }}>
              {infoLines.map(l => (
                <div key={l.label} style={{ display: "flex", gap: 6, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
                  <span style={{ color: C.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{l.label}</span>
                  <span style={{ color: C.text }}>{l.value}</span>
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

