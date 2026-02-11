import React from "react";
import { FillPanel } from "./FillPanel";
import { theme } from "@/app/theme/theme";

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

function Section(props: SectionProps) {
  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, padding: 10, background: "rgba(0,0,0,0.10)" }}>
      <div style={{ fontWeight: 900, marginBottom: 8, fontSize: "var(--fs-medium)" }}>{props.title}</div>
      {props.children}
    </div>
  );
}

const CONDITIONS: Array<{ name: string; text: string }> = [
  { name: "Blinded", text: "You can't see. Attack rolls against you have Advantage; your attack rolls have Disadvantage." },
  { name: "Charmed", text: "You can't attack or target the charmer with harmful effects, and the charmer has Advantage on social checks against you." },
  { name: "Deafened", text: "You can't hear." },
  { name: "Exhaustion", text: "A stacking condition that imposes escalating penalties; removes with rest or specific magic, depending on your table." },
  { name: "Frightened", text: "Disadvantage on ability checks and attack rolls while the source is in line of sight; you can't willingly move closer." },
  { name: "Grappled", text: "Speed becomes 0. Ends if the grappler is incapacitated or you are moved away." },
  { name: "Incapacitated", text: "You can't take actions or reactions." },
  { name: "Invisible", text: "You are unseen. Attack rolls against you have Disadvantage; your attack rolls have Advantage." },
  { name: "Paralyzed", text: "Incapacitated; can't move or speak; auto-fail STR/DEX saves; attacks against you have Advantage; hits from within 5 ft are critical." },
  { name: "Petrified", text: "Turned to stone: incapacitated, can't move or speak, unaware; resistance to damage; immune to poison/disease." },
  { name: "Poisoned", text: "Disadvantage on attack rolls and ability checks." },
  { name: "Prone", text: "Only crawl unless you stand (costs movement). Melee attacks against you have Advantage; ranged attacks have Disadvantage." },
  { name: "Restrained", text: "Speed 0; attack rolls against you have Advantage; your attacks have Disadvantage; Disadvantage on DEX saves." },
  { name: "Stunned", text: "Incapacitated; can't move; can speak falteringly; auto-fail STR/DEX saves; attacks against you have Advantage." },
  { name: "Unconscious", text: "Incapacitated; can't move or speak; unaware; drop items; fall prone; auto-fail STR/DEX saves; attacks have Advantage; hits from within 5 ft are critical." }
];

const TRAVEL_PACE = [
  { pace: "Fast", milesPerHour: 4, milesPerDay: 30, effect: "-5 penalty to passive Perception." },
  { pace: "Normal", milesPerHour: 3, milesPerDay: 24, effect: "No modifier." },
  { pace: "Slow", milesPerHour: 2, milesPerDay: 18, effect: "Able to use Stealth while traveling." }
];

const EXPENSES = [
  { item: "Ale (mug)", cost: "4 cp" },
  { item: "Bread (loaf)", cost: "2 cp" },
  { item: "Cheese (wedge)", cost: "1 sp" },
  { item: "Inn stay (squalid) / day", cost: "7 cp" },
  { item: "Inn stay (poor) / day", cost: "1 sp" },
  { item: "Inn stay (modest) / day", cost: "5 sp" },
  { item: "Inn stay (comfortable) / day", cost: "8 sp" },
  { item: "Inn stay (wealthy) / day", cost: "2 gp" },
  { item: "Inn stay (aristocratic) / day", cost: "4 gp" }
];

function SimpleTable(props: { cols: string[]; rows: Array<Array<string>> }) {
  return (
    <div style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${props.cols.length}, 1fr)`, background: "rgba(0,0,0,0.18)" }}>
        {props.cols.map((c) => (
          <div key={c} style={{ padding: "8px 10px", fontWeight: 900, fontSize: "var(--fs-small)", color: theme.colors.text }}>
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
            borderTop: `1px solid ${theme.colors.panelBorder}`
          }}
        >
          {r.map((cell, i) => (
            <div key={i} style={{ padding: "8px 10px", color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function RulesReferencePanel() {
  return (
    <FillPanel title="Rules Reference">
      <div className="bh-scroll" style={{ display: "flex", flexDirection: "column", gap: 10, paddingRight: 6 }}>
        <Section title="Conditions">
          <div style={{ display: "grid", gap: 8 }}>
            {CONDITIONS.map((c) => (
              <div key={c.name} style={{ border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, padding: "8px 10px" }}>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>{c.name}</div>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", lineHeight: 1.35 }}>{c.text}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Travel Pace">
          <SimpleTable
            cols={["Pace", "Miles / Hour", "Miles / Day", "Notes"]}
            rows={TRAVEL_PACE.map((r) => [r.pace, String(r.milesPerHour), String(r.milesPerDay), r.effect])}
          />
        </Section>

        <Section title="Expenses">
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginBottom: 8, lineHeight: 1.35 }}>
            Quick references for common costs. If you want, we can expand this into lifestyle expenses + services next.
          </div>
          <SimpleTable cols={["Item", "Cost"]} rows={EXPENSES.map((e) => [e.item, e.cost])} />
        </Section>
      </div>
    </FillPanel>
  );
}
