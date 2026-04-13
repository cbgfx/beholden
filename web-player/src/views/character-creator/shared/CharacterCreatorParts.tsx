import React from "react";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { inputStyle, labelStyle } from "./CharacterCreatorStyles";
import { extractPrerequisite, stripPrerequisiteLine } from "@/views/character/CharacterSheetUtils";

type ItemDetailPreview = {
  text?: string[] | string | null;
};

function btnStyle(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 22px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: disabled
      ? "rgba(255,255,255,0.06)"
      : primary
        ? C.accentHl
        : "rgba(255,255,255,0.08)",
    color: disabled ? "rgba(160,180,220,0.40)" : primary ? C.textDark : C.text,
    fontSize: "var(--fs-medium)",
    transition: "opacity 0.15s",
  };
}

export function StepHeader({ current, onStepClick }: { current: number; onStepClick: (s: number) => void }) {
  const steps = ["Class", "Species", "Background", "Ability Scores", "Level", "Skills", "Spells", "Stats", "Identity", "Assign"];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 28 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onStepClick(n)}
            style={{
              padding: "5px 13px",
              borderRadius: 20,
              background: active ? C.accentHl : done ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.06)",
              color: active ? C.textDark : done ? C.accentHl : "rgba(160,180,220,0.50)",
              fontWeight: active ? 700 : done ? 600 : 500,
              fontSize: "var(--fs-small)",
              border: `1px solid ${active ? C.accentHl : done ? "rgba(56,182,255,0.35)" : "rgba(255,255,255,0.10)"}`,
              cursor: active ? "default" : "pointer",
              transition: "opacity 0.12s, background 0.12s",
            }}
          >
            {done ? "✓ " : `${n}. `}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function NavButtons({
  step,
  onBack,
  onNext,
  nextLabel = "Next →",
  nextDisabled = false,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
      <button type="button" onClick={onBack} disabled={step === 1} style={btnStyle(false, step === 1)}>
        ← Back
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled} style={btnStyle(true, nextDisabled)}>
        {nextLabel}
      </button>
    </div>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
      {children}
    </div>
  );
}

export function SelectableCard({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "13px 15px",
        borderRadius: 10,
        textAlign: "left",
        border: `2px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
        background: selected ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
        color: C.text,
        cursor: "pointer",
        boxShadow: selected ? `0 0 0 1px ${C.accentHl}22` : "none",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)", color: selected ? C.accentHl : C.text }}>{title}</div>
      {subtitle && (
        <div style={{ color: selected ? "rgba(56,182,255,0.75)" : "rgba(160,180,220,0.6)", fontSize: "var(--fs-small)", marginTop: 3 }}>
          {subtitle}
        </div>
      )}
    </button>
  );
}

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
  const disabledIdSet = React.useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const disabledNameSet = React.useMemo(
    () => new Set((disabledNames ?? []).map((name) => name.trim().toLowerCase())),
    [disabledNames],
  );
  const filtered = q
    ? spells.filter((spell) => spell.name.toLowerCase().includes(q.toLowerCase()))
    : spells;
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
          {sourceLabel ? <span style={{ marginLeft: 8, fontSize: "var(--fs-small)", color: C.accentHl }}>{sourceLabel}</span> : null}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 240, overflowY: "auto", padding: "2px 0" }}>
            {filtered.map((spell) => {
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

export function ItemPicker<T extends { id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>({
  title,
  sourceLabel,
  items,
  chosen,
  disabledIds,
  max,
  emptyMsg,
  onToggle,
}: {
  title: string;
  sourceLabel?: string | null;
  items: T[];
  chosen: string[];
  disabledIds?: string[];
  max: number;
  emptyMsg: string;
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Record<string, ItemDetailPreview>>({});
  const disabledIdSet = React.useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const filtered = q
    ? items.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()))
    : items;
  const activeItem =
    filtered.find((item) => item.id === activeId)
    ?? items.find((item) => item.id === activeId)
    ?? (filtered[0] ?? items[0] ?? null);

  React.useEffect(() => {
    if (!activeItem) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId == null || !items.some((item) => item.id === activeId)) {
      setActiveId(activeItem.id);
    }
  }, [activeId, activeItem, items]);

  React.useEffect(() => {
    const ids = filtered
      .map((item) => item.id)
      .filter((id) => !details[id])
      .slice(0, 48);
    if (ids.length === 0) return;
    let alive = true;
    api<{ rows: Array<{ id: string; text?: string[] | null }> }>("/api/compendium/items/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, includeText: true }),
    })
      .then((result) => {
        if (!alive) return;
        const patch: Record<string, ItemDetailPreview> = {};
        for (const row of result.rows ?? []) patch[row.id] = { text: row.text ?? null };
        if (Object.keys(patch).length === 0) return;
        setDetails((prev) => ({ ...prev, ...patch }));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [details, filtered]);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ ...labelStyle, margin: 0 }}>
          {title}
          {sourceLabel ? <span style={{ marginLeft: 8, fontSize: "var(--fs-small)", color: C.accentHl }}>{sourceLabel}</span> : null}
        </div>
        <span style={{ fontSize: "var(--fs-small)", color: chosen.length >= max ? C.accentHl : C.muted }}>
          {chosen.length} / {max}
        </span>
      </div>
      {items.length === 0 ? (
        <p style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{emptyMsg}</p>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 240, overflowY: "auto", padding: "2px 0" }}>
            {filtered.map((item) => {
              const sel = chosen.includes(item.id);
              const takenElsewhere = !sel && disabledIdSet.has(item.id);
              const locked = (!sel && chosen.length >= max) || takenElsewhere;
              const active = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setActiveId(item.id);
                    onToggle(item.id);
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
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ marginTop: 4, fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1.35 }}>
                    {[item.rarity, item.type, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
                  </div>
                  {takenElsewhere && (
                    <div style={{ marginTop: 3, fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>
                      Already selected elsewhere
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {activeItem && (
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
                {activeItem.name}
              </div>
              <div style={{ marginTop: 6, fontSize: "var(--fs-small)", color: C.muted }}>
                {[activeItem.rarity, activeItem.type, activeItem.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
              </div>
              {details[activeItem.id] && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: "var(--fs-small)",
                    lineHeight: 1.55,
                    color: "rgba(191,227,255,0.82)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {Array.isArray(details[activeItem.id].text)
                    ? (details[activeItem.id].text as string[]).join("\n\n").trim()
                    : String(details[activeItem.id].text ?? "").trim()}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
