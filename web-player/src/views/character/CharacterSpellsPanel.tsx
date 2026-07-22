import React from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { CollapsiblePanel, panelHeaderAddBtn } from "@/views/character/CharacterViewParts";
import type { GrantedSpellCast, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import type { ClassRestDetail } from "@/views/character/SpellSlotsPanel";
import { normalizeAbilityKey, normalizeSpellTrackingKey, normalizeSpellTrackingName } from "@/views/character/CharacterSheetUtils";
import { AddSpellDrawer, SpellDrawer } from "@/views/character/CharacterSpellDrawers";
import {
  type FetchedSpellDetail,
  DMG_COLORS,
  LEVEL_LABELS,
  getScaledSpellDamage,
  highestAvailableSlotLevel,
  spellSectionArrow,
  spellSectionHeaderBtn,
  SPELL_ROW_GRID,
  SPELL_ROW_GRID_WITH_MARKER,
  spellColumnHeaderStyle,
} from "@/views/character/CharacterSpellShared";
import { CharacterSpellsGrantedSection } from "@/views/character/CharacterSpellsGrantedSection";
import { CharacterSpellRow } from "@/views/character/CharacterSpellRow";
import type { MulticlassSpellSlotState } from "@/domain/character/multiclassSpellcasting";

type SpellLookupRow = {
  query: string;
  match: (FetchedSpellDetail & { text?: string | null }) | null;
};

function enrichSpellDetail(detail: FetchedSpellDetail): FetchedSpellDetail {
  return detail;
}

// ---------------------------------------------------------------------------
// RichSpellsPanel
// ---------------------------------------------------------------------------

export function RichSpellsPanel({ spells, grantedSpells = [], resources = [], pb, scores, accentColor, classDetail, spellSlotState, classSpellcastingStates = [], charLevel, preparedLimit = 0, usesFlexiblePreparedList = false, usedSpellSlots, preparedSpells, onSlotsChange, onPreparedChange, onAddSpell, onRemoveSpell, addSpellSourceLabel, onResourceChange, spellcastingBlocked = false, spellDamageBonuses = {}, spellSaveDcBonus = 0 }: {
  spells: { name: string; source: string; id?: string; ability?: "str" | "dex" | "con" | "int" | "wis" | "cha" | null }[];
  grantedSpells?: GrantedSpellCast[];
  resources?: ResourceCounter[];
  pb: number;
  scores: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number | null>;
  accentColor: string;
  classDetail: ClassRestDetail | null;
  spellSlotState?: MulticlassSpellSlotState;
  classSpellcastingStates?: Array<{ classEntryId: string; className: string; classLevel: number; ability: "str" | "dex" | "con" | "int" | "wis" | "cha" | null; saveDc: number | null; attackBonus: number | null; preparedLimit: number; preparedSpells: string[]; pactMagic: boolean }>;
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
  spellSaveDcBonus?: number;
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

      const unresolvedNames = Array.from(unresolvedByName.keys());
      const directIds = directEntries
        .map((entry) => String(entry.spellId ?? "").trim())
        .filter(Boolean);
      if (directIds.length > 0 || unresolvedNames.length > 0) {
        try {
          const payload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: directIds, names: unresolvedNames, includeText: true }),
          });
          const byQuery = new Map(
            (payload.rows ?? [])
              .filter((row): row is SpellLookupRow => Boolean(row?.query))
              .map((row) => [row.query, row.match] as const),
          );
          for (const entry of directEntries) {
            const id = String(entry.spellId ?? "").trim();
            const detail = id ? byQuery.get(id) : null;
            if (!detail) continue;
            updates[entry.key] = enrichSpellDetail(detail);
          }
          for (const [query, groupedEntries] of unresolvedByName.entries()) {
            const detail = byQuery.get(query);
            if (!detail) continue;
            const enriched = enrichSpellDetail(detail);
            for (const entry of groupedEntries) updates[entry.key] = enriched;
          }
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
  }, [details, entries, specialGrantedEntries]);

  function abilityModFor(key: "str" | "dex" | "con" | "int" | "wis" | "cha" | null | undefined): number {
    const score = key ? scores[key] : null;
    return Math.floor((((score ?? 10) as number) - 10) / 2);
  }
  const classSpellAbility = normalizeAbilityKey(classDetail?.spellAbility);
  const fallbackMentalAbilities = ["int", "wis", "cha"] as const;
  const fallbackSpellAbility = fallbackMentalAbilities.reduce((best, ability) =>
    abilityModFor(ability) > abilityModFor(best) ? ability : best
  );
  const spellAbility = classSpellAbility ?? fallbackSpellAbility;
  const spellMod = abilityModFor(spellAbility);
  const spellAbilLabel = spellAbility.toUpperCase();
  const saveDc = 8 + pb + spellMod + spellSaveDcBonus;
  const spellAtk = pb + spellMod;

  // Spell slots for current level
  const levelSlots = spellSlotState ? spellSlotState.sharedSlots : classDetail?.autolevels?.find((al) => al.level === charLevel)?.slots ?? null;
  const maxPactSlotLevel = Math.max(0, ...(spellSlotState?.pactPools.map((pool) => highestAvailableSlotLevel(pool.slots)) ?? []));
  const maxSpellSlotLevel = Math.max(highestAvailableSlotLevel(levelSlots), maxPactSlotLevel);

  const isPactMagic = !spellSlotState && classDetail?.slotsReset === "S";
  const usesPreparedSpellSelection = usesFlexiblePreparedList;
  const spellRowGrid = usesFlexiblePreparedList ? SPELL_ROW_GRID_WITH_MARKER : SPELL_ROW_GRID;

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

  function togglePactSlot(poolKey: string, slots: number[], slotIndex: number) {
    const spellLevel = highestAvailableSlotLevel(slots);
    const key = `${poolKey}:${spellLevel}`;
    const max = slots[spellLevel] ?? 0;
    const used = usedSpellSlots[key] ?? 0;
    const remaining = Math.max(0, max - used);
    const next = slotIndex < remaining ? Math.max(0, max - slotIndex) : Math.max(0, max - (slotIndex + 1));
    void onSlotsChange({ ...usedSpellSlots, [key]: next });
  }

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
    api<Array<FetchedSpellDetail & { text?: string | null }>>(`/api/spells/search?q=${encodeURIComponent(query)}&limit=20&lite=1&includeText=1&excludeSpecial=1`)
      .then((results) => {
        if (!alive) return;
        setSpellSearchResults(
          (Array.isArray(results) ? results : []).map((entry) => enrichSpellDetail(entry)),
        );
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
      {classSpellcastingStates.length > 1 ? (
        <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
          {classSpellcastingStates.map((state) => (
            <div key={state.classEntryId} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) repeat(3, auto)", gap: 12, alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ minWidth: 0, color: accentColor, fontWeight: 800 }}>{state.className} {state.classLevel}{state.pactMagic ? " · Pact Magic" : ""}</span>
              <span style={{ color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 800 }}>{state.ability?.toUpperCase() ?? "—"}</span>
              <span style={{ color: spellcastingBlocked ? C.colorPinkRed : C.text, fontSize: "var(--fs-small)", fontWeight: 800 }}>DC {state.saveDc == null ? "—" : state.saveDc + spellSaveDcBonus}{spellcastingBlocked ? " X" : ""}</span>
              <span style={{ color: spellcastingBlocked ? C.colorPinkRed : C.text, fontSize: "var(--fs-small)", fontWeight: 800 }}>ATK {state.attackBonus == null ? "—" : `${state.attackBonus >= 0 ? "+" : ""}${state.attackBonus}`}{spellcastingBlocked ? " X" : ""}</span>
              {state.preparedLimit > 0 && <span style={{ gridColumn: "1 / -1", color: C.muted, fontSize: "var(--fs-tiny)" }}>Prepared: {Math.min(state.preparedSpells.length, state.preparedLimit)} / {state.preparedLimit}</span>}
            </div>
          ))}
        </div>
      ) : <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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
      </div>}
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
      {isPactMagic && maxSpellSlotLevel > 0 && (
        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, marginBottom: 12 }}>
          Pact Magic: cast Warlock spells using level {maxSpellSlotLevel} slots.
        </div>
      )}
      {spellSlotState?.pactPools.map((pool) => {
        const level = highestAvailableSlotLevel(pool.slots);
        const max = pool.slots[level] ?? 0;
        const key = `${pool.key}:${level}`;
        const remaining = Math.max(0, max - (usedSpellSlots[key] ?? 0));
        return max > 0 ? (
          <div key={pool.key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 700 }}>
            <span>{pool.className} Pact Magic · level {level} · {remaining}/{max}</span>
            {Array.from({ length: max }).map((_, index) => (
              <button key={index} title={index < remaining ? "Expend Pact Magic slot" : "Regain Pact Magic slot"} onClick={() => togglePactSlot(pool.key, pool.slots, index)} style={{ width: 18, height: 18, borderRadius: "50%", padding: 0, cursor: "pointer", border: `2px solid ${index < remaining ? accentColor : "rgba(255,255,255,0.2)"}`, background: index < remaining ? accentColor : "transparent" }} />
            ))}
          </div>
        ) : null;
      })}
      {usesFlexiblePreparedList && preparedLimit > 0 && (
        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, marginBottom: 12 }}>
          Prepared spell list: {Math.min(preparedListCount, preparedLimit)} / {preparedLimit}. Always-prepared spells do not count against this limit.
        </div>
      )}

      <div style={{ opacity: spellcastingBlocked ? 0.65 : 1 }}>
        <CharacterSpellsGrantedSection
          entries={specialGrantedEntries}
          details={details}
          resources={resources}
          collapsed={Boolean(collapsedSections.granted)}
          onToggleCollapse={() => toggleSection("granted")}
          onSelectSpell={(detail, source) => setSelectedSpell({ detail, source })}
          onResourceChange={onResourceChange}
        />
      </div>

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
                {level === -1 ? "Unresolved Spells" : level === 0 ? "Cantrips" : (LEVEL_LABELS[level] ?? `Level ${level}`)}
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
            <div style={{ display: "grid", gridTemplateColumns: spellRowGrid, gap: "0 8px", alignItems: "end", marginBottom: 4 }}>
              {usesFlexiblePreparedList && <div style={spellColumnHeaderStyle}>
                {usesPreparedSpellSelection ? "PREP" : usesFlexiblePreparedList ? "LIST" : "KNOWN"}
              </div>}
              <div style={spellColumnHeaderStyle}>NAME</div>
              <div style={{ ...spellColumnHeaderStyle, textAlign: "center" }}>TIME</div>
              <div style={{ ...spellColumnHeaderStyle, textAlign: "center" }}>HIT / DC</div>
              <div style={{ ...spellColumnHeaderStyle, textAlign: "center" }}>EFFECT</div>
            </div>

            {groupEntries.map((e, i) => {
              const d = details[e.key];
              const entryAbility = e.ability ?? null;
              const entrySpellMod = entryAbility ? abilityModFor(entryAbility) : spellMod;
              // Leveled spells' rolls are slot-keyed (level 1 Healing Word has a separate row per
              // upcast level 1-9) — show the row for THIS section's slot level, not the character's
              // overall max slot level, or a 1st-level slot listing shows the 9th-level upcast roll.
              const scaledDamage = d ? getScaledSpellDamage(d, charLevel, level > 0 ? level : maxSpellSlotLevel, entrySpellMod) : null;
              const spellDamageBonus = spellDamageBonuses[e.key] ?? 0;
              const scaledDamageText = scaledDamage
                ? `${scaledDamage.dice}${spellDamageBonus === 0 ? "" : `${spellDamageBonus > 0 ? "+" : ""}${spellDamageBonus}`}`
                : null;
              const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : null;
              const entrySaveDc = 8 + pb + entrySpellMod + spellSaveDcBonus;
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
                <CharacterSpellRow
                  key={i}
                  entry={e}
                  detail={d}
                  isCantrip={isCantrip}
                  accentColor={accentColor}
                  spellRowGrid={spellRowGrid}
                  usesFlexiblePreparedList={usesFlexiblePreparedList}
                  usesPreparedSpellSelection={usesPreparedSpellSelection}
                  isPrepared={isPrepared}
                  preparedLocked={preparedLocked}
                  preparedLimit={preparedLimit}
                  entrySaveDc={entrySaveDc}
                  entrySpellAtk={entrySpellAtk}
                  scaledDamageText={scaledDamageText}
                  scaledDamageTypes={scaledDamage?.types ?? []}
                  dmgColor={dmgColor}
                  spellcastingBlocked={spellcastingBlocked}
                  onTogglePrepared={() => togglePrepared(e.key)}
                  onSelect={() => { if (d) setSelectedSpell({ detail: d, source: e.source }); }}
                />
              );
            })}
              </>
            )}
          </div>
        );
      })}
      </div>
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell.detail} sourceLabel={selectedSpell.source ?? null} onClose={() => setSelectedSpell(null)} charLevel={charLevel} maxSlotLevel={maxSpellSlotLevel} spellMod={spellMod} />
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
