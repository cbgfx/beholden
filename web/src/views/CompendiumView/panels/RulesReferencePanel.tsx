import React from "react";
import { Panel } from "@/components/ui/Panel";
import { theme } from "@/app/theme/theme";

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
};

function SectionBox(props: { title: string; children: React.ReactNode }) {
  return (
    <details
      open={false}
      style={{
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "10px 12px",
          fontWeight: 800,
          color: theme.colors.text,
          background: theme.colors.panelBg,
          userSelect: "none",
        }}
      >
        {props.title}
      </summary>
      <div style={{ padding: "10px 12px", color: theme.colors.text, lineHeight: 1.35 }}>{props.children}</div>
    </details>
  );
}

const CONDITIONS: Array<{ name: string; bullets: string[] }> = [
  {
    name: "Blinded",
    bullets: ["You can't see.", "Attack rolls against you have advantage.", "Your attack rolls have disadvantage."],
  },
  {
    name: "Charmed",
    bullets: ["You can't attack the charmer or target the charmer with harmful abilities.", "The charmer has advantage on social checks against you."],
  },
  {
    name: "Deafened",
    bullets: ["You can't hear."],
  },
  {
    name: "Frightened",
    bullets: ["You have disadvantage on ability checks and attacks while the source of fear is in line of sight.", "You can't willingly move closer to the source."],
  },
  {
    name: "Grappled",
    bullets: ["Speed becomes 0.", "Ends if the grappler is incapacitated or you are moved out of reach."],
  },
  {
    name: "Incapacitated",
    bullets: ["You can't take actions or reactions."],
  },
  {
    name: "Invisible",
    bullets: ["You are unseen without special senses or magic.", "Attack rolls against you have disadvantage.", "Your attack rolls have advantage."],
  },
  {
    name: "Paralyzed",
    bullets: ["You are incapacitated and can't move or speak.", "You automatically fail Strength and Dexterity saves.", "Attack rolls against you have advantage.", "Attacks from within 5 ft are critical hits if they hit."],
  },
  {
    name: "Petrified",
    bullets: ["You and what you're wearing/carrying become solid stone.", "You are incapacitated, can't move, and are unaware.", "You automatically fail Strength and Dexterity saves.", "You have resistance to all damage.", "You are immune to poison and disease (effects paused)."],
  },
  {
    name: "Poisoned",
    bullets: ["You have disadvantage on attacks and ability checks."],
  },
  {
    name: "Prone",
    bullets: ["Your only movement option is to crawl unless you stand up.", "Attack rolls against you have advantage within 5 ft, otherwise disadvantage.", "Your attack rolls have disadvantage."],
  },
  {
    name: "Restrained",
    bullets: ["Speed becomes 0.", "Attack rolls against you have advantage.", "Your attack rolls have disadvantage.", "You have disadvantage on Dexterity saves."],
  },
  {
    name: "Stunned",
    bullets: ["You are incapacitated, can't move, and can speak only falteringly.", "You automatically fail Strength and Dexterity saves.", "Attack rolls against you have advantage."],
  },
  {
    name: "Unconscious",
    bullets: ["You are incapacitated, can't move or speak, and are unaware.", "You drop what you're holding and fall prone.", "You automatically fail Strength and Dexterity saves.", "Attack rolls against you have advantage.", "Attacks from within 5 ft are critical hits if they hit."],
  },
];

// 2024 PHB style exhaustion (quick ref). Keep this short and table-friendly.
const EXHAUSTION_2024: Array<{ level: number; effect: string }> = Array.from({ length: 10 }).map((_, i) => {
  const lvl = i + 1;
  const penalty = lvl * 2;
  return {
    level: lvl,
    effect: lvl === 10 ? "Death" : `-${penalty} to d20 Tests` // ability checks, attack rolls, saving throws
  };
});

const TRAVEL_PACE = [
  { pace: "Slow", mph: 2, perDay: 18, notes: "Can use Stealth." },
  { pace: "Normal", mph: 3, perDay: 24, notes: "" },
  { pace: "Fast", mph: 4, perDay: 30, notes: "-5 penalty to passive Perception." },
];

const LIFESTYLE = [
  { name: "Wretched", cost: "—" },
  { name: "Squalid", cost: "1 sp" },
  { name: "Poor", cost: "2 sp" },
  { name: "Modest", cost: "1 gp" },
  { name: "Comfortable", cost: "2 gp" },
  { name: "Wealthy", cost: "4 gp" },
  { name: "Aristocratic", cost: "10 gp+" },
];

