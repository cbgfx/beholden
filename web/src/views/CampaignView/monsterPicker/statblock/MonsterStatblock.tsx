import * as React from "react";
import { api } from "@/services/api";
import { parseLeadingNumber } from "@/lib/parse/statDetails";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { CharacterSheetPanel, type CharacterSheetStats } from "@/components/CharacterSheet";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";

function StatLine(props: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 5, padding: "6px 0" }}>
      <div style={{ color: theme.colors.muted, fontWeight: 700 }}>{props.label}</div>
      <div style={{ color: theme.colors.text }}>{props.value}</div>
    </div>
  );
}

export function MonsterStatblock(props: { monster: any | null; hideSummary?: boolean; attackOverrides?: Record<string, { toHit?: number; damage?: string; damageType?: string }>; onChangeAttack?: (actionName: string, patch: { toHit?: number; damage?: string; damageType?: string }) => void }) {
  const m = props.monster;
  if (!m) return <div style={{ color: theme.colors.muted }}>Select a monster to preview its stats.</div>;

  // Compendium schemas vary wildly across sources. Keep number extraction defensive,
  // otherwise the CharacterSheet summary can show "—" even when the editable fields
  // (and the statblock text) contain valid values.
  const readNumber = React.useCallback(
    (v: any): number | null => {
      if (v == null) return null;
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "string") return parseLeadingNumber(v);
      if (Array.isArray(v)) return readNumber(v[0]);
      if (typeof v === "object") {
        // Common shapes: { value }, { average }, { avg }, { ac }, etc.
        const inner = (v as any).value ?? (v as any).average ?? (v as any).avg ?? (v as any).ac ?? (v as any).armor_class ?? (v as any).hit_points;
        if (inner != null && inner !== v) return readNumber(inner);
        // As a last resort, stringify and attempt a leading number parse.
        return parseLeadingNumber(String(v));
      }
      return null;
    },
    []
  );

  const ordinal = (n: number) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  };

  const normalizeSpellName = React.useCallback((name: string) => {
    // Keep display text intact elsewhere; normalization is only for matching.
    const base = name
      .replace(/\[[^\]]+\]\s*$/g, "")
      .replace(/\([^\)]*\)\s*$/g, "")
      .trim()
      .toLowerCase();
    return base.replace(/\s+/g, " ");
  }, []);

  const extractSpellNames = React.useCallback(
    (text: string) => {
      if (!text) return [] as string[];
      const out: string[] = [];
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => !/^source:/i.test(l));

      for (const line of lines) {
        // Typical patterns: "Cantrips (at will): light, sacred flame" or "1st level (3 slots): bless, cure wounds"
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const rhs = line.slice(idx + 1).trim();
        if (!rhs) continue;
        const parts = rhs.split(/[,;]/g);
        for (let p of parts) {
          p = p
            .replace(/^and\s+/i, "")
            .replace(/\.$/, "")
            .trim();
          if (!p) continue;
          // Ignore non-spell tokens that can appear in some compendiums.
          if (/^\(?at\s*will\)?$/i.test(p)) continue;
          out.push(p);
        }
      }

      // Deduplicate by normalized name but keep the first display form.
      const seen = new Set<string>();
      const dedup: string[] = [];
      for (const n of out) {
        const key = normalizeSpellName(n);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        dedup.push(n);
      }
      return dedup;
    },
    [normalizeSpellName]
  );

  const [spellOpen, setSpellOpen] = React.useState(false);
  const [spellLoading, setSpellLoading] = React.useState(false);
  const [spellError, setSpellError] = React.useState<string | null>(null);
  const [spellDetail, setSpellDetail] = React.useState<any | null>(null);

  // Reset spell detail when switching monsters.
  React.useEffect(() => {
    setSpellOpen(false);
    setSpellLoading(false);
    setSpellError(null);
    setSpellDetail(null);
  }, [m?.id, m?.name]);

  // Forgiving render; compendium schemas vary.
  const ac = m.ac?.value ?? m.ac ?? m.armor_class;
  const hp = m.hp?.average ?? m.hp ?? m.hit_points;
  const speed = m.speed?.walk ?? m.speed?.value ?? m.speed;
  const type = m.type?.type ?? m.type;
  const alignment = m.alignment;

  const acNum = readNumber(ac);
  const hpNum = readNumber(hp);

  const abil = m.abilities ?? m.abilityScores ?? m.ability_scores ?? {};
  const str = m.str ?? abil.str;
  const dex = m.dex ?? abil.dex;
  const con = m.con ?? abil.con;
  const intl = m.int ?? abil.int;
  const wis = m.wis ?? abil.wis;
  const cha = m.cha ?? abil.cha;

  const traits = m.traits ?? m.trait ?? [];
  const actions = m.actions ?? m.action ?? [];
  const legendary = m.legendary ?? m.legendaryActions ?? [];

  const traitArr: any[] = Array.isArray(traits) ? traits : [];
  const actionArr: any[] = Array.isArray(actions) ? actions : [];

  // Many spellcasters have "Spellcasting" / "Innate Spellcasting" as a trait (not an action).
  // Show those under a dedicated "Spells" section so Actions doesn't look "missing".
  const isSpellSection = (name: unknown) => {
    const s = String(name ?? "");
    return /spellcasting/i.test(s) || /innate spellcasting/i.test(s);
  };

  const spellTraits = traitArr.filter((t) => isSpellSection(t?.name ?? t?.title));
  const nonSpellTraits = traitArr.filter((t) => !isSpellSection(t?.name ?? t?.title));
  const spellActions = actionArr.filter((a) => isSpellSection(a?.name ?? a?.title));
  const nonSpellActions = actionArr.filter((a) => !isSpellSection(a?.name ?? a?.title));

  const spellTextCombined = [...spellTraits, ...spellActions]
    .map((x: any) => String(x?.text ?? x?.description ?? ""))
    .filter(Boolean)
    .join("\n");

  // Prefer the explicit <spells> field from the monster record.
  const monsterSpellNames: string[] = (() => {
    const v = m?.spells ?? m?.raw_json?.spells;
    // Some compendium sources store spells as an array, but each entry can itself be a
    // comma-separated list. Normalize to one-spell-per-entry.
    if (Array.isArray(v)) {
      const out: string[] = [];
      for (const x of v) {
        const s = String(x ?? "").trim();
        if (!s) continue;
        for (const part of s.split(/[,;]/g)) {
          const p = part.trim();
          if (p) out.push(p);
        }
      }
      return out;
    }
    if (typeof v === "string") {
      return v.split(/[,;]/g).map((x) => x.trim()).filter(Boolean);
    }
    return [];
  })();

  const fallbackNames = extractSpellNames(spellTextCombined);
  const spellNames = monsterSpellNames.length ? monsterSpellNames : fallbackNames;

  const [spellMetaByName, setSpellMetaByName] = React.useState<Record<string, any>>({});
  const [slotsByLevel, setSlotsByLevel] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    let cancelled = false;

    // Parse slot counts from the spellcasting trait, if present.
    const nextSlots: Record<number, number> = {};
    const slotRegex = /(\d+)(?:st|nd|rd|th)\s+level\s*\((\d+)\s+slots?\)/gi;
    let match: RegExpExecArray | null;
    while ((match = slotRegex.exec(spellTextCombined))) {
      const lvl = Number(match[1]);
      const cnt = Number(match[2]);
      if (Number.isFinite(lvl) && Number.isFinite(cnt)) nextSlots[lvl] = cnt;
    }
    setSlotsByLevel(nextSlots);

    async function loadMeta() {
      const out: Record<string, any> = {};
      for (const name of spellNames) {
        try {
          const q = encodeURIComponent(name);
          const results = await api<any[]>(`/api/spells/search?q=${q}&limit=50`);
          const wantExact = String(name).trim().toLowerCase();
          const base = wantExact.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
          const pick =
            results.find((r) => String(r?.name ?? "").trim().toLowerCase() === wantExact) ??
            results.find((r) => String(r?.name ?? "").trim().toLowerCase() === base) ??
            results[0];
          if (pick?.id) out[name] = pick;
        } catch {
          // ignore
        }
      }
      if (!cancelled) setSpellMetaByName(out);
    }

    setSpellMetaByName({});
    if (spellNames.length) void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [m?.id, spellTextCombined, spellNames.join("|")]);

  async function openSpellByName(name: string) {
    setSpellOpen(true);
    setSpellLoading(true);
    setSpellError(null);
    setSpellDetail(null);

    try {
      const q = encodeURIComponent(name);
      const results = await api<any[]>(`/api/spells/search?q=${q}&limit=20`);
      const want = normalizeSpellName(name);
      const best =
        results.find((r) => normalizeSpellName(String(r?.name ?? "")) === want) ??
        results[0];

      if (!best?.id) {
        setSpellError("Spell not found in compendium.");
        return;
      }

      const detail = await api<any>(`/api/spells/${encodeURIComponent(best.id)}`);
      setSpellDetail(detail);
    } catch {
      setSpellError("Could not load spell details.");
    } finally {
      setSpellLoading(false);
    }
  }

  const renderNamed = (arr: any[]) =>
    arr?.length ? (
      <div style={{ display: "grid", gap: 4 }}>
        {arr.map((t: any, idx: number) => {
          const name = String(t.name ?? t.title ?? "—");
          const attack = t?.attack ?? null;
          const override = props.attackOverrides?.[name] ?? null;

          const toHitVal =
            override?.toHit != null ? String(override.toHit) : attack?.toHit != null ? String(attack.toHit) : "";
          const dmgVal = override?.damage ?? attack?.damage ?? "";
          const dmgTypeVal = override?.damageType ?? attack?.damageType ?? "";

          return (
            <div
              key={idx}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: "rgba(0,0,0,0.12)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ color: theme.colors.text, fontWeight: 900 }}>{name}</div>

                {attack && props.onChangeAttack ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>To Hit</div>
                      <Input
                        value={toHitVal}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          props.onChangeAttack?.(name, { toHit: v ? Number(v) : undefined });
                        }}
                        placeholder="+0"
                        style={{ width: 60 }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>Damage</div>
                      <Input
                        value={dmgVal}
                        onChange={(e) => props.onChangeAttack?.(name, { damage: e.target.value })}
                        placeholder="1d6+2"
                        style={{ width: 92 }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>Type</div>
                      <Input
                        value={dmgTypeVal}
                        onChange={(e) => props.onChangeAttack?.(name, { damageType: e.target.value })}
                        placeholder="piercing"
                        style={{ width: 92 }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={{ color: theme.colors.muted, whiteSpace: "pre-wrap", fontSize: "var(--fs-subtitle)" }}>
                {t.text ?? t.description ?? ""}
              </div>
            </div>
          );
        })}
      </div>
    ) : null;

  const groupedSpells = React.useMemo(() => {
    const byLevel = new Map<number, { level: number; spells: { key: string; display: string; meta: any }[] }>();
    for (const key of spellNames) {
      const meta = spellMetaByName[key] ?? null;
      const lvl = meta?.level != null ? Number(meta.level) : null;
      if (!Number.isFinite(lvl as number)) continue;
      const level = lvl as number;
      if (!byLevel.has(level)) byLevel.set(level, { level, spells: [] });
      byLevel.get(level)!.spells.push({ key, display: String(meta.name ?? key), meta });
    }

    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    return levels.map((level) => {
      const slot = slotsByLevel[level];
      const title = level === 0 ? "Cantrips (at will)" : slot ? `${ordinal(level)} level (${slot} slots)` : `${ordinal(level)} level`;
      const spells = (byLevel.get(level)?.spells ?? []).sort((a, b) => a.display.localeCompare(b.display));
      return { level, title, spells };
    });
  }, [spellNames, spellMetaByName, slotsByLevel]);

  const sheetStats: CharacterSheetStats = React.useMemo(() => {
    const acNum = readNumber(ac);
    const hpNum = readNumber(hp);

    const speedVal = (() => {
      const sp = m.speed;
      if (typeof sp === "number") return sp;
      if (typeof sp === "string") {
        const match = sp.match(/\d+/);
        return match ? Number(match[0]) : null;
      }
      if (sp && typeof sp === "object") {
        const w: any = (sp.walk ?? sp.value ?? sp.speed) as any;
        if (typeof w === "number") return w;
        if (typeof w === "string") {
          const match = w.match(/\d+/);
          return match ? Number(match[0]) : null;
        }
      }
      return null;
    })();

    const speedDisplay = (() => {
      const sp: any = m.speed;
      if (sp == null) return "";
      if (typeof sp === "string") return sp;
      if (typeof sp === "number") return `${sp} ft.`;
      if (typeof sp === "object") {
        const parts: string[] = [];
        const pushPart = (label: string, val: any) => {
          if (val == null) return;
          const s = String(val).trim();
          if (!s) return;
          // If it already includes 'ft', keep as-is; otherwise append 'ft.'
          parts.push(label === "walk" ? s : `${label} ${s}`);
        };

        if (sp.walk != null) pushPart("walk", sp.walk);
        if (sp.speed != null && sp.walk == null) pushPart("walk", sp.speed);
        if (sp.value != null && sp.walk == null && sp.speed == null) pushPart("walk", sp.value);

        if (sp.fly != null) pushPart("fly", sp.fly);
        if (sp.climb != null) pushPart("climb", sp.climb);
        if (sp.swim != null) pushPart("swim", sp.swim);
        if (sp.burrow != null) pushPart("burrow", sp.burrow);

        return parts.join(", ");
      }
      return "";
    })();

    const raw: any = m.raw_json ?? m;
    const skillsObj = raw.skill ?? raw.skills;
    const skillsStr = (() => {
      if (!skillsObj) return "";
      if (typeof skillsObj === "string") return skillsObj;
      if (typeof skillsObj === "object") {
        return Object.entries(skillsObj)
          .map(([k, v]) => `${String(k)} ${String(v)}`)
          .join(", ");
      }
      return "";
    })();
    const sensesStr = (() => {
      const s = raw.senses;
      if (Array.isArray(s)) return s.join(", ");
      if (typeof s === "string") return s;
      return "";
    })();
    const langsStr = (() => {
      const l = raw.languages;
      if (Array.isArray(l)) return l.join(", ");
      if (typeof l === "string") return l;
      return "";
    })();
    const cr = raw.cr ?? m.cr ?? m.challenge_rating;
    const xp = raw.xp ?? raw.experience;

    const listToString = (v: any): string => {
      if (!v) return "";
      if (typeof v === "string") return v;
      if (Array.isArray(v)) {
        const parts = v
          .map((x) => {
            if (x == null) return "";
            if (typeof x === "string") return x;
            if (typeof x === "number") return String(x);
            if (typeof x === "object") {
              if (typeof (x as any).name === "string") return (x as any).name;
              if (typeof (x as any).type === "string" && typeof (x as any).note === "string") return `${(x as any).type} ${(x as any).note}`;
              if (typeof (x as any).type === "string") return (x as any).type;
            }
            return String(x);
          })
          .map((s) => s.trim())
          .filter(Boolean);
        return parts.join(", ");
      }
      if (typeof v === "object") {
        try {
          return Object.entries(v)
            .map(([k, val]) => `${k} ${String(val).trim()}`)
            .join(", ");
        } catch {
          return "";
        }
      }
      return "";
    };

    const dmgRes = listToString(raw.damageResist ?? raw.resist ?? raw.resistance);
    const dmgImm = listToString(raw.damageImmune ?? raw.immune ?? raw.immunity);
    const dmgVuln = listToString(raw.damageVulnerable ?? raw.vulnerable ?? raw.vulnerability);
    const condImm = listToString(raw.conditionImmune ?? raw.conditionImmunity ?? raw.condImmune);

    return {
      ac: acNum ?? NaN,
      hpCur: hpNum ?? NaN,
      hpMax: hpNum ?? NaN,
      speed: speedVal,
      abilities: {
        str: Number(str ?? 10),
        dex: Number(dex ?? 10),
        con: Number(con ?? 10),
        int: Number(intl ?? 10),
        wis: Number(wis ?? 10),
        cha: Number(cha ?? 10)
      },
      infoLines: [
        { label: "Speed", value: String(speedDisplay || "—") },
        { label: "Skills", value: String(skillsStr || "—") },
        { label: "Senses", value: String(sensesStr || "—") },
        { label: "Languages", value: String(langsStr || "—") },
        { label: "Challenge Rating", value: cr != null ? `${cr}${xp != null ? ` (${xp} XP)` : ""}` : "—" },
        { label: "Damage Resistances", value: dmgRes || "—" },
        { label: "Damage Vulnerabilities", value: dmgVuln || "—" },
        { label: "Damage Immunities", value: dmgImm || "—" },
        { label: "Condition Immunities", value: condImm || "—" }
      ]
    };
  }, [m, ac, hp, str, dex, con, intl, wis, cha, readNumber]);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 5 }}>
        <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: theme.colors.text }}>{m.name}</div>
        <div style={{ color: theme.colors.muted, fontWeight: 700 }}>CR {formatCr(m.cr ?? (m as any).challenge_rating)}</div>
      </div>

      <div style={{ color: theme.colors.muted }}>{[type, alignment].filter(Boolean).join(" • ")}</div>

      {!props.hideSummary ? (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: "rgba(0,0,0,0.14)"
          }}
        >
          <CharacterSheetPanel stats={sheetStats} />
        </div>
      ) : (
        <div
          style={{
            padding: 12,
            borderRadius: 14,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: "rgba(0,0,0,0.14)"
          }}
        >
          {/* hideSummary hides the big sheet layout, but we still want InfoLines (skills/senses/etc.) */}
          <CharacterSheetPanel stats={sheetStats} />
        </div>
      )}

      {spellNames.length || spellTraits.length || spellActions.length ? (
        <div style={{ display: "grid", gap: 5 }}>
          <div style={{ color: theme.colors.accent, fontWeight: 900 }}>Spells</div>

          {groupedSpells.length ? (
            <div style={{ display: "grid", gap: 5 }}>
              {groupedSpells.map((g) => (
                <div key={g.level} style={{ display: "grid", gap: 4 }}>
                  <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-medium)" }}>{g.title}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {g.spells.map((s) => (
                      <button
                        key={`${g.level}_${s.key}`}
                        type="button"
                        onClick={() => openSpellByName(s.display)}
                        style={{
                          border: `1px solid ${theme.colors.panelBorder}`,
                          background: "rgba(0,0,0,0.14)",
                          color: theme.colors.text,
                          padding: "6px 10px",
                          borderRadius: 999,
                          fontWeight: 800,
                          cursor: "pointer"
                        }}
                        title="Open spell"
                      >
                        {s.display}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {spellOpen ? (
            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 14,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: "rgba(0,0,0,0.14)"
              }}
            >
              {spellLoading ? (
                <div style={{ color: theme.colors.muted }}>Loading spell…</div>
              ) : spellError ? (
                <div style={{ color: theme.colors.red, fontWeight: 800 }}>{spellError}</div>
              ) : spellDetail ? (
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 5, alignItems: "baseline" }}>
                    <div style={{ color: theme.colors.text, fontWeight: 1000, fontSize: "var(--fs-title)" }}>{spellDetail.name}</div>
                    <div style={{ color: theme.colors.muted, fontWeight: 800 }}>
                      {(Number(spellDetail.level) === 0 ? "Cantrip" : `L${spellDetail.level ?? "?"}`)}
                      {spellDetail.school ? ` • ${spellDetail.school}` : ""}
                    </div>
                  </div>

                  <div style={{ color: theme.colors.muted, fontSize: "var(--fs-subtitle)" }}>
                    {[spellDetail.time, spellDetail.range, spellDetail.duration].filter(Boolean).join(" • ")}
                  </div>

                  {spellDetail.components ? (
                    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-subtitle)" }}>Components: {spellDetail.components}</div>
                  ) : null}

                  <div style={{ color: theme.colors.text, whiteSpace: "pre-wrap", fontSize: "var(--fs-subtitle)" }}>
                    {Array.isArray(spellDetail.text) ? spellDetail.text.filter(Boolean).join("\n") : String(spellDetail.text ?? "")}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                <Button variant="ghost" onClick={() => setSpellOpen(false)}>
                  Close spell
                </Button>
              </div>
            </div>
          ) : null}

          {/* Keep the original spellcasting blocks visible for usage limits / slots notes */}
          {renderNamed([...spellTraits, ...spellActions])}
        </div>
      ) : null}

      {nonSpellTraits.length ? (
        <div style={{ display: "grid", gap: 5 }}>
          <div style={{ color: theme.colors.accent, fontWeight: 900 }}>Traits</div>
          {renderNamed(nonSpellTraits)}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ color: theme.colors.accent, fontWeight: 900 }}>Actions</div>
        {renderNamed(nonSpellActions)}
      </div>

      {Array.isArray(legendary) && legendary.length ? (
        <div style={{ display: "grid", gap: 5 }}>
          <div style={{ color: theme.colors.accent, fontWeight: 900 }}>Legendary</div>
          {renderNamed(legendary)}
        </div>
      ) : null}
    </div>
  );
}


export const MonsterStatblockMemo = React.memo(MonsterStatblock);

