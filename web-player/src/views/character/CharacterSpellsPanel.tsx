import React from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { CollapsiblePanel, panelHeaderAddBtn } from "@/views/character/CharacterViewParts";
import type { GrantedSpellCast, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import type { ClassRestDetail } from "@/views/character/SpellSlotsPanel";
import { normalizeSpellTrackingKey, normalizeSpellTrackingName } from "@/views/character/CharacterSheetUtils";
import { AddSpellDrawer, SpellDrawer } from "@/views/character/CharacterSpellDrawers";
import {
  type FetchedSpellDetail,
  DMG_COLORS,
  DMG_EMOJI,
  LEVEL_LABELS,
  abbrevTime,
  getScaledSpellDamage,
  grantedSpellChargeBtn,
  highestAvailableSlotLevel,
  parseSpellDamage,
  parseSpellSave,
  spellSectionArrow,
  spellSectionHeaderBtn,
} from "@/views/character/CharacterSpellShared";

type SpellLookupRow = {
  query: string;
  match: { id: string; name: string; level: number | null } | null;
};

function formatResourceResetLabel(reset: ResourceCounter["reset"]): string {
  if (reset === "S") return "Short Rest";
  if (reset === "SL") return "Short or Long Rest";
  return "Long Rest";
}

// ---------------------------------------------------------------------------
// RichSpellsPanel
// ---------------------------------------------------------------------------

export function RichSpellsPanel({ spells, grantedSpells = [], resources = [], pb, scores, accentColor, classDetail, charLevel, preparedLimit = 0, usesFlexiblePreparedList = false, usedSpellSlots, preparedSpells, onSlotsChange, onPreparedChange, onAddSpell, onRemoveSpell, addSpellSourceLabel, onResourceChange, spellcastingBlocked = false, spellDamageBonuses = {} }: {
  spells: { name: string; source: string; id?: string; ability?: "str" | "dex" | "con" | "int" | "wis" | "cha" | null }[];
  grantedSpells?: GrantedSpellCast[];
  resources?: ResourceCounter[];
  pb: number;
  scores: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number | null>;
  accentColor: string;
  classDetail: ClassRestDetail | null;
  charLevel: number;
  preparedLimit?: number;
  usesFlexiblePreparedList?: boolean;
  usedSpellSlots: Record<string, number>;
  preparedSpells: string[];
  onSlotsChange: (next: Record<string, number>) => Promise<void>;
  onPreparedChange: (next: string[]) => Promise<void>;
  onAddSpell?: (spell: { name: string; id?: string; level?: number | null }) => Promise<void> | void;
  onRemoveSpell?: (spellName: string) => Promise<void> | void;
  addSpellSourceLabel?: string;
  onResourceChange?: (key: string, delta: number) => Promise<void> | void;
  spellcastingBlocked?: boolean;
  spellDamageBonuses?: Record<string, number>;
}) {
  const [details, setDetails] = React.useState<Record<string, FetchedSpellDetail>>({});
  const [selectedSpell, setSelectedSpell] = React.useState<{ detail: FetchedSpellDetail; source?: string | null } | null>(null);
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({});
  const [addSpellOpen, setAddSpellOpen] = React.useState(false);
  const [spellSearch, setSpellSearch] = React.useState("");
  const [spellSearchResults, setSpellSearchResults] = React.useState<FetchedSpellDetail[]>([]);
  const [spellSearchLoading, setSpellSearchLoading] = React.useState(false);

  const trackedEntries = React.useMemo(() => spells.map((sp) => ({
    rawName: sp.name,
    source: sp.source,
    spellId: sp.id ? String(sp.id) : null,
    ability: sp.ability ?? null,
    searchName: normalizeSpellTrackingName(sp.name),
    key: normalizeSpellTrackingKey(sp.name),
    removable: true,
    forcedPrepared: false,
  })), [spells]);
  const grantedEntries = React.useMemo(() => grantedSpells.map((sp) => ({
    ...sp,
    spellId: sp.spellId ? String(sp.spellId) : null,
    searchName: normalizeSpellTrackingName(sp.spellName),
    key: normalizeSpellTrackingKey(sp.spellName),
    grantKey: sp.key,
  })), [grantedSpells]);
  const specialGrantedEntries = React.useMemo(
    () => grantedEntries.filter((entry) => entry.mode === "at_will" || entry.mode === "expanded_list" || entry.mode === "limited"),
    [grantedEntries]
  );
  const entries = React.useMemo(() => {
    const merged = new Map<string, {
      rawName: string;
      source: string;
      spellId: string | null;
      ability: "str" | "dex" | "con" | "int" | "wis" | "cha" | null;
      searchName: string;
      key: string;
      removable: boolean;
      forcedPrepared: boolean;
    }>();
    trackedEntries.forEach((entry) => merged.set(entry.key, entry));
    grantedEntries
      .filter((entry) => entry.mode === "known" || entry.mode === "always_prepared")
      .forEach((entry) => {
        const existing = merged.get(entry.key);
        if (existing) {
          existing.removable = false;
          existing.spellId = existing.spellId ?? entry.spellId;
          existing.ability = existing.ability ?? entry.ability ?? null;
          if (entry.mode === "always_prepared") existing.forcedPrepared = true;
          return;
        }
        merged.set(entry.key, {
          rawName: entry.spellName,
          source: entry.sourceName,
          spellId: entry.spellId ?? null,
          ability: entry.ability ?? null,
          searchName: entry.searchName,
          key: entry.key,
          removable: false,
          forcedPrepared: entry.mode === "always_prepared",
        });
      });
    return Array.from(merged.values()).sort((a, b) => a.searchName.localeCompare(b.searchName));
  }, [grantedEntries, trackedEntries]);
  const forcedPreparedKeys = React.useMemo(
    () => new Set(entries.filter((entry) => entry.forcedPrepared).map((entry) => entry.key)),
    [entries]
  );
  const preparedListCount = React.useMemo(
    () => preparedSpells.filter((entry) => !forcedPreparedKeys.has(entry)).length,
    [forcedPreparedKeys, preparedSpells]
  );
  const knownSpellKeys = React.useMemo(() => new Set(entries.map((entry) => entry.key)), [entries]);
  const grantedSpellKeys = React.useMemo(() => new Set(specialGrantedEntries.map((entry) => entry.key)), [specialGrantedEntries]);

  const entryKeysStr = [...entries.map((e) => e.key), ...specialGrantedEntries.map((e) => e.key)].join(",");
  React.useEffect(() => {
    const allEntries = [...entries, ...specialGrantedEntries];
    const missingEntries = allEntries.filter((entry) => !details[entry.key]);
    if (missingEntries.length === 0) return;
    let alive = true;

    const directEntries = missingEntries.filter((entry) => entry.spellId);
    const unresolvedByName = new Map<string, typeof missingEntries>();
    for (const entry of missingEntries) {
      if (entry.spellId) continue;
      const bucket = unresolvedByName.get(entry.searchName) ?? [];
      bucket.push(entry);
      unresolvedByName.set(entry.searchName, bucket);
    }

    const load = async () => {
      const updates: Record<string, FetchedSpellDetail> = {};

      await Promise.all(
        directEntries.map(async (entry) => {
          try {
            const detail = await api<FetchedSpellDetail>(`/api/spells/${encodeURIComponent(entry.spellId!)}`);
            const textStr = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
            updates[entry.key] = { ...detail, damage: parseSpellDamage(textStr), save: parseSpellSave(textStr) };
          } catch {
            // ignore
          }
        }),
      );

      const unresolvedNames = Array.from(unresolvedByName.keys());
      if (unresolvedNames.length > 0) {
        try {
          const payload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: unresolvedNames }),
          });
          await Promise.all(
            (payload.rows ?? [])
              .filter((row) => Boolean(row?.match?.id))
              .map(async (row) => {
                try {
                  const detail = await api<FetchedSpellDetail>(`/api/spells/${encodeURIComponent(row.match!.id)}`);
                  const textStr = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
                  const enriched: FetchedSpellDetail = {
                    ...detail,
                    damage: parseSpellDamage(textStr),
                    save: parseSpellSave(textStr),
                  };
                  for (const entry of unresolvedByName.get(row.query) ?? []) {
                    updates[entry.key] = enriched;
                  }
                } catch {
                  // ignore
                }
              }),
          );
        } catch {
          // ignore
        }
      }

      if (!alive) return;
      if (Object.keys(updates).length > 0) setDetails((prev) => ({ ...prev, ...updates }));
    };

    void load();
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryKeysStr]);

  const intMod = Math.floor(((scores.int ?? 10) - 10) / 2);
  const wisMod = Math.floor(((scores.wis ?? 10) - 10) / 2);
  const chaMod = Math.floor(((scores.cha ?? 10) - 10) / 2);
  function abilityModFor(key: "str" | "dex" | "con" | "int" | "wis" | "cha" | null | undefined): number {
    const score = key ? scores[key] : null;
    return Math.floor((((score ?? 10) as number) - 10) / 2);
  }
  const spellMod = Math.max(intMod, wisMod, chaMod);
  const spellAbilLabel = spellMod === chaMod ? "CHA" : spellMod === wisMod ? "WIS" : "INT";
  const saveDc = 8 + pb + spellMod;
  const spellAtk = pb + spellMod;

  // Spell slots for current level
  const levelSlots = classDetail?.autolevels.find((al) => al.level === charLevel)?.slots ?? null;
  const maxSpellSlotLevel = highestAvailableSlotLevel(levelSlots);

  const isPactMagic = classDetail?.slotsReset === "S";
  const usesPreparedSpellSelection = usesFlexiblePreparedList;

  // Group by spell level; for Pact Magic, all leveled spells are always cast at the current slot level
  const groups = new Map<number, typeof entries>();
  for (const e of entries) {
    const baseLevel = details[e.key]?.level ?? -1;
    const level = (isPactMagic && baseLevel > 0 && maxSpellSlotLevel > 0) ? maxSpellSlotLevel : baseLevel;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level)!.push(e);
  }

  function togglePrepared(key: string) {
    if (!usesPreparedSpellSelection) return;
    if (forcedPreparedKeys.has(key)) return;
    const isPrepared = preparedSpells.includes(key);
    const userPreparedCount = preparedSpells.filter((entry) => !forcedPreparedKeys.has(entry)).length;
    if (!isPrepared && preparedLimit > 0 && userPreparedCount >= preparedLimit) return;
    const next = isPrepared
      ? preparedSpells.filter((k) => k !== key)
      : [...preparedSpells, key];
    void onPreparedChange(next);
  }

  function toggleSlot(spellLevel: number, slotIndex: number) {
    const key = String(spellLevel);
    const used = usedSpellSlots[key] ?? 0;
    const max = (levelSlots && spellLevel > 0) ? (levelSlots[spellLevel] ?? 0) : 0;
    const remaining = Math.max(0, max - used);
    const next = slotIndex < remaining
      ? Math.max(0, max - slotIndex)
      : Math.max(0, max - (slotIndex + 1));
    void onSlotsChange({ ...usedSpellSlots, [key]: next });
  }

  function spellText(d: FetchedSpellDetail): string {
    return Array.isArray(d.text) ? d.text.join(" ") : String(d.text ?? "");
  }
  function spellUsesSave(d: FetchedSpellDetail | undefined): boolean {
    return d ? /saving throw/i.test(spellText(d)) : false;
  }
  function spellUsesAttack(d: FetchedSpellDetail | undefined): boolean {
    return d ? /spell attack|ranged spell attack|melee spell attack/i.test(spellText(d)) : false;
  }

  const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

  function toggleSection(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  React.useEffect(() => {
    const query = spellSearch.trim();
    if (!addSpellOpen || query.length < 2) {
      setSpellSearchResults([]);
      setSpellSearchLoading(false);
      return;
    }
    let alive = true;
    setSpellSearchLoading(true);
    api<Array<{ id: string; name: string; level: number | null }>>(`/api/spells/search?q=${encodeURIComponent(query)}&limit=20&compact=1&excludeSpecial=1`)
      .then(async (results) => {
        if (!alive) return;
        const detailed = await Promise.all(
          results.map(async (result) => {
            try {
              return await api<FetchedSpellDetail>(`/api/spells/${result.id}`);
            } catch {
              return null;
            }
          })
        );
        if (alive) setSpellSearchResults(detailed.filter((entry): entry is FetchedSpellDetail => Boolean(entry)));
      })
      .catch(() => {
        if (alive) setSpellSearchResults([]);
      })
      .finally(() => {
        if (alive) setSpellSearchLoading(false);
      });
    return () => { alive = false; };
  }, [addSpellOpen, spellSearch]);

  return (<>
    <CollapsiblePanel title="Spells" color={accentColor} storageKey="spells" actions={
      onAddSpell ? <button type="button" onClick={() => setAddSpellOpen(true)} title="Add spell" style={panelHeaderAddBtn(accentColor)}>+</button> : undefined
    }>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {([
          { label: "ABILITY", value: spellAbilLabel, highlight: true },
          { label: "SAVE DC",  value: String(saveDc),     highlight: false },
          { label: "ATK BONUS", value: `+${spellAtk}`,   highlight: false },
        ] as const).map(({ label, value, highlight }) => (
          <div key={label} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "4px 10px", borderRadius: 8, flex: 1,
            background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`,
          }}>
            <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</span>
            <span style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: spellcastingBlocked && !highlight ? C.colorPinkRed : highlight ? accentColor : C.text }}>
              {value}{spellcastingBlocked && !highlight ? " X" : ""}
            </span>
          </div>
        ))}
      </div>
      {spellcastingBlocked && (
        <div style={{
          marginBottom: 10,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(248,113,113,0.35)",
          background: "rgba(248,113,113,0.10)",
          color: "#fca5a5",
          fontSize: "var(--fs-small)",
          fontWeight: 700,
        }}>
          You can't cast spells while wearing armor or a shield without proficiency.
        </div>
      )}
      {classDetail?.slotsReset === "S" && maxSpellSlotLevel > 0 && (
        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, marginBottom: 12 }}>
          Pact Magic: cast Warlock spells using level {maxSpellSlotLevel} slots.
        </div>
      )}
      {usesFlexiblePreparedList && preparedLimit > 0 && (
        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, marginBottom: 12 }}>
          Prepared spell list: {Math.min(preparedListCount, preparedLimit)} / {preparedLimit}. Always-prepared spells do not count against this limit.
        </div>
      )}

      {specialGrantedEntries.length > 0 && (
        <div style={{ marginBottom: 18, opacity: spellcastingBlocked ? 0.65 : 1 }}>
          <button
            type="button"
            onClick={() => toggleSection("granted")}
            style={spellSectionHeaderBtn("rgba(96,165,250,0.25)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={spellSectionArrow(Boolean(collapsedSections.granted), C.colorRitual)}>▼</span>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: C.colorRitual, textTransform: "uppercase", letterSpacing: 1 }}>
                Granted Spells
              </div>
            </div>
          </button>
          {!collapsedSections.granted && specialGrantedEntries.map((entry) => {
            const detail = details[entry.key];
            const resource = entry.resourceKey ? resources.find((item) => item.key === entry.resourceKey) : null;
            return (
              <div
                key={entry.grantKey}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: detail ? "pointer" : "default",
                }}
                onClick={(ev) => {
                  if ((ev.target as HTMLElement).closest("button")) return;
                  if (detail) setSelectedSpell({ detail, source: entry.sourceName });
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.text }}>{entry.searchName}</div>
                  <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 1 }}>{entry.sourceName}</div>
                  {entry.note ? (
                    <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 4, lineHeight: 1.45 }}>{entry.note}</div>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {(entry.mode === "at_will" || entry.mode === "expanded_list" || entry.mode === "always_prepared" || entry.mode === "known") ? (() => {
                    const [rgb, text] = entry.mode === "at_will" ? ["96,165,250", "At Will"]
                      : entry.mode === "expanded_list" ? ["251,191,36", "Expanded"]
                      : entry.mode === "always_prepared" ? ["196,181,253", "Prepared"]
                      : ["52,211,153", "Known"];
                    return (
                      <div style={{
                        padding: "5px 8px", borderRadius: 999,
                        border: `1px solid rgba(${rgb},0.35)`,
                        background: `rgba(${rgb},0.12)`,
                        color: `rgb(${rgb})`,
                        fontSize: "var(--fs-tiny)", fontWeight: 800,
                        textTransform: "uppercase", letterSpacing: "0.07em",
                      }}>{text}</div>
                    );
                  })() : resource ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void onResourceChange?.(resource.key, -1)}
                        disabled={resource.current <= 0}
                        style={grantedSpellChargeBtn(resource.current > 0)}
                      >
                        -
                      </button>
                      <div style={{ textAlign: "center", minWidth: 58 }}>
                        <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{resource.current}/{resource.max}</div>
                        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{formatResourceResetLabel(resource.reset)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onResourceChange?.(resource.key, 1)}
                        disabled={resource.current >= resource.max}
                        style={grantedSpellChargeBtn(resource.current < resource.max)}
                      >
                        +
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ opacity: spellcastingBlocked ? 0.65 : 1 }}>
      {entries.length === 0 && specialGrantedEntries.length === 0 && (
        <div style={{
          padding: "10px 0 4px",
          fontSize: "var(--fs-small)",
          color: C.muted,
          lineHeight: 1.6,
        }}>
          No spells on this character yet. Use <strong style={{ color: C.text }}>Add Spell</strong> to track spells found, learned, or granted at the table.
        </div>
      )}
      {[...groups.entries()].sort(([a], [b]) => a - b).map(([level, groupEntries]) => {
        const sectionKey = `level:${level}`;
        const isCollapsed = Boolean(collapsedSections[sectionKey]);
        const maxSlots = (levelSlots && level > 0) ? (levelSlots[level] ?? 0) : 0;
        const usedCount = usedSpellSlots[String(level)] ?? 0;
        const remaining = maxSlots - usedCount;

        return (
          <div key={level} style={{ marginBottom: 18 }}>
            {/* Level header with inline slots */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSection(sectionKey)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSection(sectionKey); }}
              style={spellSectionHeaderBtn(`${accentColor}44`, 8)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden="true" style={spellSectionArrow(isCollapsed, accentColor)}>▼</span>
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: 1 }}>
                {level === -1 ? "Loading…" : level === 0 ? "Cantrips" : (LEVEL_LABELS[level] ?? `Level ${level}`)}
              </div>
              {maxSlots > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginRight: 3 }}>slots {remaining}/{maxSlots}</span>
                  {Array.from({ length: maxSlots }).map((_, i) => {
                    const filled = i < remaining;
                    return (
                      <button
                        key={i}
                        title={filled ? "Expend slot" : "Regain slot"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSlot(level, i);
                        }}
                        style={{
                          width: 18, height: 18, borderRadius: "50%", padding: 0, cursor: "pointer",
                          border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.2)"}`,
                          background: filled ? accentColor : "transparent",
                        }}
                      />
                    );
                  })}
                </div>
              )}
              </div>
            </div>

            {!isCollapsed && (
              <>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto auto", gap: "0 8px", marginBottom: 4 }}>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {usesPreparedSpellSelection ? "PREP" : usesFlexiblePreparedList ? "LIST" : "KNOWN"}
              </div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>NAME</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>TIME</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>HIT / DC</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>EFFECT</div>
            </div>

            {groupEntries.map((e, i) => {
              const d = details[e.key];
              const scaledDamage = d ? getScaledSpellDamage(d, charLevel, maxSpellSlotLevel) : null;
              const spellDamageBonus = spellDamageBonuses[e.key] ?? 0;
              const scaledDamageText = scaledDamage
                ? `${scaledDamage.dice}${spellDamageBonus === 0 ? "" : `${spellDamageBonus > 0 ? "+" : ""}${spellDamageBonus}`}`
                : null;
              const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : null;
                const conc = d ? Boolean(d.concentration) : false;
                const usesSave = spellUsesSave(d);
                const usesAtk = spellUsesAttack(d);
                const entryAbility = e.ability ?? null;
                const entrySpellMod = entryAbility ? abilityModFor(entryAbility) : spellMod;
                const entrySaveDc = 8 + pb + entrySpellMod;
                const entrySpellAtk = pb + entrySpellMod;
                const isCantrip = level === 0;
                const isAlwaysPrepared = e.forcedPrepared;
                const isPrepared = isCantrip || isAlwaysPrepared || (!usesFlexiblePreparedList && !usesPreparedSpellSelection) || preparedSpells.includes(e.key);
                const userPreparedCount = preparedSpells.filter((entry) => !forcedPreparedKeys.has(entry)).length;
                const preparedLocked = usesPreparedSpellSelection
                  && !isCantrip
                  && !isAlwaysPrepared
                  && !isPrepared
                  && preparedLimit > 0
                  && userPreparedCount >= preparedLimit;
                return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto auto auto",
                  alignItems: "start", gap: "0 8px",
                  padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: d ? "pointer" : "default",
                }}
                  onClick={(ev) => {
                    if ((ev.target as HTMLElement).closest("button")) return;
                    if (d) setSelectedSpell({ detail: d, source: e.source });
                  }}
                >
                  {/* Prepared radio */}
                  <button
                    onClick={() => {
                      if (usesPreparedSpellSelection && !isCantrip && !isAlwaysPrepared && !preparedLocked) {
                        togglePrepared(e.key);
                      }
                    }}
                    title={
                      !usesPreparedSpellSelection
                        ? isCantrip
                          ? "Known cantrip"
                          : usesFlexiblePreparedList
                            ? "On your prepared spell list"
                            : "Known spell"
                        : isCantrip
                          ? "Cantrip (always prepared)"
                          : isAlwaysPrepared
                            ? "Always prepared"
                          : isPrepared
                            ? "Mark unprepared"
                            : preparedLocked
                              ? `Prepared limit reached (${preparedLimit})`
                              : "Mark prepared"
                    }
                    style={{
                      width: 20, height: 20, borderRadius: "50%", padding: 0,
                      cursor: !usesPreparedSpellSelection || isCantrip || isAlwaysPrepared || preparedLocked ? "default" : "pointer",
                      marginTop: 3,
                      border: `2px solid ${
                        isAlwaysPrepared
                          ? "rgba(196,181,253,0.95)"
                          : isPrepared
                            ? accentColor
                            : "rgba(255,255,255,0.25)"
                      }`,
                      background:
                        isAlwaysPrepared
                          ? "rgba(196,181,253,0.28)"
                          : isPrepared
                            ? accentColor
                            : preparedLocked ? "rgba(255,255,255,0.05)" : "transparent",
                      opacity: preparedLocked ? 0.65 : 1,
                      flexShrink: 0,
                    }}
                  />

                  {/* Name + meta */}
                  <div style={{ minWidth: 0 }} title={e.source ? `Source: ${e.source}` : undefined}>
                    <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: isPrepared ? C.text : C.muted }}>
                      {e.searchName}
                      {conc && <span title="Concentration" style={{ marginLeft: 5, fontSize: "var(--fs-tiny)", color: C.colorRitual }}>◆</span>}
                    </div>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
                      {[d ? `${d.level === 0 ? "Cantrip" : ORDINALS[d.level ?? 0]} ${d.school ?? ""}`.trim() : null, d?.components].filter(Boolean).join("  (") + (d?.components ? ")" : "")}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: "var(--fs-small)", color: C.muted, paddingTop: 3, textAlign: "center", minWidth: 28 }}>
                    {d ? abbrevTime(d.time ?? "—") : ""}
                  </div>

                  {/* HIT / SAVE */}
                  {d && (usesSave || usesAtk) ? (
                    <div style={{ textAlign: "center", paddingTop: 1 }}>
                      <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>
                        {usesSave ? (d.save ?? "SAVE") : "ATK"}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: "var(--fs-body)", color: spellcastingBlocked ? C.colorPinkRed : accentColor, lineHeight: 1.2 }}>
                        {usesSave ? `${entrySaveDc}${spellcastingBlocked ? " X" : ""}` : `+${entrySpellAtk}${spellcastingBlocked ? " X" : ""}`}
                      </div>
                    </div>
                  ) : <div />}

                  {/* Effect */}
                  {scaledDamage ? (
                    <div style={{
                      padding: "4px 7px", borderRadius: 6, border: `1px solid ${dmgColor}55`,
                      background: `${dmgColor}15`, textAlign: "center", whiteSpace: "nowrap",
                    }}>
                      <span style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.text }}>{scaledDamageText}</span>
                      <span style={{ fontSize: "var(--fs-small)", marginLeft: 3 }}>{DMG_EMOJI[scaledDamage.type] ?? "◆"}</span>
                    </div>
                  ) : <div />}
                </div>
              );
            })}
              </>
            )}
          </div>
        );
      })}
      </div>
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell.detail} sourceLabel={selectedSpell.source ?? null} accentColor={accentColor} onClose={() => setSelectedSpell(null)} charLevel={charLevel} maxSlotLevel={maxSpellSlotLevel} />
      )}
    </CollapsiblePanel>
    {addSpellOpen && (
      <AddSpellDrawer
        accentColor={accentColor}
        entries={entries}
        knownSpellKeys={knownSpellKeys}
        grantedSpellKeys={grantedSpellKeys}
        addSpellSourceLabel={addSpellSourceLabel}
        flexiblePreparedLimit={usesFlexiblePreparedList ? preparedLimit : 0}
        flexiblePreparedCount={usesFlexiblePreparedList ? preparedListCount : 0}
        spellSearch={spellSearch}
        onSpellSearchChange={setSpellSearch}
        spellSearchLoading={spellSearchLoading}
        spellSearchResults={spellSearchResults}
        onAddSpell={onAddSpell}
        onRemoveSpell={onRemoveSpell}
        onClose={() => { setAddSpellOpen(false); setSpellSearch(""); }}
      />
    )}
  </>
  );
}