const FOOD_LODGING = [
  { item: "Ale (mug)", cost: "4 cp" },
  { item: "Bread (loaf)", cost: "2 cp" },
  { item: "Cheese (wedge)", cost: "1 sp" },
  { item: "Squalid inn stay (per day)", cost: "7 cp" },
  { item: "Poor inn stay (per day)", cost: "1 sp" },
  { item: "Modest inn stay (per day)", cost: "5 sp" },
  { item: "Comfortable inn stay (per day)", cost: "8 sp" },
  { item: "Wealthy inn stay (per day)", cost: "2 gp" },
  { item: "Aristocratic inn stay (per day)", cost: "4 gp" },
  { item: "Squalid meal", cost: "1 cp" },
  { item: "Poor meal", cost: "2 cp" },
  { item: "Modest meal", cost: "1 sp" },
  { item: "Comfortable meal", cost: "2 sp" },
  { item: "Wealthy meal", cost: "3 sp" },
  { item: "Aristocratic meal", cost: "6 sp" },
  { item: "Common wine (bottle)", cost: "2 sp" },
  { item: "Fine wine (bottle)", cost: "10 gp" },
];

function MiniTable(props: { cols: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div
      style={{
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${props.cols.length}, 1fr)`,
          background: theme.colors.panelBg,
          borderBottom: `1px solid ${theme.colors.panelBorder}`,
        }}
      >
        {props.cols.map((c) => (
          <div key={c} style={{ padding: "8px 10px", fontWeight: 800, fontSize: 12, color: theme.colors.muted }}>
            {c}
          </div>
        ))}
      </div>
      {props.rows.map((r, idx) => (
        <div
          key={idx}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${props.cols.length}, 1fr)`,
            borderBottom: idx === props.rows.length - 1 ? "none" : `1px solid ${theme.colors.panelBorder}`,
          }}
        >
          {r.map((cell, i) => (
            <div key={i} style={{ padding: "8px 10px", fontSize: 13, color: theme.colors.text }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function RulesReferencePanel() {
  const sections: Section[] = React.useMemo(
    () => [
      {
        id: "conditions",
        title: "Conditions",
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MiniTable
              cols={["Condition", "Definition"]}
              rows={CONDITIONS.map((c) => [c.name, c.bullets.join(" • ")])}
            />
            <div style={{ color: theme.colors.muted, fontSize: 12 }}>
              Note: This is a quick reference for play speed, not full rules text.
            </div>
          </div>
        ),
      },
      {
        id: "exhaustion",
        title: "Exhaustion (2024 PHB)",
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MiniTable
              cols={["Level", "Effect"]}
              rows={EXHAUSTION_2024.map((e) => [e.level, e.effect])}
            />
            <div style={{ color: theme.colors.muted, fontSize: 12 }}>
              This is the updated exhaustion rules from the 2024 PHB. The main change is that exhaustion now imposes a flat penalty to all d20 rolls, rather than specific mechanical effects at each level.
            </div>
          </div>
        ),
      },
      {
        id: "travel",
        title: "Travel Pace",
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <MiniTable
              cols={["Pace", "Miles / Hour", "Miles / Day", "Notes"]}
              rows={TRAVEL_PACE.map((r) => [r.pace, r.mph, r.perDay, r.notes || "—"])}
            />
            <div style={{ color: theme.colors.muted, fontSize: 12 }}>
              Tip: This is for overland travel. Difficult terrain and mounts can change outcomes.
            </div>
          </div>
        ),
      },
      {
        id: "expenses",
        title: "Expenses",
        body: (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: theme.colors.muted, lineHeight: 1.35 }}>
              Quick ref tables for common costs. (Roll20 links: Lifestyle Expenses, Food/Drink/Lodging)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Lifestyle (per day)</div>
              <MiniTable cols={["Lifestyle", "Cost"]} rows={LIFESTYLE.map((r) => [r.name, r.cost])} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 900 }}>Food, drink, and lodging</div>
              <MiniTable cols={["Item", "Cost"]} rows={FOOD_LODGING.map((r) => [r.item, r.cost])} />
            </div>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <Panel title="Rules Reference" style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }} bodyStyle={{ flex: 1, minHeight: 0 }}>
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
          <SectionBox key={s.id} title={s.title}>
            {s.body}
          </SectionBox>
        ))}
      </div>
    </Panel>
  );
}
