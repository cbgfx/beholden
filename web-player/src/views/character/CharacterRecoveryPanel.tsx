import React from "react";
import { EmptyState } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { IconWerewolf } from "@/icons";
import { Button } from "@/ui/Button";
import type { ResourceCounter } from "@/views/character/CharacterSheetTypes";
import { getExhaustionEffects } from "@/views/character/CharacterExhaustion";
import { CollapsiblePanel, miniPillBtn, restBtnStyle, PanelHeaderActionButton } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/panelRegistry";

export function RecoveryPanel(props: {
  accentColor: string;
  hitDiceCurrent: number;
  hitDiceMax: number;
  hitDieSize: number | null;
  hitDicePools?: Array<{ dieSize: number; max: number; current: number }>;
  hitDieConMod: number;
  exhaustion: number;
  ruleset?: "5e" | "5.5e";
  classResources: ResourceCounter[];
  /** null when not in a tracked encounter (no Reaction economy to enforce). */
  reactionUsed?: boolean | null;
  classPresentation?: Array<{ classEntryId: string; className: string; classLevel: number; subclassName: string | null; hitDieSize: number | null }>;
  onSaveHitDiceCurrent: (value: number) => Promise<void> | void;
  onSaveHitDicePoolCurrent?: (dieSize: number, value: number) => Promise<void> | void;
  onShortRest: () => Promise<void> | void;
  onLongRest: () => Promise<void> | void;
  onExhaustionChange: (value: number) => Promise<void> | void;
  onChangeResourceCurrent: (key: string, delta: number) => Promise<void> | void;
  polymorphName?: string | null;
  onOpenTransformSelf: () => void;
  onRevertTransformSelf?: () => void;
}) {
  const {
    accentColor,
    hitDiceCurrent,
    hitDiceMax,
    hitDieSize,
    hitDicePools = [],
    hitDieConMod,
    exhaustion,
    ruleset,
    classResources,
    reactionUsed = null,
    classPresentation = [],
    onSaveHitDiceCurrent,
    onSaveHitDicePoolCurrent,
    onShortRest,
    onLongRest,
    onExhaustionChange,
    onChangeResourceCurrent,
    polymorphName,
    onOpenTransformSelf,
    onRevertTransformSelf,
  } = props;

  const formatResetLabel = (resource: ResourceCounter): string => {
    const code = String(resource.reset ?? "").trim().toUpperCase();
    if (code === "S" && resource.restoreAmount === "one") return "Regains 1 on Short Rest, all on Long Rest";
    if (code === "S") return "Resets on Short Rest";
    if (code === "L") return "Resets on Long Rest";
    if (code === "SL") return "Resets on Short or Long Rest";
    return `Reset ${resource.reset}`;
  };
  const multiclass = classPresentation.length > 1;
  const classByEntryId = React.useMemo(
    () => new Map(classPresentation.map((entry) => [entry.classEntryId, entry])),
    [classPresentation],
  );
  const getClassEntryId = (value: string) => {
    const match = /^class:([^:]+):/.exec(value);
    return match?.[1] ?? null;
  };

  const exhaustionColor =
    exhaustion === 0 ? C.muted : exhaustion <= 2 ? "#f59e0b" : exhaustion <= 4 ? "#f97316" : "#dc2626";
  const activeExhaustionEffects = getExhaustionEffects(ruleset, exhaustion);
  const upkeepSummary = classResources.length > 0
    ? `${classResources.reduce((sum, resource) => sum + resource.current, 0)} / ${classResources.reduce((sum, resource) => sum + resource.max, 0)} resources`
    : `${hitDiceCurrent} / ${hitDiceMax} hit dice`;

  return (
    <CollapsiblePanel
      title="Upkeep"
      color={accentColor}
      storageKey={PANEL_IDS.recovery}
      summary={`${upkeepSummary}${exhaustion > 0 ? ` · Exhaustion ${exhaustion}` : ""}`}
      actions={
        <PanelHeaderActionButton color={accentColor} onClick={onOpenTransformSelf} title="Transform Self">
          <IconWerewolf size={18} />
        </PanelHeaderActionButton>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {polymorphName && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}44`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
                Current Form
              </div>
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>
                {polymorphName}
              </div>
            </div>
            {onRevertTransformSelf ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onRevertTransformSelf}
                style={{ padding: "6px 12px", borderRadius: 999 }}
              >
                Revert
              </Button>
            ) : null}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{
            borderRadius: 9,
            overflow: "hidden",
            background: "rgba(255,255,255,0.035)",
            border: `1px solid ${exhaustion > 0 ? `${exhaustionColor}44` : "rgba(255,255,255,0.08)"}`,
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(76px, auto) minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
            }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Hit Dice
              </div>
              <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 900, color: C.text }}>
                  {hitDiceCurrent} / {hitDiceMax}
                </span>
                {hitDicePools.length <= 1 && hitDieSize != null && (
                  <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
                    d{hitDieSize}{hitDieConMod >= 0 ? ` + ${hitDieConMod}` : ` - ${Math.abs(hitDieConMod)}`} per die
                  </span>
                )}
              </div>
              {hitDicePools.length <= 1 ? <div style={{ display: "flex", gap: 5 }}>
                <button
                  type="button"
                  aria-label="Spend Hit Die"
                  onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent - 1)}
                  disabled={hitDiceCurrent <= 0}
                  style={miniPillBtn(hitDiceCurrent > 0)}
                >
                  -
                </button>
                <button
                  type="button"
                  aria-label="Restore Hit Die"
                  onClick={() => void onSaveHitDiceCurrent(hitDiceCurrent + 1)}
                  disabled={hitDiceCurrent >= hitDiceMax}
                  style={miniPillBtn(hitDiceCurrent < hitDiceMax)}
                >
                  +
                </button>
              </div> : <div />}
            </div>
            {hitDicePools.length > 1 && <div style={{ display: "grid", gap: 6, padding: "0 10px 8px" }}>
              {hitDicePools.map((pool) => <div key={pool.dieSize} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto auto", alignItems: "center", gap: 6 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 700 }}>d{pool.dieSize}{hitDieConMod >= 0 ? ` + ${hitDieConMod}` : ` - ${Math.abs(hitDieConMod)}`} per die</span>
                <button type="button" aria-label={`Spend d${pool.dieSize} Hit Die`} onClick={() => void onSaveHitDicePoolCurrent?.(pool.dieSize, pool.current - 1)} disabled={pool.current <= 0} style={miniPillBtn(pool.current > 0)}>-</button>
                <span style={{ color: C.text, fontWeight: 800, minWidth: 38, textAlign: "center" }}>{pool.current}/{pool.max}</span>
                <button type="button" aria-label={`Restore d${pool.dieSize} Hit Die`} onClick={() => void onSaveHitDicePoolCurrent?.(pool.dieSize, pool.current + 1)} disabled={pool.current >= pool.max} style={miniPillBtn(pool.current < pool.max)}>+</button>
              </div>)}
            </div>}

            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(76px, auto) minmax(0, 1fr) auto",
              alignItems: "center",
              gap: 10,
              padding: "7px 10px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Exhaustion
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 900, color: exhaustionColor }}>
                  {exhaustion} / 6
                </span>
                {activeExhaustionEffects.length > 0 && (
                  <div
                    title={activeExhaustionEffects.join("; ")}
                    style={{
                      color: exhaustionColor,
                      fontSize: "var(--fs-tiny)",
                      marginTop: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {activeExhaustionEffects.length} active effect{activeExhaustionEffects.length === 1 ? "" : "s"} · {activeExhaustionEffects[activeExhaustionEffects.length - 1]}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                <button
                  type="button"
                  aria-label="Reduce Exhaustion"
                  onClick={() => void onExhaustionChange(Math.max(0, exhaustion - 1))}
                  disabled={exhaustion <= 0}
                  style={miniPillBtn(exhaustion > 0)}
                >
                  -
                </button>
                <button
                  type="button"
                  aria-label="Increase Exhaustion"
                  onClick={() => void onExhaustionChange(Math.min(6, exhaustion + 1))}
                  disabled={exhaustion >= 6}
                  style={miniPillBtn(exhaustion < 6)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => void onShortRest()} style={{ ...restBtnStyle(C.colorRitual), flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8 }}>
              Short Rest
            </button>
            <button type="button" onClick={() => void onLongRest()} style={{ ...restBtnStyle("#34d399"), flex: 1, minWidth: 0, padding: "7px 10px", borderRadius: 8 }}>
              Long Rest
            </button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
            Resources
          </div>
          {classResources.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {classResources.map((resource) => {
                const owner = classByEntryId.get(getClassEntryId(resource.key) ?? "");
                // A resource typed `actionType: "reaction"` (Warding Flare, Cosmic Omen, ...)
                // IS the Reaction -- once the Reaction's already spent this round, spending
                // another use of it isn't legal until it resets, so block it here the same way
                // an empty counter blocks the button. Only enforced inside a tracked encounter
                // (reactionUsed === true); outside combat there's no round to enforce against.
                const reactionBlocked = resource.actionType === "reaction" && reactionUsed === true;
                const spendDisabled = resource.current <= 0 || reactionBlocked;
                return (
                <div
                  key={resource.key}
                  className="character-hover-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) auto auto auto",
                    gap: 8,
                    alignItems: "center",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: C.text }}>{resource.name}</div>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
                      {multiclass && owner ? `${owner.className} ${owner.classLevel} · ` : ""}{formatResetLabel(resource)}
                      {reactionBlocked ? " · Reaction used" : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onChangeResourceCurrent(resource.key, -1)}
                    disabled={spendDisabled}
                    title={reactionBlocked ? "Reaction already used this round" : undefined}
                    style={miniPillBtn(!spendDisabled)}
                  >
                    -
                  </button>
                  <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: C.text, minWidth: 52, textAlign: "center" }}>
                    {resource.current} / {resource.max}
                  </div>
                  <button
                    type="button"
                    onClick={() => void onChangeResourceCurrent(resource.key, 1)}
                    disabled={resource.current >= resource.max}
                    style={miniPillBtn(resource.current < resource.max)}
                  >
                    +
                  </button>
                </div>
                );
              })}
            </div>
          ) : (
            <EmptyState textColor={C.muted}>No tracked resources.</EmptyState>
          )}
        </div>
      </div>
    </CollapsiblePanel>
  );
}
