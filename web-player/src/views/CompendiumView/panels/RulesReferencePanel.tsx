import React from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { MiniTable, RulesSectionBox } from "@beholden/shared/ui";
import { useRulesReference } from "@beholden/shared/i18n/useRulesReference";

export function RulesReferencePanel() {
  const { CONDITIONS, SIGHT_TYPES, SCHOOLS_OF_MAGIC, EXHAUSTION_2024, TRAVEL_PACE, LIFESTYLE, FOOD_LODGING } = useRulesReference();
  const { t } = useTranslation();
  const sections = React.useMemo(() => [
    {
      id: "conditions", title: t("compendiumView.rulesConditions"),
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={[t("compendiumView.rulesColCondition"), t("compendiumView.rulesColDefinition")]} rows={CONDITIONS.map((c) => [c.name, c.bullets.join(" • ")])} />
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{t("compendiumView.rulesConditionsNote")}</div>
        </div>
      ),
    },
    {
      id: "sights", title: t("compendiumView.rulesSightTypes"),
      body: <MiniTable cols={[t("compendiumView.rulesColSense"), t("compendiumView.rulesColRange"), t("compendiumView.rulesColNotes")]} rows={SIGHT_TYPES.map((s) => [s.name, s.range, s.bullets.join(" • ")])} />,
    },
    {
      id: "schools", title: t("compendiumView.rulesSchoolsOfMagic"),
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={[t("compendiumView.rulesColSchool"), t("compendiumView.rulesColDefinition")]} rows={SCHOOLS_OF_MAGIC.map((s) => [s.name, s.bullets.join(" ")])} />
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
            {t("compendiumView.rulesExamplesLabel")} {SCHOOLS_OF_MAGIC.map((s) => `${s.name}: ${s.examples.slice(0, 2).join(", ")}`).join(" • ")}
          </div>
        </div>
      ),
    },
    {
      id: "exhaustion", title: t("compendiumView.rulesExhaustion"),
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={[t("compendiumView.rulesColLevel"), t("compendiumView.rulesColEffect")]} rows={EXHAUSTION_2024.map((e) => [e.level, e.effect])} />
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
            {t("compendiumView.rulesExhaustionNote")}
          </div>
        </div>
      ),
    },
    {
      id: "travel", title: t("compendiumView.rulesTravelPace"),
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={[t("compendiumView.rulesColPace"), t("compendiumView.rulesColMiHr"), t("compendiumView.rulesColMiDay"), t("compendiumView.rulesColNotes")]} rows={TRAVEL_PACE.map((r) => [r.pace, r.mph, r.perDay, r.notes || "—"])} />
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{t("compendiumView.rulesTravelNote")}</div>
        </div>
      ),
    },
    {
      id: "expenses", title: t("compendiumView.rulesExpenses"),
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{t("compendiumView.rulesExpensesNote")}</div>
          <div style={{ fontWeight: 900 }}>{t("compendiumView.rulesLifestylePerDay")}</div>
          <MiniTable cols={[t("compendiumView.rulesColLifestyle"), t("compendiumView.rulesColCost")]} rows={LIFESTYLE.map((r) => [r.name, r.cost])} />
          <div style={{ fontWeight: 900 }}>{t("compendiumView.rulesFoodDrinkLodging")}</div>
          <MiniTable cols={[t("compendiumView.rulesColItem"), t("compendiumView.rulesColCost")]} rows={FOOD_LODGING.map((r) => [r.item, r.cost])} />
        </div>
      ),
    },
  ], [CONDITIONS, EXHAUSTION_2024, FOOD_LODGING, LIFESTYLE, SCHOOLS_OF_MAGIC, SIGHT_TYPES, TRAVEL_PACE, t]);

  return (
    <Panel
      title={t("compendiumView.rulesReferenceTitle")}
      style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0 }}
    >
      <div style={{ height: "100%", overflow: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 2 }}>
        {sections.map((s) => (
          <RulesSectionBox key={s.id} title={s.title}>{s.body}</RulesSectionBox>
        ))}
      </div>
    </Panel>
  );
}
