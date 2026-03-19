import React from "react";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { expandSchool } from "@/lib/format/expandSchool";

type SpellFull = {
  id: string; name: string;
  level: number | null; school: string | null;
  time: string | null; range: string | null;
  components: string | null; duration: string | null;
  classes: string | null; text: string[];
};

function levelLabel(level: number | null) {
  if (level == null) return "Level ?";
  if (level === 0) return "Cantrip";
  return `Level ${level}`;
}

export function SpellDetailPanel(props: { spellId: string }) {
  const [spell, setSpell] = React.useState<SpellFull | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setBusy(true); setSpell(null);
    api<SpellFull>(`/api/spells/${encodeURIComponent(props.spellId)}`)
      .then((s) => { if (!cancelled) setSpell(s ?? null); })
      .catch(() => { if (!cancelled) setSpell(null); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [props.spellId]);

  const header = spell
    ? `${levelLabel(spell.level)}${spell.school ? ` • ${expandSchool(spell.school)}` : ""}`
    : busy ? "Loading…" : "Select a spell";

  return (
    <Panel
      title={spell ? spell.name : "Spell"}
      actions={<div style={{ color: C.muted, fontSize: 12 }}>{header}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0 }}
    >
      {!spell ? (
        <div style={{ color: C.muted }}>Pick a spell on the left to view details.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: C.muted, fontSize: 12 }}>
            {spell.time && <span>Cast: {spell.time}</span>}
            {spell.range && <span>Range: {spell.range}</span>}
            {spell.duration && <span>Duration: {spell.duration}</span>}
            {spell.components && <span>Components: {spell.components}</span>}
          </div>
          <div style={{
            flex: 1, minHeight: 0, overflow: "auto",
            border: `1px solid ${C.panelBorder}`, borderRadius: 12,
            padding: 10, whiteSpace: "pre-wrap", lineHeight: 1.35,
          }}>
            {(spell.text ?? []).join("\n\n")}
          </div>
          {(() => {
            let raw = spell.classes ?? "";
            let schoolFromClasses: string | null = null;
            const schoolMatch = raw.match(/^School:\s*([^,]+),?\s*/i);
            if (schoolMatch) { schoolFromClasses = schoolMatch[1].trim(); raw = raw.slice(schoolMatch[0].length).trim(); }
            const schoolDisplay = spell.school
              ? expandSchool(spell.school)
              : schoolFromClasses ? expandSchool(schoolFromClasses) : null;
            return (
              <>
                {schoolDisplay && <div style={{ color: C.muted, fontSize: 12 }}>School: {schoolDisplay}</div>}
                {raw && <div style={{ color: C.muted, fontSize: 12 }}>Classes: {raw}</div>}
              </>
            );
          })()}
        </div>
      )}
    </Panel>
  );
}
