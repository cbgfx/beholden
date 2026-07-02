import React from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { CollapsiblePanel } from "@/views/character/CharacterViewParts";
import { type InventoryItem, type ParsedItemSpell, getEquipState, parseItemSpells } from "@/views/character/CharacterInventory";
import {
  FetchedSpellDetail,
  DMG_COLORS,
  DMG_EMOJI,
  LEVEL_LABELS,
  SPELL_ROW_GRID_WITH_MARKER,
  abbrevTime,
  parseSpellDamage,
  parseSpellSave,
  spellColumnHeaderStyle,
} from "@/views/character/CharacterSpellShared";
import { SpellDrawer } from "@/views/character/CharacterSpellDrawers";

type SpellLookupRow = {
  query: string;
  match: (FetchedSpellDetail & { text?: string | null }) | null;
};

export function ItemSpellsPanel({
  items,
  pb,
  intScore,
  wisScore,
  chaScore,
  accentColor,
  onChargeChange,
  spellcastingBlocked = false,
  spellSaveDcBonus = 0,
}: {
  items: InventoryItem[];
  pb: number;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  accentColor: string;
  onChargeChange: (itemId: string, charges: number) => void;
  spellcastingBlocked?: boolean;
  spellSaveDcBonus?: number;
}) {
  const [details, setDetails] = React.useState<Record<string, FetchedSpellDetail>>({});
  const [selectedSpell, setSelectedSpell] = React.useState<FetchedSpellDetail | null>(null);
  const failedKeysRef = React.useRef<Set<string>>(new Set());

  const itemsWithSpells = React.useMemo(
    () =>
      items
        .filter((item) => getEquipState(item) !== "backpack")
        .filter((item) => !item.attunement || item.attuned)
        .map((item) => ({ item, spells: parseItemSpells(item.description ?? "") }))
        .filter(({ spells }) => spells.length > 0),
    [items]
  );

  const allKeys = React.useMemo(
    () =>
      itemsWithSpells.flatMap(({ spells }) =>
        spells.map((spell) => ({
          spellName: spell.name,
          key: spell.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
        }))
      ),
    [itemsWithSpells]
  );
  React.useEffect(() => {
    const missingByName = new Map<string, string[]>();
    for (const entry of allKeys) {
      if (details[entry.key] || failedKeysRef.current.has(entry.key)) continue;
      const list = missingByName.get(entry.spellName) ?? [];
      list.push(entry.key);
      missingByName.set(entry.spellName, list);
    }
    const missingNames = Array.from(missingByName.keys());
    if (missingNames.length === 0) return;
    let alive = true;
    api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: missingNames, includeText: true }),
    })
      .then((payload) => {
        if (!alive) return;
        const updates: Record<string, FetchedSpellDetail> = {};
        for (const row of payload.rows ?? []) {
          if (!row?.match?.id) continue;
          const query = row.query;
          const detail = row.match;
          const keys = missingByName.get(query) ?? [];
          const text = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
          const enriched: FetchedSpellDetail = {
            ...detail,
            damage: parseSpellDamage(text),
            save: parseSpellSave(text),
          };
          for (const key of keys) updates[key] = enriched;
        }
        if (Object.keys(updates).length > 0) {
          setDetails((prev) => ({ ...prev, ...updates }));
        }
      })
      .catch(() => {
        if (!alive) return;
        for (const key of missingByName.values()) {
          for (const k of key) failedKeysRef.current.add(k);
        }
      });
    return () => {
      alive = false;
    };
  }, [allKeys, details]);

  if (!itemsWithSpells.length) return null;

  const spellMod = Math.max(
    Math.floor(((intScore ?? 10) - 10) / 2),
    Math.floor(((wisScore ?? 10) - 10) / 2),
    Math.floor(((chaScore ?? 10) - 10) / 2),
  );
  const saveDc = 8 + pb + spellMod + spellSaveDcBonus;
  const spellAtk = pb + spellMod;
  const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

  return (
    <>
      {itemsWithSpells.map(({ item, spells }) => {
        const chargesMax = item.chargesMax ?? 0;
        const charges = item.charges ?? chargesMax;
        const groups = new Map<number, ParsedItemSpell[]>();

        for (const spell of spells) {
          const key = spell.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          const level = details[key]?.level ?? -1;
          if (!groups.has(level)) groups.set(level, []);
          groups.get(level)!.push(spell);
        }

        return (
          <CollapsiblePanel
            key={item.id}
            title={item.name.replace(/\s*\[.+\]$/, "")}
            color={C.colorMagic}
            storageKey={`item-spells-${item.id}`}
            actions={chargesMax > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginRight: 3 }}>charges {charges}/{chargesMax}</span>
                {Array.from({ length: chargesMax }).map((_, i) => {
                  const filled = i < charges;
                  return (
                    <button
                      key={i}
                      title={filled ? "Use charge" : "Recover charge"}
                      onClick={() => onChargeChange(item.id, i < charges ? i : i + 1)}
                      style={{
                        width: 16, height: 16, borderRadius: "50%", padding: 0, cursor: "pointer",
                        border: `2px solid ${filled ? "#ef4444" : "rgba(255,255,255,0.2)"}`,
                        background: filled ? "#ef4444" : "transparent",
                      }}
                    />
                  );
                })}
              </div>
            ) : undefined}
          >
            {spellcastingBlocked && (
              <div style={{
                marginBottom: 10, padding: "8px 10px", borderRadius: 8,
                border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.10)",
                color: "#fca5a5", fontSize: "var(--fs-small)", fontWeight: 700,
              }}>
                You can't cast spells while wearing armor or a shield without proficiency.
              </div>
            )}

            <div style={{ opacity: spellcastingBlocked ? 0.65 : 1 }}>
              {[...groups.entries()].sort(([a], [b]) => a - b).map(([level, groupSpells]) => (
                <div key={level} style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: "var(--fs-small)", fontWeight: 800, color: "#ef4444", textTransform: "uppercase",
                    letterSpacing: 1, paddingBottom: 5, borderBottom: "1px solid rgba(239,68,68,0.25)", marginBottom: 8,
                  }}>
                    {level === -1 ? (groupSpells.every((s) => failedKeysRef.current.has(s.name.toLowerCase().replace(/[^a-z0-9]/g, ""))) ? "Unknown level" : "Loading...") : LEVEL_LABELS[level] ?? `Level ${level}`}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: SPELL_ROW_GRID_WITH_MARKER, gap: "0 8px", alignItems: "end", marginBottom: 4 }}>
                    <div style={spellColumnHeaderStyle}>CST</div>
                    <div style={spellColumnHeaderStyle}>NAME</div>
                    <div style={{ ...spellColumnHeaderStyle, textAlign: "center" }}>TIME</div>
                    <div style={{ ...spellColumnHeaderStyle, textAlign: "center" }}>HIT / DC</div>
                    <div style={{ ...spellColumnHeaderStyle, textAlign: "center" }}>EFFECT</div>
                  </div>

                  {groupSpells.map((spell, i) => {
                    const key = spell.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                    const detail = details[key];
                    const dmgColor = detail?.damage ? (DMG_COLORS[detail.damage.type] ?? C.text) : null;
                    const concentration = detail ? Boolean(detail.concentration) : false;
                    const text = detail ? (Array.isArray(detail.text) ? detail.text.join(" ") : String(detail.text ?? "")) : "";
                    const usesSave = /(strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw/i.test(text);
                    const usesAtk = /spell attack/i.test(text);
                    const compactComponents = detail?.components ? detail.components.replace(/\s*\([^)]*\)/g, "").trim() : null;

                    return (
                      <div
                        key={i}
                        style={{
                          display: "grid", gridTemplateColumns: SPELL_ROW_GRID_WITH_MARKER,
                          alignItems: "center", gap: "0 8px",
                          padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                          cursor: detail ? "pointer" : "default",
                        }}
                        onClick={() => { if (detail) setSelectedSpell(detail); }}
                      >
                        <div title={`${spell.cost} charge${spell.cost !== 1 ? "s" : ""}`} style={{
                          width: 20, height: 20, borderRadius: "50%",
                          background: "#dc2626", display: "grid", placeItems: "center", flexShrink: 0,
                        }}>
                          <span style={{ color: "#fff", fontSize: "var(--fs-tiny)", fontWeight: 900, lineHeight: 1 }}>{spell.cost}</span>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.text }}>
                            {spell.name}
                            {concentration && <span title="Concentration" style={{ marginLeft: 5, fontSize: "var(--fs-tiny)", color: C.colorRitual }}>◆</span>}
                          </div>
                          <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
                            {detail ? `${detail.level === 0 ? "Cantrip" : ordinals[detail.level ?? 0] ?? ""} ${detail.school ?? ""}`.trim() : ""}
                            {compactComponents ? ` (${compactComponents})` : ""}
                          </div>
                        </div>

                        <div style={{ minWidth: 0, fontSize: "var(--fs-small)", color: C.muted, textAlign: "center", lineHeight: 1.25 }}>
                          {detail ? abbrevTime(detail.time ?? "-") : ""}
                        </div>

                        {detail && (usesSave || usesAtk) ? (
                          <div style={{ minWidth: 0, textAlign: "center" }}>
                            <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>{usesSave ? (detail.save ?? "SAVE") : "ATK"}</div>
                            <div style={{ fontWeight: 900, fontSize: "var(--fs-body)", color: spellcastingBlocked ? C.colorPinkRed : accentColor, lineHeight: 1.2 }}>
                              {usesSave ? `${saveDc}${spellcastingBlocked ? " X" : ""}` : `+${spellAtk}${spellcastingBlocked ? " X" : ""}`}
                            </div>
                          </div>
                        ) : <div />}

                        {detail?.damage ? (
                          <div style={{
                            minWidth: 0,
                            padding: "4px 7px", borderRadius: 6, border: `1px solid ${dmgColor}55`,
                            background: `${dmgColor}15`, textAlign: "center", whiteSpace: "nowrap",
                          }}>
                            <span style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.text }}>{detail.damage.dice}</span>
                            <span style={{ fontSize: "var(--fs-small)", marginLeft: 3 }}>{DMG_EMOJI[detail.damage.type] ?? "◆"}</span>
                          </div>
                        ) : <div />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        );
      })}
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell} onClose={() => setSelectedSpell(null)} />
      )}
    </>
  );
}
