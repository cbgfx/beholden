import React from "react";
import { Button } from "@/ui/Button";
import { api, jsonInit } from "@/services/api";
import { theme, withAlpha } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { CONDITION_DEFS } from "@/domain/conditions";
import { conditionIconByKey } from "@/icons/conditions";
import { Select } from "@/ui/Select";

type ConditionsDrawerState = Exclude<Extract<DrawerState, { type: "combatantConditions" }>, null>;

type ConditionInstance = { key: string; casterId?: string | null };

// Only these conditions require a caster association.
const NEEDS_CASTER_KEYS = new Set(["hexed", "marked"]);
function needsCasterForKey(key: string) {
  return NEEDS_CASTER_KEYS.has(String(key ?? "").trim().toLowerCase());
}

export function CombatantConditionsDrawer(props: {
  drawer: ConditionsDrawerState;
  close: () => void;
  refreshEncounter: (eid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [conds, setConds] = React.useState<ConditionInstance[]>([]);
  const debounceRef = React.useRef<number | null>(null);
  const skipNextCommitRef = React.useRef<boolean>(true);

  const combatant = React.useMemo(
    () => state.combatants.find((x) => x.id === props.drawer.combatantId),
    [props.drawer.combatantId, state.combatants]
  );

  React.useEffect(() => {
    if (!combatant) { setConds([]); return; }
    const raw = Array.isArray(combatant.conditions) ? combatant.conditions : [];
    skipNextCommitRef.current = true;
    setConds(raw.map((x) => ({ key: String(x.key ?? ""), casterId: x.casterId ?? null })));
  }, [combatant]);

  const commit = React.useCallback(
    async (nextConds: ConditionInstance[]) => {
      const d = props.drawer;
      const next = nextConds.map((c) => ({ key: c.key, casterId: c.casterId ?? null }));
      try {
        await api(`/api/encounters/${d.encounterId}/combatants/${d.combatantId}`, jsonInit("PUT", { conditions: next }));
        await props.refreshEncounter(d.encounterId);
      } catch { /* Non-blocking */ }
    },
    [props.drawer, props.refreshEncounter]
  );

  // Debounced auto-save on any condition change.
  React.useEffect(() => {
    if (skipNextCommitRef.current) { skipNextCommitRef.current = false; return; }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void commit(conds), 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [conds, commit]);

  const allowedKeys = React.useMemo(() => {
    if (props.drawer.role === "active") return new Set<string>(["concentration", "invisible"]);
    const s = new Set(CONDITION_DEFS.map((c) => c.key));
    s.delete("concentration");
    return s;
  }, [props.drawer.role]);

  const toggle = React.useCallback((key: string) => {
    setConds((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx >= 0) { const next = [...prev]; next.splice(idx, 1); return next; }
      return [...prev, { key }];
    });
  }, []);

  const addCasterCondition = React.useCallback((key: string) => {
    const defaultCaster = props.drawer.activeIdForCaster ?? null;
    setConds((prev) => [...prev, { key, casterId: defaultCaster }]);
  }, [props.drawer.activeIdForCaster]);

  const setCasterForIndex = React.useCallback((idx: number, casterId: string | null) => {
    setConds((prev) => { const next = [...prev]; next[idx] = { ...next[idx], casterId }; return next; });
  }, []);

  const removeAt = React.useCallback((idx: number) => {
    setConds((prev) => { const next = [...prev]; next.splice(idx, 1); return next; });
  }, []);

  const selectedKeys = new Set(conds.map((c) => c.key));
  const visibleDefs = CONDITION_DEFS.filter((c) => allowedKeys.has(c.key));

  return {
    body: (
      <div style={{ display: "grid", gap: 20 }}>

        {/* ── Toggle grid ─────────────────────────────────────────── */}
        <div>
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
            Conditions
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 6,
          }}>
            {visibleDefs.map((c) => {
              const on = selectedKeys.has(c.key);
              const CondIcon = conditionIconByKey[c.key];
              return (
                <button
                  key={c.key}
                  onClick={() => needsCasterForKey(c.key) && !on ? addCasterCondition(c.key) : toggle(c.key)}
                  style={{
                    all: "unset",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${on ? theme.colors.accentPrimary : theme.colors.panelBorder}`,
                    background: on ? withAlpha(theme.colors.accentPrimary, 0.15) : "transparent",
                    color: on ? theme.colors.accentPrimary : theme.colors.muted,
                    fontWeight: on ? 900 : 600,
                    fontSize: "var(--fs-pill)",
                    transition: "border-color 120ms ease, background 120ms ease, color 120ms ease",
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {CondIcon ? <CondIcon size={17} /> : null}
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Applied chips ────────────────────────────────────────── */}
        {conds.length > 0 && (
          <div>
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
              Applied
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {conds.map((c, idx) => {
                const def = CONDITION_DEFS.find((x) => x.key === c.key);
                const needsCaster = needsCasterForKey(c.key);
                const CondIcon = conditionIconByKey[c.key];
                const caster = c.casterId ? state.combatants.find((x) => x.id === c.casterId) : undefined;

                return (
                  <div key={`${c.key}_${idx}`} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>

                    {/* Pill chip */}
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 8px 5px 10px",
                      borderRadius: 999,
                      border: `1px solid ${withAlpha(theme.colors.accentPrimary, 0.4)}`,
                      background: withAlpha(theme.colors.accentPrimary, 0.12),
                      color: theme.colors.text,
                      fontSize: "var(--fs-pill)",
                      fontWeight: 800,
                    }}>
                      {CondIcon ? <CondIcon size={15} /> : null}
                      <span>{def?.name ?? c.key}</span>
                      {needsCaster && caster && (
                        <span style={{ color: theme.colors.muted, fontWeight: 600, fontSize: "var(--fs-tiny)" }}>
                          · {caster.label ?? "Caster"}
                        </span>
                      )}
                      <button
                        onClick={() => removeAt(idx)}
                        title="Remove"
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          marginLeft: 2,
                          color: theme.colors.muted,
                          fontWeight: 900,
                          fontSize: "var(--fs-small)",
                          lineHeight: 1,
                          opacity: 0.7,
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Caster selector — compact, only shown when needed */}
                    {needsCaster && (
                      <Select
                        value={c.casterId ?? ""}
                        onChange={(e) => setCasterForIndex(idx, (e.target as HTMLSelectElement).value || null)}
                        style={{ fontSize: "var(--fs-tiny)", padding: "2px 6px", width: "100%", minWidth: 120 }}
                      >
                        <option value="">— caster —</option>
                        {state.combatants.map((r) => (
                          <option key={r.id} value={r.id}>{String(r.label || "Combatant")}</option>
                        ))}
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={props.close}>Close</Button>
      </div>
    ),
  };
}
