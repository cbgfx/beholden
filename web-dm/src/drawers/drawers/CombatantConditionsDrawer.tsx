import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import type { DrawerContent } from "@/drawers/types";
import { CONDITION_DEFS } from "@/domain/conditions";
import { conditionIconByKey } from "@/icons/conditions";
import { Select } from "@/ui/Select";
import type { SharedAbilityKey } from "@beholden/shared/domain";
import {
  cycleExpiry,
  HEX_ABILITIES,
  isRepeatableCasterKey,
  needsCasterForKey,
  useConditionsDrawerState,
  type ConditionsDrawerState,
} from "./useConditionsDrawerState";

export function CombatantConditionsDrawer(props: {
  drawer: ConditionsDrawerState;
  close: () => void;
  refreshEncounter: (eid: string | null) => Promise<void>;
}): DrawerContent {
  const { drawer } = props;
  const {
    combatants, conds, currentRound, selectedKeys, hexCount, conditionGroups,
    toggle, addCasterCondition, setCasterForIndex, setHexAbilityForIndex, setExpiryForIndex, removeAt,
  } = useConditionsDrawerState(drawer, props.refreshEncounter);

  return {
    body: (
      <div style={{ display: "grid", gap: 20 }}>

        {/* ── Toggle grid ─────────────────────────────────────────── */}
        <div>
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 }}>
            Conditions
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {conditionGroups.map((group, groupIndex) => (
              <div
                key={groupIndex}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 6,
                }}
              >
                {group.map((c) => {
              const on = selectedKeys.has(c.key);
              const addDisabled = c.key === "hexed" && hexCount >= HEX_ABILITIES.length;
              const CondIcon = conditionIconByKey[c.key as keyof typeof conditionIconByKey];
              return (
                <button
                  key={c.key}
                  disabled={addDisabled}
                  onClick={() => {
                    if (addDisabled) return;
                    if (isRepeatableCasterKey(c.key)) addCasterCondition(c.key);
                    else toggle(c.key);
                  }}
                  title={
                    addDisabled
                      ? "All six abilities are already assigned to Hex sources"
                      : isRepeatableCasterKey(c.key) && on
                        ? `Add another ${c.name} source`
                        : undefined
                  }
                  style={{
                    all: "unset",
                    cursor: addDisabled ? "not-allowed" : "pointer",
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
                    opacity: addDisabled ? 0.45 : 1,
                  }}
                >
                  {CondIcon ? <CondIcon size={17} /> : null}
                  <span>{c.name}</span>
                </button>
              );
                })}
              </div>
            ))}
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
                const CondIcon = conditionIconByKey[c.key as keyof typeof conditionIconByKey];
                const caster = c.casterId ? combatants.find((x) => x.id === c.casterId) : undefined;
                const availableHexAbilities = HEX_ABILITIES.filter((ability) => {
                  const ownerIdx = conds.findIndex((other) =>
                    other.key === "hexed" && other.hexAbility === ability.key
                  );
                  return ownerIdx < 0 || ownerIdx === idx;
                });

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
                      {c.key === "hexed" && c.hexAbility && (
                        <span style={{ color: theme.colors.muted, fontWeight: 700, fontSize: "var(--fs-tiny)", textTransform: "uppercase" }}>
                          · {c.hexAbility}
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

                    {/* Source details — compact, only shown when needed */}
                    {needsCaster && (
                      <div style={{ display: "grid", gap: 4, width: "100%", minWidth: 140 }}>
                        <Select
                          aria-label={`${def?.name ?? c.key} source`}
                          value={c.casterId ?? ""}
                          onChange={(e) => setCasterForIndex(idx, (e.target as HTMLSelectElement).value || null)}
                          style={{ fontSize: "var(--fs-tiny)", padding: "2px 6px", width: "100%" }}
                        >
                          <option value="">— source —</option>
                          {combatants.map((r) => (
                            <option key={r.id} value={r.id}>{String(r.label || "Combatant")}</option>
                          ))}
                        </Select>
                        {c.key === "hexed" && (
                          <Select
                            aria-label="Hexed ability"
                            value={c.hexAbility ?? ""}
                            onChange={(e) => setHexAbilityForIndex(
                              idx,
                              ((e.target as HTMLSelectElement).value || null) as SharedAbilityKey | null
                            )}
                            style={{ fontSize: "var(--fs-tiny)", padding: "2px 6px", width: "100%" }}
                          >
                            <option value="">— hexed ability —</option>
                            {availableHexAbilities.map((ability) => (
                              <option key={ability.key} value={ability.key}>{ability.label}</option>
                            ))}
                          </Select>
                        )}
                      </div>
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
