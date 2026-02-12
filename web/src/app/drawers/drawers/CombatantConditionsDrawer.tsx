import React from "react";
import { Button } from "@/components/ui/Button";
import { api, jsonInit } from "@/app/services/api";
import { theme } from "@/app/theme/theme";
import { useStore, type DrawerState } from "@/app/store";
import type { DrawerContent } from "@/app/drawers/types";
import { CONDITION_DEFS } from "@/app/drawers/drawers/combatant/conditions";
import { conditionIconByKey } from "@/components/icons/conditions";
import { Select } from "@/components/ui/Select";

type ConditionsDrawerState = Exclude<Extract<DrawerState, { type: "combatantConditions" }>, null>;

type ConditionInstance = { key: string; casterId?: string | null };


export function CombatantConditionsDrawer(props: {
  drawer: ConditionsDrawerState;
  close: () => void;
  refreshEncounter: (eid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [conds, setConds] = React.useState<ConditionInstance[]>([]);

  const combatant = React.useMemo(
    () => state.combatants.find((x) => x.id === props.drawer.combatantId),
    [props.drawer.combatantId, state.combatants]
  );

  React.useEffect(() => {
    const c: any = combatant;
    if (!c) {
      setConds([]);
      return;
    }
    const raw = Array.isArray(c.conditions) ? (c.conditions as any[]) : [];
    setConds(raw.map((x) => ({ key: String(x.key ?? x), casterId: x.casterId ?? null })));
  }, [combatant]);

  const allowedKeys = React.useMemo(() => {
    if (props.drawer.role === "active") return new Set<string>(["concentration", "invisible"]);
    const s = new Set(CONDITION_DEFS.map((c) => c.key));
    s.delete("concentration");
    return s;
  }, [props.drawer.role]);

  const toggle = React.useCallback(
    (key: string) => {
      setConds((prev) => {
        const idx = prev.findIndex((c) => c.key === key);
        if (idx >= 0) {
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        }
        return [...prev, { key }];
      });
    },
    [setConds]
  );

  const addCasterCondition = React.useCallback(
    (key: string) => {
      const defaultCaster = props.drawer.activeIdForCaster ?? null;
      setConds((prev) => [...prev, { key, casterId: defaultCaster }]);
    },
    [props.drawer.activeIdForCaster]
  );

  const setCasterForIndex = React.useCallback((idx: number, casterId: string | null) => {
    setConds((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], casterId };
      return next;
    });
  }, []);

  const removeAt = React.useCallback((idx: number) => {
    setConds((prev) => {
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });
  }, []);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    const next = conds.map((c) => ({ key: c.key, casterId: c.casterId ?? null }));
    await api(`/api/encounters/${d.encounterId}/combatants/${d.combatantId}`, jsonInit("PUT", { conditions: next }));
    await props.refreshEncounter(d.encounterId);
    props.close();
  }, [conds, props]);

  const selectedKeys = new Set(conds.map((c) => c.key));

  return {
    body: (
      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 8 }}>Toggle conditions</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CONDITION_DEFS.filter((c) => allowedKeys.has(c.key)).map((c) => {
              const on = selectedKeys.has(c.key);
              const needsCaster = Boolean(c.needsCaster);
              const CondIcon = conditionIconByKey[c.key];
              return (
                <Button
                  key={c.key}
                  variant={on ? "primary" : "ghost"}
                  onClick={() => (needsCaster && !on ? addCasterCondition(c.key) : toggle(c.key))}
                  style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-pill)" }}
                >
                  {CondIcon ? <CondIcon size={16} title={c.name} style={{ opacity: 0.95 }} /> : null}
                  {c.name}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 8 }}>Applied</div>
          {conds.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {conds.map((c, idx) => {
                const def = CONDITION_DEFS.find((x) => x.key === c.key);
                const needsCaster = Boolean(def?.needsCaster);
                const CondIcon = conditionIconByKey[c.key];
                const casterLabel = c.casterId
                  ? state.combatants.find((x) => x.id === c.casterId)?.label ?? "Caster"
                  : "—";
                return (
                  <div
                    key={`${c.key}_${idx}`}
                    style={{
                      display: "grid",
                      gridTemplateColumns: needsCaster ? "1fr 1fr auto" : "1fr auto",
                      gap: 8,
                      alignItems: "center"
                    }}
                  >
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: theme.colors.text, fontWeight: 800, fontSize: "var(--fs-pill)" }}>
                      {CondIcon ? <CondIcon size={16} title={def?.name ?? c.key} style={{ opacity: 0.95 }} /> : null}
                      <span>{def?.name ?? c.key}</span>
                    </div>

          <Select value={c.casterId ?? ""} onChange={(e) => setCasterForIndex(idx, (e.target as any).value || null)} style={{ width: "100%" }}>
                        <option value="">— caster —</option>
                        {state.combatants.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {String(r.name || r.label || "Combatant")}
                          </option>
                        ))}
                      </Select>
                    <Button variant="ghost" onClick={() => removeAt(idx)} title={needsCaster ? `Remove (caster: ${casterLabel})` : "Remove"}>
                      ✕
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: theme.colors.muted }}>No conditions.</div>
          )}
        </div>
      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={props.close}>
          Cancel
        </Button>
        <Button onClick={submit}>Save</Button>
      </div>
    )
  };
}