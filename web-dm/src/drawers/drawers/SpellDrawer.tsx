import React from "react";
import type { DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { api } from "@/services/api";
import { theme } from "@/theme/theme";
import { titleCase } from "@/lib/format/titleCase";

type SpellDrawerState = Exclude<Extract<DrawerState, { type: "viewSpell" }>, null>;

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

export function SpellDrawer(props: { drawer: SpellDrawerState; close: () => void }): DrawerContent {
  const [spell, setSpell] = React.useState<SpellFull | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      setError(null);
      try {
        const s = await api<SpellFull>(`/api/spells/${encodeURIComponent(props.drawer.spellId)}`);
        if (!cancelled) setSpell(s ?? null);
      } catch (e: any) {
        if (!cancelled) {
          setSpell(null);
          setError(String(e?.message ?? e ?? "Failed to load spell"));
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [props.drawer.spellId]);

  if (busy && !spell) {
    return { body: <div style={{ color: theme.colors.muted }}>Loading spell…</div> };
  }

  if (!spell) {
    return { body: <div style={{ color: theme.colors.muted }}>{error ?? "Spell not found."}</div> };
  }

  const metaTop = `${levelLabel(spell.level)}${spell.school ? ` • ${titleCase(String(spell.school))}` : ""}`;
  const bodyText = (spell.text ?? []).join("\n\n");

  return {
    body: (
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontSize: "var(--fs-large)", fontWeight: 900 }}>{spell.name}</div>
          <div style={{ color: theme.colors.muted, marginTop: 4 }}>{metaTop}</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: theme.colors.muted, fontSize: 12 }}>
          {spell.time ? <span>Cast: {spell.time}</span> : null}
          {spell.range ? <span>Range: {spell.range}</span> : null}
          {spell.duration ? <span>Duration: {spell.duration}</span> : null}
          {spell.components ? <span>Components: {spell.components}</span> : null}
        </div>

        <div
          className="bh-prewrap"
          style={{
            color: theme.colors.text,
            lineHeight: 1.4,
            background: theme.colors.panelBg,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
            padding: 12
          }}
        >
          {bodyText}
        </div>

        {spell.classes ? <div style={{ color: theme.colors.muted, fontSize: 12 }}>Classes: {spell.classes}</div> : null}
      </div>
    )
  };
}
