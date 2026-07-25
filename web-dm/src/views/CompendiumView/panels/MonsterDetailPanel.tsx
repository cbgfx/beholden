import * as React from "react";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { api } from "@/services/api";
import type { MonsterDetail } from "@/domain/types/compendium";
import { MonsterStatblock } from "@/views/CampaignView/monsterPicker/statblock/MonsterStatblock";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";

export function MonsterDetailPanel(props: { monsterId: string }) {
  const [monster, setMonster] = React.useState<MonsterDetail | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    setMonster(null);
    api<MonsterDetail>(`/api/compendium/monsters/${encodeURIComponent(props.monsterId)}`)
      .then((m) => { if (!cancelled) setMonster(m); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [props.monsterId]);

  const cr = monster ? formatCr(monster.cr) : null;
  const type = monster ? (monster.type as any)?.type ?? monster.type : null;

  return (
    <Panel
      title={monster ? monster.name : busy ? "Loading…" : "Monster"}
      actions={
        monster ? (
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            {[type, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}
          </div>
        ) : null
      }
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: "auto" }}
    >
      {busy && <div style={{ color: theme.colors.muted }}>Loading…</div>}

      {error && (
        <div style={{ color: theme.colors.red, fontSize: "var(--fs-subtitle)" }}>Error: {error}</div>
      )}

      {!busy && !error && (
        <MonsterStatblock monster={monster} hideSummary={true} />
      )}
    </Panel>
  );
}
