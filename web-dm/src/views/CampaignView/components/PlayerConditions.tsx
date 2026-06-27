import { theme } from "@/theme/theme";
import { conditionIconByKey } from "@/icons/conditions";
import { conditionLabel } from "@/domain/conditions";

export function PlayerConditions({
  conditions,
  concentrationSpell,
}: {
  conditions: { key: string; casterId?: string | null; hexAbility?: string }[];
  concentrationSpell?: string | null;
}) {
  if (!conditions.length) return null;
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 2 }}>
      {conditions.map((c, i) => {
        const CondIcon = conditionIconByKey[c.key as keyof typeof conditionIconByKey];
        const hexAbility = c.key === "hexed" && c.hexAbility
          ? c.hexAbility.toUpperCase()
          : null;
        const label = c.key === "concentration" && concentrationSpell
          ? concentrationSpell
          : conditionLabel(c.key);
        return (
          <span
            key={`${c.key}-${i}`}
            title={
              c.key === "concentration" && concentrationSpell
                ? `Concentration · ${concentrationSpell}`
                : `${conditionLabel(c.key)}${hexAbility ? ` · ${hexAbility}` : ""}`
            }
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 7px", borderRadius: 999,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: theme.colors.panelBg,
              fontSize: "var(--fs-tiny)", fontWeight: 900, color: theme.colors.muted,
            }}
          >
            {CondIcon ? <CondIcon size={11} /> : null}
            {label}
            {hexAbility ? (
              <span style={{
                padding: "1px 5px",
                borderRadius: 999,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.bg,
                color: theme.colors.text,
                fontSize: "var(--fs-tiny)",
                fontWeight: 900,
                letterSpacing: "0.04em",
                lineHeight: 1.2,
              }}>
                {hexAbility}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}
