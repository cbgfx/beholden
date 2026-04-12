import React from "react";
import type { SharedConditionInstance } from "@beholden/shared/domain";
import { Button } from "@/ui/Button";
import { api, jsonInit } from "@/services/api";
import { theme, withAlpha } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { CONDITION_DEFS } from "@/domain/conditions";
import { conditionIconByKey } from "@/icons/conditions";
import { Select } from "@/ui/Select";

type ConditionsDrawerState = Exclude<Extract<DrawerState, { type: "combatantConditions" }>, null>;

type ConditionInstance = SharedConditionInstance & { expiresAtRound?: number | null };

// Only these conditions require a caster association.
const NEEDS_CASTER_KEYS = new Set(["hexed", "marked"]);
function needsCasterForKey(key: string) {
  return NEEDS_CASTER_KEYS.has(String(key ?? "").trim().toLowerCase());
}

/** Cycle the expiry round: null → cr+1 → cr+2 → cr+3 → cr+4 → null */
function cycleExpiry(current: number | null | undefined, cr: number): number | null {
  if (current == null) return cr + 1;
  const remaining = current - cr;
  if (remaining <= 0) return cr + 1;   // was expired — reset to +1
  if (remaining >= 4) return null;      // at max — clear
  return cr + remaining + 1;
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
  // Refs to latest values — used in the unmount flush below (initialized after commit is declared).
  const condsRef = React.useRef<ConditionInstance[]>(conds);
  const commitRef = React.useRef<(c: ConditionInstance[]) => Promise<void>>(async () => { /* populated below */ });

  const currentRound = props.drawer.currentRound ?? 0;

  const combatant = React.useMemo(
    () => state.combatants.find((x) => x.id === props.drawer.combatantId),
    [props.drawer.combatantId, state.combatants]
  );

  React.useEffect(() => {
    if (!combatant) { setConds([]); return; }
    const raw = Array.isArray(combatant.conditions) ? combatant.conditions : [];
    skipNextCommitRef.current = true;
    setConds(raw.map((x) => ({
      key: String(x.key ?? ""),
      casterId: x.casterId ?? null,
      expiresAtRound: x.expiresAtRound != null ? Number(x.expiresAtRound) : null,
    })));
  }, [combatant]);

  const commit = React.useCallback(
    async (nextConds: ConditionInstance[]) => {
      const d = props.drawer;
      const next = nextConds.map((c) => ({
        key: c.key,
        casterId: c.casterId ?? null,
        expiresAtRound: c.expiresAtRound ?? null,
      }));
      try {
        await api(`/api/encounters/${d.encounterId}/combatants/${d.combatantId}`, jsonInit("PUT", { conditions: next }));
      } catch { /* Non-blocking */ }
    },
    [props.drawer]
  );

  // Keep latest-value refs in sync (needed for the unmount flush).
  React.useEffect(() => { condsRef.current = conds; });
  React.useEffect(() => { commitRef.current = commit; }, [commit]);

  // Debounced auto-save on any condition change.
  React.useEffect(() => {
    if (skipNextCommitRef.current) { skipNextCommitRef.current = false; return; }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void commitRef.current(condsRef.current);
    }, 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [conds]);

  // Flush any pending debounced save when the drawer unmounts (e.g. user presses "End" mid-edit).
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
        void commitRef.current(condsRef.current);
      }
    };
  }, []); // intentionally empty — runs only on unmount

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

  const setExpiryForIndex = React.useCallback((idx: number, expiresAtRound: number | null) => {
    setConds((prev) => { const next = [...prev]; next[idx] = { ...next[idx], expiresAtRound }; return next; });
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

                const hasTimer = c.expiresAtRound != null;
                const isExpired = hasTimer && c.expiresAtRound! <= currentRound;
                const remaining = hasTimer ? c.expiresAtRound! - currentRound : null;

                const chipBorderColor = isExpired
                  ? theme.colors.accentWarning
                  : withAlpha(theme.colors.accentPrimary, 0.4);
                const chipBg = isExpired
                  ? "rgba(255, 140, 66, 0.12)"
                  : withAlpha(theme.colors.accentPrimary, 0.12);

                return (
                  <div key={`${c.key}_${idx}`} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>

                    {/* Pill chip */}
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 8px 5px 10px",
                      borderRadius: 999,
                      border: `1px solid ${chipBorderColor}`,
                      background: chipBg,
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

                      {/* Timer cycle button */}
                      <button
                        onClick={() => setExpiryForIndex(idx, cycleExpiry(c.expiresAtRound, currentRound))}
                        title={
                          !hasTimer
                            ? "Set expiry timer"
                            : isExpired
                            ? "Expired — click to reset"
                            : `Expires in ${remaining} round${remaining === 1 ? "" : "s"} — click to adjust`
                        }
                        style={{
                          all: "unset",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 22,
                          height: 20,
                          padding: "0 4px",
                          borderRadius: 999,
                          border: hasTimer
                            ? `1px solid ${isExpired ? theme.colors.accentWarning : theme.colors.accentWarning}`
                            : `1px solid ${theme.colors.panelBorder}`,
                          background: hasTimer
                            ? isExpired
                              ? theme.colors.accentWarning
                              : "rgba(255, 140, 66, 0.15)"
                            : "transparent",
                          color: hasTimer
                            ? isExpired ? "#000" : theme.colors.accentWarning
                            : theme.colors.muted,
                          fontSize: "var(--fs-tiny)",
                          fontWeight: 900,
                          lineHeight: 1,
                          transition: "border-color 120ms, background 120ms, color 120ms",
                        }}
                      >
                        {!hasTimer ? "⏱" : isExpired ? "exp" : `${remaining}R`}
                      </button>

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
