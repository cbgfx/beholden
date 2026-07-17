import React from "react";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { api } from "@/services/api";
import { expandSchool } from "@/lib/format/expandSchool";
import { spellLevelLabel, type CompendiumSpellDetail } from "@beholden/shared/domain/compendium/spellDetail";

export function SpellDetailPanel(props: { spellId: string }) {
  const [spell, setSpell] = React.useState<CompendiumSpellDetail | null>(null);
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
        const s = await api<CompendiumSpellDetail>(`/api/spells/${encodeURIComponent(props.spellId)}`);
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
    ? `${spellLevelLabel(spell.level)}${spell.school ? ` • ${expandSchool(spell.school)}` : ""}`
    : "Select a spell";

  return (
    <Panel
      title={spell ? spell.name : "Spell"}
      actions={<div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading…" : header}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0 }}
    >
      {!spell ? (
        <div style={{ color: theme.colors.muted, lineHeight: 1.4 }}>Pick a spell on the left to view details.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
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

          {spell.school ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>School: {expandSchool(spell.school)}</div> : null}
          {spell.classes ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>Classes: {spell.classes}</div> : null}
        </div>
      )}
    </Panel>
  );
}
