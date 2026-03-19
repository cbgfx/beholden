import * as React from "react";
import { C } from "@/lib/theme";
import { formatCr } from "@/lib/monsterPicker/utils";

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

function mod(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : String(m);
}

function AbilityBox({ label, score }: { label: string; score: number | null }) {
  const s = score ?? 10;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 15 }}>{s}</div>
      <div style={{ fontSize: 12, color: C.accent }}>{mod(s)}</div>
    </div>
  );
}

function TextBlock({ items, title }: { items: any[]; title: string }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ color: C.accent, fontWeight: 900, fontSize: 13 }}>{title}</div>
      {items.map((t: any, i: number) => (
        <div key={i}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name ?? t.title ?? ""}</div>
          <div style={{ color: C.muted, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
            {Array.isArray(t.text) ? t.text.join("\n") : (t.text ?? t.description ?? "")}
          </div>
        </div>
      ))}
    </div>
  );
}

function isSpellSection(name: unknown): boolean {
  return /spellcasting/i.test(String(name ?? ""));
}

export function MonsterStatblock({ monster }: { monster: any | null }) {
  if (!monster) {
    return <div style={{ color: C.muted }}>Select a monster to view its stat block.</div>;
  }

  const m = monster;
  const ac = readNumber(m.ac?.value ?? m.ac ?? m.armor_class);
  const hp = readNumber(m.hp?.average ?? m.hp ?? m.hit_points);
  const type = m.type?.type ?? m.type;
  const cr = formatCr(m.cr ?? m.challenge_rating);

  const speed = (() => {
    const raw = m.speed;
    if (!raw) return "—";
    if (typeof raw === "string") return raw;
    if (typeof raw === "number") return `${raw} ft.`;
    if (typeof raw === "object") {
      return Object.entries(raw as Record<string, unknown>)
        .map(([k, v]) => k === "walk" ? `${v} ft.` : `${k} ${v} ft.`)
        .join(", ");
    }
    return "—";
  })();

  const abilities = ["str", "dex", "con", "int", "wis", "cha"] as const;

  const traitArr: any[] = Array.isArray(m.traits ?? m.trait) ? (m.traits ?? m.trait) : [];
  const actionArr: any[] = Array.isArray(m.actions ?? m.action) ? (m.actions ?? m.action) : [];
  const reactionArr: any[] = Array.isArray(m.reactions ?? m.reaction) ? (m.reactions ?? m.reaction) : [];
  const legendary: any[] = Array.isArray(m.legendary ?? m.legendaryActions) ? (m.legendary ?? m.legendaryActions) : [];

  const nonSpellTraits = traitArr.filter((t) => !isSpellSection(t?.name ?? t?.title));
  const nonSpellActions = actionArr.filter((a) => !isSpellSection(a?.name ?? a?.title));

  return (
    <div style={{ display: "grid", gap: 14, fontSize: 13, color: C.text }}>
      {/* Summary row */}
      <div>
        {[type, cr ? `CR ${cr}` : null].filter(Boolean).length > 0 && (
          <div style={{ color: C.muted, fontSize: 12 }}>
            {[type, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>

      {/* Core stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
        background: C.bg, border: `1px solid ${C.panelBorder}`, borderRadius: 10, padding: "10px 8px",
      }}>
        <StatLine label="AC" value={ac != null ? String(ac) : "—"} />
        <StatLine label="HP" value={hp != null ? String(hp) : "—"} />
        <StatLine label="Speed" value={speed} />
      </div>

      {/* Ability scores */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4,
        border: `1px solid ${C.panelBorder}`, borderRadius: 10, padding: "10px 4px",
      }}>
        {abilities.map((ab) => (
          <AbilityBox key={ab} label={ab.toUpperCase()} score={readNumber(m[ab])} />
        ))}
      </div>

      {/* Extra info */}
      {[
        ["Save", m.save], ["Skill", m.skill], ["Senses", m.senses],
        ["Languages", m.languages], ["Immune", m.immune],
        ["Resist", m.resist], ["Vulnerable", m.vulnerable],
      ].filter(([, v]) => v).map(([label, val]) => (
        <div key={label as string} style={{ fontSize: 12 }}>
          <span style={{ fontWeight: 800, color: C.muted }}>{label}: </span>
          <span>{String(val)}</span>
        </div>
      ))}

      <TextBlock items={nonSpellTraits} title="Traits" />
      <TextBlock items={nonSpellActions} title="Actions" />
      <TextBlock items={reactionArr} title="Reactions" />
      <TextBlock items={legendary} title="Legendary Actions" />
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}
