export function RulesetTag({ ruleset }: { ruleset: "5e" | "5.5e" }) {
  const legacy = ruleset === "5e";
  const color = legacy ? "#a78bfa" : "#38bdf8";
  return (
    <span
      title={legacy ? "D&D 5e (2014 rules)" : "D&D 5.5e (2024 rules)"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 999,
        border: `1px solid ${color}66`,
        background: `${color}18`,
        color,
        fontSize: "var(--fs-small)",
        fontWeight: 900,
        lineHeight: 1.35,
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {ruleset}
    </span>
  );
}
