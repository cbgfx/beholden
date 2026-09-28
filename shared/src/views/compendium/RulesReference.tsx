import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { useRulesReference } from "../../i18n/useRulesReference";
import { MiniTable } from "../../ui/MiniTable";
import { RulesSectionBox } from "../../ui/RulesSectionBox";
import { useCompendiumHost } from "./CompendiumHost";
import { COMPENDIUM_COLORS as C } from "./compendiumStyle";

function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.35 }}>{children}</div>;
}

/** Quick-reference tables for play: conditions, senses, schools, exhaustion, travel and costs. */
export function RulesReference() {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel } = useCompendiumHost();
  const { CONDITIONS, SIGHT_TYPES, SCHOOLS_OF_MAGIC, EXHAUSTION_2024, TRAVEL_PACE, LIFESTYLE, FOOD_LODGING } = useRulesReference();

  const sections = [
    {
      id: "conditions",
      title: translateUi("Conditions"),
      body: (
        <>
          <MiniTable cols={[translateUi("Condition"), translateUi("Definition")]} rows={CONDITIONS.map((c) => [c.name, c.bullets.join(" • ")])} />
          <Note>{translateUi("Note: This is a quick reference for play speed, not full rules text.")}</Note>
        </>
      ),
    },
    {
      id: "sights",
      title: translateUi("Sight Types"),
      body: <MiniTable cols={[translateUi("Sense"), translateUi("Range"), translateUi("Notes")]} rows={SIGHT_TYPES.map((s) => [s.name, s.range, s.bullets.join(" • ")])} />,
    },
    {
      id: "schools",
      title: translateUi("Schools of Magic"),
      body: (
        <>
          <MiniTable cols={[translateUi("School"), translateUi("Definition")]} rows={SCHOOLS_OF_MAGIC.map((s) => [s.name, s.bullets.join(" ")])} />
          <Note>
            {translateUi("Examples are for quick vibes:")} {SCHOOLS_OF_MAGIC.map((s) => `${s.name}: ${s.examples.slice(0, 2).join(", ")}`).join(" • ")}
          </Note>
        </>
      ),
    },
    {
      id: "exhaustion",
      title: translateUi("Exhaustion (2024 PHB)"),
      body: (
        <>
          <MiniTable cols={[translateUi("Level"), translateUi("Effect")]} rows={EXHAUSTION_2024.map((e) => [e.level, e.effect])} />
          <Note>{translateUi("This is the updated exhaustion rules from the 2024 PHB. The main change is that exhaustion now imposes a flat penalty to all d20 rolls, rather than specific mechanical effects at each level.")}</Note>
        </>
      ),
    },
    {
      id: "travel",
      title: translateUi("Travel Pace"),
      body: (
        <>
          <MiniTable
            cols={[translateUi("Pace"), translateUi("Miles / Hour"), translateUi("Miles / Day"), translateUi("Notes")]}
            rows={TRAVEL_PACE.map((r) => [r.pace, r.mph, r.perDay, r.notes || "—"])}
          />
          <Note>{translateUi("Tip: This is for overland travel. Difficult terrain and mounts can change outcomes.")}</Note>
        </>
      ),
    },
    {
      id: "expenses",
      title: translateUi("Expenses"),
      body: (
        <>
          <Note>{translateUi("Quick ref tables for common costs. (Roll20 links: Lifestyle Expenses, Food/Drink/Lodging)")}</Note>
          <div style={{ fontWeight: 900 }}>{translateUi("Lifestyle (per day)")}</div>
          <MiniTable cols={[translateUi("Lifestyle"), translateUi("Cost")]} rows={LIFESTYLE.map((r) => [r.name, r.cost])} />
          <div style={{ fontWeight: 900 }}>{translateUi("Food, drink, and lodging")}</div>
          <MiniTable cols={[translateUi("Item"), translateUi("Cost")]} rows={FOOD_LODGING.map((r) => [r.item, r.cost])} />
        </>
      ),
    },
  ];

  return (
    <Panel
      title={translateUi("Rules Reference")}
      style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ flex: 1, minHeight: 0 }}
    >
      <div style={{ height: "100%", overflow: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 2 }}>
        {sections.map((section) => (
          <RulesSectionBox key={section.id} title={section.title}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{section.body}</div>
          </RulesSectionBox>
        ))}
      </div>
    </Panel>
  );
}
