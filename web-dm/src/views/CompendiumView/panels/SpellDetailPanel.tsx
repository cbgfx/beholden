import React from "react";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { api } from "@/services/api";
import { titleCase } from "@/lib/format/titleCase";
import { expandSchool } from "@/lib/format/expandSchool";

type SpellFull = {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  classes: string | null;
  text: string[];
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
    const run = async () => {
      if (!props.spellId) {
        setSpell(null);
        return;
      }
      setBusy(true);
      try {
        const s = await api<SpellFull>(`/api/spells/${encodeURIComponent(props.spellId)}`);
        if (!cancelled) setSpell(s ?? null);
      } catch {
        if (!cancelled) setSpell(null);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [props.spellId]);

  const header = spell
    ? `${levelLabel(spell.level)}${spell.school ? ` • ${expandSchool(spell.school)}` : ""}`
    : "Select a spell";

  return (
    <Panel
      title={spell ? spell.name : "Spell"}
      actions={<div style={{ color: theme.colors.muted, fontSize: 12 }}>{busy ? "Loading…" : header}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0 }}
    >
      {!spell ? (
        <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>Pick a spell on the left to view details.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: theme.colors.muted, fontSize: 12 }}>
            {spell.time ? <span>Cast: {spell.time}</span> : null}
            {spell.range ? <span>Range: {spell.range}</span> : null}
            {spell.duration ? <span>Duration: {spell.duration}</span> : null}
            {spell.components ? <span>Components: {spell.components}</span> : null}
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: 12,
              padding: 10,
              whiteSpace: "pre-wrap",
              lineHeight: 1.35,
            }}
          >
            {(spell.text ?? []).join("\n\n")}
          </div>

          {(() => {
            // Some XML imports bake "School: Abjuration, " into the classes string.
            // Split it out so school and classes appear on separate lines.
            let raw = spell.classes ?? "";
            let schoolFromClasses: string | null = null;
            const schoolMatch = raw.match(/^School:\s*([^,]+),?\s*/i);
            if (schoolMatch) {
              schoolFromClasses = schoolMatch[1].trim();
              raw = raw.slice(schoolMatch[0].length).trim();
            }
            const schoolDisplay = spell.school
              ? expandSchool(spell.school)
              : schoolFromClasses ? expandSchool(schoolFromClasses) : null;
            return (
              <>
                {schoolDisplay && (
                  <div style={{ color: theme.colors.muted, fontSize: 12 }}>
                    School: {schoolDisplay}
                  </div>
                )}
                {raw && (
                  <div style={{ color: theme.colors.muted, fontSize: 12 }}>
                    Classes: {raw}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </Panel>
  );
}
