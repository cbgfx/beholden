import React from "react";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { MiniTable } from "@/views/CompendiumView/components/MiniTable";
import { RulesSectionBox } from "@/views/CompendiumView/components/RulesSectionBox";
import {
  CONDITIONS, EXHAUSTION_2024, TRAVEL_PACE,
  LIFESTYLE, FOOD_LODGING, SCHOOLS_OF_MAGIC, SIGHT_TYPES,
} from "@/views/CompendiumView/data/rulesReference";

export function RulesReferencePanel() {
  const sections = React.useMemo(() => [
    {
      id: "conditions", title: "Conditions",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={["Condition", "Definition"]} rows={CONDITIONS.map((c) => [c.name, c.bullets.join(" • ")])} />
          <div style={{ color: C.muted, fontSize: 12 }}>Quick reference for play speed, not full rules text.</div>
        </div>
      ),
    },
    {
      id: "sights", title: "Sight Types",
      body: <MiniTable cols={["Sense", "Range", "Notes"]} rows={SIGHT_TYPES.map((s) => [s.name, s.range, s.bullets.join(" • ")])} />,
    },
    {
      id: "schools", title: "Schools of Magic",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={["School", "Definition"]} rows={SCHOOLS_OF_MAGIC.map((s) => [s.name, s.bullets.join(" ")])} />
          <div style={{ color: C.muted, fontSize: 12 }}>
            Examples: {SCHOOLS_OF_MAGIC.map((s) => `${s.name}: ${s.examples.slice(0, 2).join(", ")}`).join(" • ")}
          </div>
        </div>
      ),
    },
    {
      id: "exhaustion", title: "Exhaustion (2024 PHB)",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={["Level", "Effect"]} rows={EXHAUSTION_2024.map((e) => [e.level, e.effect])} />
          <div style={{ color: C.muted, fontSize: 12 }}>
            Flat penalty to all d20 rolls; replaces the old per-level mechanical effects.
          </div>
        </div>
      ),
    },
    {
      id: "travel", title: "Travel Pace",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniTable cols={["Pace", "Mi/hr", "Mi/day", "Notes"]} rows={TRAVEL_PACE.map((r) => [r.pace, r.mph, r.perDay, r.notes || "—"])} />
          <div style={{ color: C.muted, fontSize: 12 }}>Overland travel. Difficult terrain and mounts change outcomes.</div>
        </div>
      ),
    },
    {
      id: "expenses", title: "Expenses",
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ color: C.muted, fontSize: 12 }}>Quick ref tables for common costs.</div>
          <div style={{ fontWeight: 900 }}>Lifestyle (per day)</div>
          <MiniTable cols={["Lifestyle", "Cost"]} rows={LIFESTYLE.map((r) => [r.name, r.cost])} />
          <div style={{ fontWeight: 900 }}>Food, drink, and lodging</div>
          <MiniTable cols={["Item", "Cost"]} rows={FOOD_LODGING.map((r) => [r.item, r.cost])} />
        </div>
      ),
    },
  ], []);

  return (
    <Panel
      title="Rules Reference"
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
