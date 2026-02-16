import React from "react";
import type { Combatant } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { IconINPC, IconMonster, IconPlayer, IconSkull, IconTargeted, IconInitiative } from "@/icons";
import { PlayerRow, type PlayerVM } from "@/views/CampaignView/components/PlayerRow";

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
        const k = String(e.key || "").toLowerCase();
        const allowHotkey = !e.altKey && !e.ctrlKey && !e.metaKey && (k === "n" || k === "p");
        if (!allowHotkey) e.stopPropagation();
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

function TurnBadge(props: { active: boolean; targeted: boolean }) {
  const size = 22;
  const border = props.active ? theme.colors.accent : theme.colors.panelBorder;
  const bg = props.active ? theme.colors.accent : "transparent";
  const shadow = props.active ? `0 0 0 2px ${theme.colors.accent}40` : "none";
  const iconColor = props.active ? theme.colors.panelBg : theme.colors.accent;

  return (
    <div
      title={props.active ? "Active" : props.targeted ? "Target" : ""}
      style={{
        width: size,
        height: size,
        clipPath: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%)",
        border: `2px solid ${border}`,
        background: bg,
        boxShadow: shadow,
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: iconColor
      }}
    >
      {props.targeted ? <IconTargeted size={22} /> : null}
    </div>
  );
}

function getCombatantIcon(args: {
  baseType: Combatant["baseType"];
  isDead: boolean;
  iconColor: string;
  badge: React.ReactNode;
}) {
  const { baseType, isDead, iconColor, badge } = args;

  const actualIcon = isDead ? (
    <span style={{ color: iconColor }}>
      <IconSkull size={28} />
    </span>
  ) : baseType === "player" ? (
    <span style={{ color: iconColor }}>
      <IconPlayer size={28} />
    </span>
  ) : baseType === "inpc" ? (
    <span style={{ color: iconColor }}>
      <IconINPC size={28} />
    </span>
  ) : (
    <span style={{ color: iconColor }}>
      <IconMonster size={28} />
    </span>
  );

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {badge}
      {actualIcon}
    </div>
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

  const getRowShadow = (isActive: boolean, isTarget: boolean) => {
    // Target glow should remain visible even when the target is also the active combatant (self-target).
    if (isActive && isTarget) {
      return `
        0 0 0 2px ${theme.colors.accent} inset,
        0 0 0 4px ${theme.colors.blue} inset,
        0 0 18px ${theme.colors.blue} inset,
        0 6px 18px rgba(0,0,0,0.18)
      `;
    }
    if (isActive) {
      return `0 0 0 2px ${theme.colors.accent} inset, 0 6px 18px rgba(0,0,0,0.18)`;
    }
    if (isTarget) {
      // Inset-only to avoid scrollbars in the initiative list.
      return `0 0 0 2px ${theme.colors.blue} inset, 0 0 18px ${theme.colors.blue} inset`;
    }
    return "none";
  };
  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconInitiative size={18} title="Initiative" />
          <span style={{ fontSize: "var(--fs-title)", color: theme.colors.accent, fontWeight: 900 }}>INITIATIVE</span>
        </div>
      }
    >
      <style>
        {`@keyframes beholdenTargetPulse {
            0% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
            50% { filter: drop-shadow(0 0 14px ${theme.colors.blue}80); }
            100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
          }`}
      </style>
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
          const dim = isDead && c.baseType !== "player";

          const vm: PlayerVM = {
            id: c.id,
            playerName: "",
            characterName: displayName,
            class: "",
            species: "",
            level: 0,
            ac,
            hpMax,
            hpCurrent,
            tempHp: Math.max(0, Number(overrides?.tempHp ?? 0) || 0),
            acBonus: Number(overrides?.acBonus ?? 0) || 0
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
            : (c.baseType === "player" ? theme.colors.blue : (c.color || (friendly ? theme.colors.green : theme.colors.red)));
          const badge = <TurnBadge active={isActive} targeted={isTarget} />;
          const icon = getCombatantIcon({ baseType: c.baseType, isDead, iconColor, badge });

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
                <div
                  style={{
                    borderRadius: 14,
                    padding: 0,
                    background: "transparent",
                    border: `1px solid ${theme.colors.panelBorder}`,
                    overflow: "hidden",
                    // Active should pop. Target should glow. If self-targeted, show both.
                    boxShadow: getRowShadow(isActive, isTarget),
                    animation: isTarget ? "beholdenTargetPulse 1.8s ease-in-out infinite" : undefined,
                    transform: isActive ? "translateY(-1px)" : "none",
                    transition: "transform 80ms ease",
                    opacity: dim ? 0.45 : 1,
                    filter: dim ? "grayscale(0.85)" : "none"
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
                        <IconInitiative size={14} title="Initiative" />
                        {(isActive || isTarget) && (
                          <span
                            style={{
                              marginLeft: 2,
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: "var(--fs-tiny)",
                              fontWeight: 900,
                              letterSpacing: 0.6,
                              textTransform: "uppercase",
                              color: theme.colors.text,
                              border: `1px solid ${isActive && isTarget ? theme.colors.accent : isActive ? theme.colors.accent : theme.colors.blue}`,
                              background:
                                isActive && isTarget
                                  ? `linear-gradient(90deg, ${theme.colors.accent}33, ${theme.colors.blue}33)`
                                  : isActive
                                    ? `${theme.colors.accent}22`
                                    : `${theme.colors.blue}22`
                            }}
                            title={
                              isActive && isTarget
                                ? "Active (self-target)"
                                : isActive
                                  ? "Active"
                                  : "Target"
                            }
                          >
                            {isActive && isTarget ? "Self" : isActive ? "Active" : "Target"}
                          </span>
                        )}
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
            NEXT ROUND
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
          const dim = isDead && c.baseType !== "player";

          const vm: PlayerVM = {
            id: c.id,
            playerName: "",
            characterName: displayName,
            class: "",
            species: "",
            level: 0,
            ac,
            hpMax,
            hpCurrent,
            tempHp: Math.max(0, Number(overrides?.tempHp ?? 0) || 0),
            acBonus: Number(overrides?.acBonus ?? 0) || 0
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
              ? theme.colors.blue
              : c.color || (friendly ? theme.colors.green : theme.colors.red);

          const badge = <TurnBadge active={isActive} targeted={isTarget} />;
          const icon = getCombatantIcon({ baseType: c.baseType, isDead, iconColor, badge });

          return (
            <button
              key={c.id}
              onClick={() => props.onSelectTarget(c.id)}
              style={{ all: "unset", cursor: "pointer", display: "block" }}
            >
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    borderRadius: 14,
                    padding: 0,
                    background: "transparent",
                    border: `1px solid ${theme.colors.panelBorder}`,
                    overflow: "hidden",
                    boxShadow: getRowShadow(isActive, isTarget),
                    animation: isTarget ? "beholdenTargetPulse 1.8s ease-in-out infinite" : undefined,
                    transform: isActive ? "translateY(-1px)" : "none",
                    transition: "transform 80ms ease",
                    opacity: dim ? 0.45 : 1,
                    filter: dim ? "grayscale(0.85)" : "none"
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
                        {(() => {
                          const init = Number((c as any).initiative);
                          if (!Number.isFinite(init) || init === 0) {
                            return (
                              <>
                        <IconInitiative size={14} title="Initiative" />
                        <span>Init</span>
                                <InitiativeInput
                                  value={null}
                                  onCommit={(n) => props.onSetInitiative(c.id, n)}
                                />
                              </>
                            );
                          }
                          return <span>{`Init ${init}`}</span>;
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
      </div>
    </Panel>
  );
}
