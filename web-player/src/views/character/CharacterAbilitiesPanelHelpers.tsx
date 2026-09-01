import { C } from "@/lib/theme";

export function getModifierState(hasAdvantage: boolean, hasDisadvantage: boolean): "advantage" | "disadvantage" | null {
  if (hasAdvantage === hasDisadvantage) return null;
  return hasAdvantage ? "advantage" : "disadvantage";
}

export function StateBadge({
  state,
  accentColor,
  title,
}: {
  state: "advantage" | "disadvantage" | null;
  accentColor: string;
  title: string;
}) {
  if (!state) return null;
  const positive = state === "advantage";
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 18,
        height: 18,
        borderRadius: 999,
        border: `1px solid ${positive ? accentColor + "88" : "rgba(248,113,113,0.55)"}`,
        background: positive ? accentColor + "1f" : "rgba(248,113,113,0.14)",
        color: positive ? accentColor : C.colorPinkRed,
        fontSize: "var(--fs-small)",
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {positive ? "A" : "D"}
    </span>
  );
}
