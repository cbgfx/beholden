import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { MiniTable, RulesSectionBox } from "@beholden/shared/ui";
import { useRulesReference } from "@beholden/shared/i18n/useRulesReference";

type Section = { id: string; title: string; body: React.ReactNode };

export function RulesReferencePanel() {
  const { CONDITIONS, SIGHT_TYPES, SCHOOLS_OF_MAGIC, EXHAUSTION_2024, TRAVEL_PACE, LIFESTYLE, FOOD_LODGING } = useRulesReference();
  const translateUi = useUiTranslation("dmUi");
  const sections: Section[] = React.useMemo(
    () => [
      {
        id: "conditions",
        title: translateUi("Conditions"),
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MiniTable
              cols={["Condition", "Definition"]}
              rows={CONDITIONS.map((c) => [c.name, c.bullets.join(" • ")])}
            />
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {translateUi("Note: This is a quick reference for play speed, not full rules text.")}
            </div>
          </div>
        ),
      },
      {
        id: "sights",
        title: translateUi("Sight Types"),
        body: (
          <MiniTable
            cols={["Sense", "Range", "Notes"]}
            rows={SIGHT_TYPES.map((s) => [s.name, s.range, s.bullets.join(" • ")])}
          />
        ),
      },
      {
        id: "schools",
        title: translateUi("Schools of Magic"),
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MiniTable
              cols={["School", "Definition"]}
              rows={SCHOOLS_OF_MAGIC.map((s) => [s.name, s.bullets.join(" ")])}
            />
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {translateUi("Examples are for quick vibes:")} {SCHOOLS_OF_MAGIC.map((s) => `${s.name}: ${s.examples.slice(0, 2).join(", ")}`).join(" • ")}
            </div>
          </div>
        ),
      },
      {
        id: "exhaustion",
        title: translateUi("Exhaustion (2024 PHB)"),
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MiniTable
              cols={["Level", "Effect"]}
              rows={EXHAUSTION_2024.map((e) => [e.level, e.effect])}
            />
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {translateUi("This is the updated exhaustion rules from the 2024 PHB. The main change is that exhaustion now imposes a flat penalty to all d20 rolls, rather than specific mechanical effects at each level.")}
            </div>
          </div>
        ),
      },
      {
        id: "travel",
        title: translateUi("Travel Pace"),
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MiniTable
              cols={["Pace", "Miles / Hour", "Miles / Day", "Notes"]}
              rows={TRAVEL_PACE.map((r) => [r.pace, r.mph, r.perDay, r.notes || "—"])}
            />
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {translateUi("Tip: This is for overland travel. Difficult terrain and mounts can change outcomes.")}
            </div>
          </div>
        ),
      },
      {
        id: "expenses",
        title: translateUi("Expenses"),
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: theme.colors.muted, lineHeight: 1.35 }}>
              {translateUi("Quick ref tables for common costs. (Roll20 links: Lifestyle Expenses, Food/Drink/Lodging)")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>{translateUi("Lifestyle (per day)")}</div>
              <MiniTable cols={["Lifestyle", "Cost"]} rows={LIFESTYLE.map((r) => [r.name, r.cost])} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>{translateUi("Food, drink, and lodging")}</div>
              <MiniTable cols={["Item", "Cost"]} rows={FOOD_LODGING.map((r) => [r.item, r.cost])} />
            </div>
          </div>
        ),
      },
    ],
    [CONDITIONS, EXHAUSTION_2024, FOOD_LODGING, LIFESTYLE, SCHOOLS_OF_MAGIC, SIGHT_TYPES, TRAVEL_PACE, translateUi]
  );

  return (
    <Panel
      title={translateUi("Rules Reference")}
      style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0 }}
    >
      <div
        style={{
          height: "100%",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          paddingBottom: 2,
        }}
      >
        {sections.map((s) => (
          <RulesSectionBox key={s.id} title={s.title}>
            {s.body}
          </RulesSectionBox>
        ))}
      </div>
    </Panel>
  );
}
