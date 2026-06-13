import React from "react";
import { C } from "@/lib/theme";
import { inputStyle, labelStyle } from "./CharacterCreatorStyles";
import { extractPrerequisite, stripPrerequisiteLine } from "@/views/character/CharacterSheetUtils";

export function SpellPicker<T extends { id: string; name: string; level: number | null; text?: string | null }>({
  title,
  sourceLabel,
  spells,
  chosen,
  disabledIds,
  disabledNames,
  max,
  emptyMsg,
  onToggle,
  isAllowed,
}: {
  title: string;
  sourceLabel?: string | null;
  spells: T[];
  chosen: string[];
  disabledIds?: string[];
  disabledNames?: string[];
  max: number;
  emptyMsg: string;
  onToggle: (id: string) => void;
  isAllowed?: (spell: T) => boolean;
}) {
  const [q, setQ] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const trimmedSourceLabel = String(sourceLabel ?? "").trim();
  const disabledIdSet = React.useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const disabledNameSet = React.useMemo(
    () => new Set((disabledNames ?? []).map((name) => name.trim().toLowerCase())),
    [disabledNames],
  );
  const filtered = q
    ? spells.filter((spell) => spell.name.toLowerCase().includes(q.toLowerCase()))
    : spells;
  const groupedFiltered = React.useMemo(() => {
    const buckets = new Map<string, { label: string; sort: number; spells: T[] }>();
    for (const spell of filtered) {
      const rawLevel = typeof spell.level === "number" && Number.isFinite(spell.level) ? spell.level : null;
      const level = rawLevel == null ? null : Math.max(0, Math.floor(rawLevel));
      const key =
        level === 0 ? "cantrip"
        : level != null && level > 0 ? `level-${level}`
        : "other";
      const label =
        level === 0 ? "Cantrips"
        : level != null && level > 0 ? `Level ${level}`
        : "Other";
      const sort =
        level === 0 ? 0
        : level != null && level > 0 ? level
        : 99;
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.spells.push(spell);
      } else {
        buckets.set(key, { label, sort, spells: [spell] });
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  }, [filtered]);
  const activeSpell =
    filtered.find((spell) => spell.id === activeId)
    ?? spells.find((spell) => spell.id === activeId)
    ?? (filtered[0] ?? spells[0] ?? null);

  React.useEffect(() => {
    if (!activeSpell) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId == null || !spells.some((spell) => spell.id === activeId)) {
      setActiveId(activeSpell.id);
    }
  }, [activeId, activeSpell, spells]);
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ ...labelStyle, margin: 0 }}>
          {title}
          {trimmedSourceLabel ? <span style={{ marginLeft: 8, fontSize: "var(--fs-small)", color: C.accentHl }}>{trimmedSourceLabel}</span> : null}
        </div>
        <span style={{ fontSize: "var(--fs-small)", color: chosen.length >= max ? C.accentHl : C.muted }}>
          {chosen.length} / {max}
        </span>
      </div>
      {spells.length === 0 ? (
        <p style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{emptyMsg}</p>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
          <div style={{ maxHeight: 240, overflowY: "auto", padding: "2px 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {groupedFiltered.map((group) => (
              <div key={group.label}>
                <div style={{ fontSize: "var(--fs-tiny)", color: "rgba(160,180,220,0.68)", fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase", margin: "2px 2px 6px" }}>
                  {group.label}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {group.spells.map((spell) => {
                    const sel = chosen.includes(spell.id);
                    const takenElsewhere = !sel && (disabledIdSet.has(spell.id) || disabledNameSet.has(spell.name.trim().toLowerCase()));
                    const prerequisite = extractPrerequisite(spell.text);
                    const allowed = isAllowed ? isAllowed(spell) : true;
                    const locked = (!sel && chosen.length >= max) || !allowed || takenElsewhere;
                    const active = activeSpell?.id === spell.id;
                    return (
                      <button
                        key={spell.id}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          setActiveId(spell.id);
                          onToggle(spell.id);
                        }}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 6,
                          fontSize: "var(--fs-small)",
                          cursor: locked ? "default" : "pointer",
                          border: `1px solid ${sel || active ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: sel
                            ? "rgba(56,182,255,0.18)"
                            : active
                              ? "rgba(56,182,255,0.10)"
                              : "rgba(255,255,255,0.055)",
                          color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                          fontWeight: sel ? 700 : 400,
                          textAlign: "left",
                          minWidth: 180,
                          maxWidth: 280,
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          {spell.name}
                          {spell.level != null && spell.level > 0 ? (
                            <span style={{ color: "rgba(160,180,220,0.5)", marginLeft: 4 }}>(L{spell.level})</span>
                          ) : null}
                        </div>
                        {prerequisite && (
                          <div style={{ marginTop: 5, fontSize: "var(--fs-tiny)", lineHeight: 1.35 }}>
                            <span style={{ color: allowed ? C.colorGold : C.colorPinkRed, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                              Prerequisite
                            </span>
                            <span style={{ color: allowed ? "rgba(251,191,36,0.92)" : "#fca5a5" }}> {prerequisite}</span>
                          </div>
                        )}
                        {!allowed && prerequisite && (
                          <div style={{ marginTop: 3, fontSize: "var(--fs-tiny)", color: C.colorPinkRed, fontWeight: 700 }}>
                            Prerequisite not met
                          </div>
                        )}
                        {takenElsewhere && (
                          <div style={{ marginTop: 3, fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>
                            Already selected elsewhere
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {activeSpell && (
            <div
              style={{
                marginTop: 10,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.accentHl }}>
                {activeSpell.name}
                {activeSpell.level != null && activeSpell.level > 0 ? (
                  <span style={{ color: "rgba(160,180,220,0.65)", marginLeft: 6, fontSize: "var(--fs-small)" }}>
                    Level {activeSpell.level}
                  </span>
                ) : null}
              </div>
              {extractPrerequisite(activeSpell.text) && (
                <div style={{ marginTop: 8, fontSize: "var(--fs-small)", lineHeight: 1.45 }}>
                  <span style={{ color: C.colorGold, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Prerequisite
                  </span>
                  <span style={{ color: "rgba(251,191,36,0.92)" }}> {extractPrerequisite(activeSpell.text)}</span>
                </div>
              )}
              {stripPrerequisiteLine(activeSpell.text).replace(/Source:.*$/ms, "").trim() && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: "var(--fs-small)",
                    lineHeight: 1.55,
                    color: "rgba(191,227,255,0.82)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {stripPrerequisiteLine(activeSpell.text).replace(/Source:.*$/ms, "").trim()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
