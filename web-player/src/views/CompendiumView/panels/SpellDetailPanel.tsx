import React from "react";
import { useTranslation } from "react-i18next";
import { FormattedText } from "@beholden/shared/ui";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { expandSchool } from "@beholden/shared/domain/compendium/expandSchool";
import { spellLevelLabel, type CompendiumSpellDetail } from "@beholden/shared/domain/compendium/spellDetail";

export function SpellDetailPanel(props: { spellId: string; ruleset?: "5e" | "5.5e" | null }) {
  const { t } = useTranslation();
  const [spell, setSpell] = React.useState<CompendiumSpellDetail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setBusy(true); setSpell(null); setFetchError(null);
    const params = props.ruleset ? `?ruleset=${props.ruleset}` : "";
    api<CompendiumSpellDetail>(`/api/spells/${encodeURIComponent(props.spellId)}${params}`)
      .then((s) => { if (!cancelled) setSpell(s ?? null); })
      .catch((e: unknown) => { if (!cancelled) setFetchError(e instanceof Error ? e.message : t("compendiumSpells.failedToLoadSpell")); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [props.spellId, props.ruleset, t]);

  const header = spell
    ? `${spellLevelLabel(spell.level)}${spell.school ? ` • ${expandSchool(spell.school)}` : ""}`
    : busy ? t("compendiumSpells.loading") : fetchError ? t("compendiumSpells.error") : t("compendiumSpells.selectSpell");

  return (
    <Panel
      title={spell ? spell.name : t("compendiumSpells.detailFallbackTitle")}
      actions={<div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{header}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0 }}
    >
      {fetchError ? (
        <div style={{ color: C.red }}>{fetchError}</div>
      ) : !spell ? (
        <div style={{ color: C.muted }}>{t("compendiumSpells.pickSpellPrompt")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", color: C.muted, fontSize: "var(--fs-small)" }}>
            {spell.time && <span>{t("compendiumSpells.castLabel", { time: spell.time })}</span>}
            {spell.range && <span>{t("compendiumSpells.rangeLabel", { range: spell.range })}</span>}
            {spell.duration && <span>{t("compendiumSpells.durationLabel", { duration: spell.duration })}</span>}
            {spell.components && <span>{t("compendiumSpells.componentsLabel", { components: spell.components })}</span>}
          </div>
          <div style={{
            flex: 1, minHeight: 0, overflow: "auto",
            border: `1px solid ${C.panelBorder}`, borderRadius: 12,
            padding: 10, whiteSpace: "pre-wrap", lineHeight: 1.35,
          }}>
            <FormattedText text={spell.text} />
          </div>
          {spell.school && <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{t("compendiumSpells.schoolLabel", { school: expandSchool(spell.school) })}</div>}
          {spell.classes && <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{t("compendiumSpells.classesLabel", { classes: spell.classes })}</div>}
        </div>
      )}
    </Panel>
  );
}
