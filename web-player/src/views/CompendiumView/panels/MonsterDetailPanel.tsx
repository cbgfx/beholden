import * as React from "react";
import { Panel } from "@/ui/Panel";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { formatCr } from "@/lib/monsterPicker/utils";
import { MonsterStatblock, type MonsterRecord } from "./MonsterStatblock";

export function MonsterDetailPanel(props: { monsterId: string }) {
  const [monster, setMonster] = React.useState<MonsterRecord | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setBusy(true); setError(null); setMonster(null);
    api<MonsterRecord>(`/api/compendium/monsters/${encodeURIComponent(props.monsterId)}`)
      .then((m) => { if (!cancelled) setMonster(m); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [props.monsterId]);

  const cr = monster ? formatCr(monster.cr) : null;
  const type = monster ? (monster.type?.type ?? monster.type) : null;

  return (
    <Panel
      title={monster ? monster.name : busy ? "Loading…" : "Monster"}
      actions={
        monster ? (
          <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
            {[type, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}
          </div>
        ) : null
      }
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: "auto" }}
    >
      {busy && <div style={{ color: C.muted }}>Loading…</div>}
      {error && <div style={{ color: C.red, fontSize: "var(--fs-subtitle)" }}>Error: {error}</div>}
      {!busy && !error && <MonsterStatblock monster={monster} />}
    </Panel>
  );
}
