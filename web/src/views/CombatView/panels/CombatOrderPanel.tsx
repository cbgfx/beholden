import React from "react";
import type { Combatant } from "../../../app/types/domain";
import { theme } from "../../../app/theme/theme";
import { Panel } from "../../../components/ui/Panel";
import { IconINPC, IconMonster, IconPlayer, IconSkull } from "../../../components/icons";
import { PlayerRow, type PlayerVM } from "../../CampaignView/components/PlayerRow";

function InitiativeInput({
  value,
  onCommit
}: {
  value: number | null | undefined;
  onCommit: (n: number) => void;
}) {
  const [v, setV] = React.useState(() => (value && value > 0 ? String(value) : ""));

  React.useEffect(() => {
    setV(value && value > 0 ? String(value) : "");
  }, [value]);

  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onBlur={() => {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        onCommit(Math.max(0, Math.floor(n)));
      }}
      placeholder="–"
      style={{
        width: 48,
        padding: "4px 6px",
        borderRadius: 6,
        border: `1px solid ${theme.colors.panelBg}`,
        background: theme.colors.panelBg,
        color: theme.colors.text,
        textAlign: "center",
        fontSize: "var(--fs-pill)"
      }}
    />
  );
}

export function CombatOrderPanel(props: {
  combatants: Combatant[];
  playersById: Record<string, { playerName: string; characterName: string; class: string; species: string; level: number; ac: number; hpMax: number; hpCurrent: number }>;
  monsterCrById: Record<string, number | null | undefined>;
  activeId: string | null;
  targetId: string | null;
  onSelectTarget: (id: string) => void;
  onSetInitiative: (id: string, initiative: number) => void;
}) {

const activeIndex = React.useMemo(() => {
  if (!props.combatants.length) return 0;
  if (props.activeId) {
    const idx = props.combatants.findIndex((c) => c.id === props.activeId);
    if (idx >= 0) return idx;
  }
  return 0;
}, [props.combatants, props.activeId]);

const upcoming = React.useMemo(() => props.combatants.slice(activeIndex), [props.combatants, activeIndex]);
const wrapped = React.useMemo(() => props.combatants.slice(0, activeIndex), [props.combatants, activeIndex]);
  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{fontSize: "var(--fs-title)", color: theme.colors.accent, alignItems: "center"}}>INITIATIVE</span>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflow: "auto" }}>
        {upcoming.map((c, idx) => {
          const isActive = c.id === props.activeId;
          const isTarget = c.id === props.targetId;
          // Combatants in this codebase use baseType/baseId (not sourceType/sourceId).
          // hp/ac can be nullable in the domain type, so normalize to numbers for rendering.
          const hpCurrent = Number(c.hpCurrent ?? 0);
          const rawHpMax = Number(c.hpMax ?? 1);
          const overrides = c.overrides ?? null;
          const hpMax = Number(overrides?.hpMaxOverride ?? rawHpMax) || rawHpMax || 1;
          const ac = Number(c.ac ?? 0);

          // Prefer an explicit label (if set), otherwise fall back to the combatant name.
          const displayName = (c.label || c.name || "(Unnamed)").trim() || "(Unnamed)";
          const friendly = Boolean(c.friendly);
          const isDead = Number(hpCurrent) <= 0;

          const vm: PlayerVM = {
            id: c.id,
            playerName: "",
            characterName: displayName,
            class: "",
            species: "",
            level: 0,
            ac,
            hpMax,
            hpCurrent
          };

          const playerRec = c.baseType === "player" ? props.playersById[c.baseId] : undefined;
          if (playerRec) {
            vm.playerName = playerRec.playerName;
            vm.class = playerRec.class;
            vm.species = playerRec.species;
            vm.level = Number(playerRec.level ?? 0) || 0;
          }

          const iconColor = isDead
            ? theme.colors.muted
            : (c.baseType === "player" ? theme.colors.player : (c.color || (friendly ? theme.colors.health : theme.colors.danger)));

          const icon = isDead
            ? <span style={{ color: iconColor }}><IconSkull size={28} /></span>
            : c.baseType === "player"
              ? <span style={{ color: iconColor }}><IconPlayer size={28} /></span>
              : c.baseType === "inpc"
                ? <span style={{ color: iconColor }}><IconINPC size={28} /></span>
                : <span style={{ color: iconColor }}><IconMonster size={28} /></span>;

          return (
            <button
              key={c.id}
              onClick={() => props.onSelectTarget(c.id)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "block"
              }}
            >
              <div style={{ position: "relative" }}>
                {isActive ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 14,
                      boxShadow: `0 0 0 2px ${theme.colors.accent} inset`,
                      pointerEvents: "none"
                    }}
                  />
                ) : null}

                <div
                  style={{
                    borderRadius: 14,
                    padding: 0,
                    background: isTarget ? theme.colors.selected : "transparent",
                    border: `1px solid ${isActive ? theme.colors.accent : theme.colors.panelBorder}`
                  }}
                >
                  <PlayerRow
                    p={vm}
                    icon={icon}
                    variant="combatList"
                    subtitle={
                      <span
                        style={{
                          fontSize: "var(--fs-medium)",
                          fontWeight: 900,
                          color: theme.colors.muted,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span>Init</span>
                        {(() => {
                          const init = Number((c as any).initiative);
                          if (!Number.isFinite(init) || init === 0) {
                            return (
                              <InitiativeInput
                                value={null}
                                onCommit={(n) => props.onSetInitiative(c.id, n)}
                              />
                            );
                          }
                          return <span>{init}</span>;
                        })()}
                      </span>
                    }
                    actions={null}
                  />
                </div>
              </div>
            </button>
          );
        })}
        {wrapped.length ? (
          <div style={{ padding: "6px 2px 2px", color: theme.colors.accent, fontSize: "var(--fs-title)", fontWeight: 900 }}>
            TOP OF THE ROUND
          </div>
        ) : null}
        {wrapped.map((c, idx) => {
          const isActive = c.id === props.activeId;
          const isTarget = c.id === props.targetId;
          const hpCurrent = Number(c.hpCurrent ?? 0);
          const rawHpMax = Number(c.hpMax ?? 1);
          const overrides = c.overrides ?? null;
          const hpMax = Number(overrides?.hpMaxOverride ?? rawHpMax) || rawHpMax || 1;
          const ac = Number(c.ac ?? 0);

          const displayName = (c.label || c.name || "(Unnamed)").trim() || "(Unnamed)";
          const friendly = Boolean(c.friendly);
          const isDead = Number(hpCurrent) <= 0;

          const vm: PlayerVM = {
            id: c.id,
            playerName: "",
            characterName: displayName,
            class: "",
            species: "",
            level: 0,
            ac,
            hpMax,
            hpCurrent
          };

          const playerRec = c.baseType === "player" ? props.playersById[c.baseId] : undefined;
          if (playerRec) {
            vm.playerName = playerRec.playerName;
            vm.class = playerRec.class;
            vm.species = playerRec.species;
            vm.level = Number(playerRec.level ?? 0) || 0;
          }

          const iconColor = isDead
            ? theme.colors.muted
            : c.baseType === "player"
              ? theme.colors.player
              : c.color || (friendly ? theme.colors.health : theme.colors.danger);

          const icon = isDead ? (
            <span style={{ color: iconColor }}>
              <IconSkull size={28} />
            </span>
          ) : c.baseType === "player" ? (
            <span style={{ color: iconColor }}>
              <IconPlayer size={28} />
            </span>
          ) : c.baseType === "inpc" ? (
            <span style={{ color: iconColor }}>
              <IconINPC size={28} />
            </span>
          ) : (
            <span style={{ color: iconColor }}>
              <IconMonster size={28} />
            </span>
          );

          return (
            <button
              key={c.id}
              onClick={() => props.onSelectTarget(c.id)}
              style={{ all: "unset", cursor: "pointer", display: "block" }}
            >
              <div style={{ position: "relative" }}>
                {isActive ? (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 14,
                      boxShadow: `0 0 0 2px ${theme.colors.accent} inset`
                    }}
                  />
                ) : null}
                <div
                  style={{
                    borderRadius: 14,
                    padding: 0,
                    background: isTarget ? theme.colors.selected : "transparent",
                    border: `1px solid ${isActive ? theme.colors.accent : theme.colors.panelBorder}`
                  }}
                >
                  <PlayerRow
                    p={vm}
                    icon={icon}
                    variant="combatList"
                    subtitle={
                      <span
                        style={{
                          fontSize: "var(--fs-medium)",
                          fontWeight: 900,
                          color: theme.colors.muted,
                          display: "inline-flex",
                          gap: 6,
                          alignItems: "center"
                        }}
                      >
                        {Number((c as any).initiative) === 0 ? (
                          <>
                            <span>Init</span>
                            <InitiativeInput
                              value={null}
                              onCommit={(n) => props.onSetInitiative((c as any).id, n)}
                            />
                          </>
                        ) : (
                          (() => {
                            const init = Number((c as any).initiative);
                            return `Init ${Number.isFinite(init) && init !== 0 ? init : "—"}`;
                          })()
                        )}
                      </span>
                    }
                    actions={null}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}
