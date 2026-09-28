import { useUiTranslation } from "../../i18n/useUiTranslation";
import { formatCr } from "../../domain/monsters";
import { MonsterStatblock } from "../statblock/MonsterStatblock";
import { useCompendiumHost, type Ruleset } from "./CompendiumHost";
import { COMPENDIUM_COLORS as C } from "./compendiumStyle";
import { entryPath, useCompendiumEntry } from "./useCompendiumEntry";

type MonsterDetailRecord = Record<string, unknown> & { name?: string; cr?: unknown; typeFull?: string | null; typeKey?: string | null };

export function MonsterDetail(props: { monsterId: string; ruleset?: Ruleset | null }) {
  const translateUi = useUiTranslation("sharedUi");
  const { Panel, revision } = useCompendiumHost();
  const { data: monster, busy, error } = useCompendiumEntry<MonsterDetailRecord>(entryPath("/api/compendium/monsters", props.monsterId, props.ruleset), revision);

  const cr = monster ? formatCr(monster.cr) : null;
  const type = monster?.typeFull || monster?.typeKey || null;

  return (
    <Panel
      title={monster ? String(monster.name ?? "") : busy ? translateUi("Loading...") : translateUi("Monster")}
      actions={monster ? <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{[type, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}</div> : null}
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, minHeight: 0, overflow: "auto" }}
    >
      {busy && <div style={{ color: C.muted }}>{translateUi("Loading...")}</div>}
      {error && <div style={{ color: C.red, fontSize: "var(--fs-subtitle)" }}>{translateUi("Could not load this monster: {{value1}}", { value1: error })}</div>}
      {!busy && !error && <MonsterStatblock monster={monster} hideSummary />}
    </Panel>
  );
}
