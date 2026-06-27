import React from "react";

import { api } from "@/services/api";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";

type FeatDetail = {
  id: string;
  name: string;
  text?: string | null;
  prerequisite?: string | null;
  ruleset?: string | null;
  parsed?: {
    category?: string | null;
    source?: string | null;
    repeatable?: boolean;
    grants?: {
      abilityIncreases?: Record<string, number>;
      skills?: string[];
      tools?: string[];
      languages?: string[];
      spells?: string[];
      cantrips?: string[];
    };
    choices?: Array<{ type: string; options?: string[] | null; count?: number; amount?: number | null }>;
  };
};

function Tag({ children, color = theme.colors.accentHighlight }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      padding: "3px 8px",
      borderRadius: 999,
      border: `1px solid ${color}55`,
      background: `${color}16`,
      color,
      fontSize: "var(--fs-small)",
      fontWeight: 750,
    }}>
      {children}
    </span>
  );
}

export function FeatDetailPanel({ featId }: { featId: string }) {
  const [feat, setFeat] = React.useState<FeatDetail | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setBusy(true);
    setFeat(null);
    api<FeatDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((data) => { if (alive) setFeat(data ?? null); })
      .catch(() => { if (alive) setFeat(null); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [featId]);

  const parsed = feat?.parsed;
  const abilityIncreases = Object.entries(parsed?.grants?.abilityIncreases ?? {})
    .map(([ability, amount]) => `${ability.toUpperCase()} +${amount}`);
  const abilityChoices = (parsed?.choices ?? [])
    .filter((choice) => choice.type === "ability_score")
    .map((choice) => `Choose ${choice.count ?? 1}: ${(choice.options ?? []).join(", ")}${choice.amount ? ` (+${choice.amount})` : ""}`);
  const grants = [
    ...(parsed?.grants?.skills ?? []).map((value) => `Skill: ${value}`),
    ...(parsed?.grants?.tools ?? []).map((value) => `Tool: ${value}`),
    ...(parsed?.grants?.languages ?? []).map((value) => `Language: ${value}`),
    ...(parsed?.grants?.spells ?? []).map((value) => `Spell: ${value}`),
    ...(parsed?.grants?.cantrips ?? []).map((value) => `Cantrip: ${value}`),
  ];

  return (
    <Panel
      title={feat?.name ?? "Feat"}
      actions={<div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{busy ? "Loading..." : parsed?.source ?? ""}</div>}
      style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      bodyStyle={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}
    >
      {!feat ? (
        <div style={{ color: theme.colors.muted }}>Select a feat to view its details.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {parsed?.category && <Tag>{parsed.category}</Tag>}
            {feat.ruleset && <Tag color={theme.colors.colorMagic}>{feat.ruleset}</Tag>}
            {parsed?.repeatable && <Tag color={theme.colors.colorGold}>Repeatable</Tag>}
            {abilityIncreases.map((value) => <Tag key={value} color={theme.colors.green}>{value}</Tag>)}
          </div>

          {feat.prerequisite && (
            <div style={{
              padding: "8px 10px",
              borderRadius: 9,
              border: `1px solid ${theme.colors.panelBorder}`,
              color: theme.colors.muted,
              fontSize: "var(--fs-small)",
            }}>
              <b style={{ color: theme.colors.text }}>Prerequisite:</b> {feat.prerequisite}
            </div>
          )}

          {(abilityChoices.length > 0 || grants.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {abilityChoices.map((value) => (
                <div key={value} style={{ color: theme.colors.green, fontSize: "var(--fs-small)", fontWeight: 700 }}>{value}</div>
              ))}
              {grants.map((value) => (
                <div key={value} style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{value}</div>
              ))}
            </div>
          )}

          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 12,
            padding: 12,
            whiteSpace: "pre-wrap",
            lineHeight: 1.55,
          }}>
            {feat.text || <span style={{ color: theme.colors.muted }}>No description available.</span>}
          </div>
        </>
      )}
    </Panel>
  );
}
