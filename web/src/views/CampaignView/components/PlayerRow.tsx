import React from "react";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";
import { IconPencil, IconPlayer, IconHeart, IconShield } from "@/icons";
import { HPBar } from "@/ui/HPBar";

export type PlayerVM = {
  id: string;
  playerName?: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  ac: number;
  hpMax: number;
  hpCurrent: number;
  tempHp?: number;
  acBonus?: number;
};

export function PlayerRow(props: {
  p: PlayerVM;
  onEdit?: () => void;  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode | null;
  variant?: "campaign" | "combatList";
}) {
  const p = props.p;
  const variant = props.variant ?? "campaign";
  // Some rows (e.g. iNPCs) provide custom action rails with 2+ buttons.
  // Fixed widths cause the meta/subtitle column to overlap and steal pointer events.
  // Use `auto` for custom actions so the action rail sizes to its content.
  const actionsWidth: 0 | 46 | "auto" =
    props.actions === null ? 0 : props.actions === undefined ? 46 : "auto";
  const padding = variant === "combatList" ? "6px 8px" : "8px 10px";
  const background = variant === "combatList" ? "transparent" : "rgba(0,0,0,0.14)";
  const border = variant === "combatList" ? "none" : `1px solid ${theme.colors.panelBorder}`;
  const borderRadius = variant === "combatList" ? 0 : 14;

  const max = Math.max(1, Number(p.hpMax) || 1);
  const cur = Math.max(0, Number(p.hpCurrent) || 0);
  const pct = Math.max(0, Math.min(1, cur / max));
  const isDead = cur <= 0;
  const showDeathSaves = cur === 0 && Boolean(p.playerName);
  const isBloody = pct <= 0.5 && pct > 0.25;
  const isQuarter = pct <= 0.25;

  // Death saves: local UI state per row. This persists while the row remains mounted.
  // Only shown when HP is 0 (dying). Reset automatically when HP rises above 0.
  const [deathSaves, setDeathSaves] = React.useState<{ s: number; f: number }>({ s: 0, f: 0 });

  React.useEffect(() => {
    if (cur > 0) setDeathSaves({ s: 0, f: 0 });
  }, [cur]);

  const DeathSavesRow = (
    <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: 10, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "var(--fs-small)", fontWeight: 900, color: theme.colors.green }}>S</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => {
            const on = i < deathSaves.s;
            return (
              <button
                key={`s-${i}`}
                type="button"
                title={on ? "Remove success" : "Add success"}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeathSaves((prev) => ({ ...prev, s: Math.max(0, Math.min(3, on ? i : i + 1)) }));
                }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: on ? theme.colors.green : theme.colors.panelBg,
                  color: theme.colors.text,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  lineHeight: 1
                }}
              >
                {on ? "✓" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => {
            const on = i < deathSaves.f;
            return (
              <button
                key={`f-${i}`}
                type="button"
                title={on ? "Remove failure" : "Add failure"}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeathSaves((prev) => ({ ...prev, f: Math.max(0, Math.min(3, on ? i : i + 1)) }));
                }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 6,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: on ? theme.colors.red : theme.colors.panelBg,
                  color: theme.colors.text,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  lineHeight: 1
                }}
              >
                {on ? "✕" : ""}
              </button>
            );
          })}
        </div>
        <span style={{ fontSize: "var(--fs-small)", fontWeight: 900, color: theme.colors.red }}>F</span>
      </div>
    </div>
  );

  const metaRight =
    props.subtitle ??
    (variant === "combatList" ? null : (
      <>
        Lvl {p.level} {p.species} {p.class}
      </>
    ));
const acBonus = Number((p as any).acBonus ?? 0) || 0;
  const tempHp = Math.max(0, Number((p as any).tempHp ?? 0) || 0);
  const acTotal = Number(p.ac ?? 0) + acBonus;

  const vitalsRight = (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <IconShield size={14} />
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {acTotal}
          {acBonus ? <span style={{ color: theme.colors.muted, fontWeight: 900 }}>{` (+${acBonus})`}</span> : null}
        </span>
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <IconHeart size={14} />
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {cur}/{max}
          {tempHp ? <span style={{ color: theme.colors.muted, fontWeight: 900 }}>{` (+${tempHp}t)`}</span> : null}
        </span>
      </span>
    </div>
  );

  // Combat list is compact and iPad-friendly.
  if (variant === "combatList") {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            actionsWidth === 0 ? "1fr" : actionsWidth === "auto" ? "1fr auto" : `1fr ${actionsWidth}px`,
          gridTemplateRows: "auto auto",
          gap: 6,
          padding,
          borderRadius,
          background,
          border
        }}
      >
        {/* Top row */}
        <div
          style={{
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 10
          }}
        >
          <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, flex: "1 1 auto" }}>
            <span style={{ display: "inline-flex", opacity: 0.95, flex: "0 0 auto" }}>{props.icon ?? <IconPlayer size={20} />}</span>
            <div
              style={{
                fontWeight: 900,
                color: theme.colors.text,
                fontSize: "var(--fs-medium)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {p.characterName}{" "}
              {p.playerName ? (
                <span style={{ fontWeight: 700, opacity: 0.85 }}>(
                  {p.playerName}
                )</span>
              ) : null}
            </div>
          </div>
          {metaRight ? (
            <div
              style={{
                fontSize: "var(--fs-small)",
                color: theme.colors.muted,
                whiteSpace: "nowrap",
                textAlign: "right",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
                flex: "0 1 auto"
              }}
            >
              {metaRight}
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
          {props.actions === undefined ? (
            <>
              <IconButton title="Edit" onClick={(e) => (e.stopPropagation(), props.onEdit?.())} disabled={!props.onEdit}>
                <IconPencil />
              </IconButton>
            </>
          ) : (
            props.actions
          )}
        </div>

        {/* Bottom row: full-width bar + right-side vitals */}
        <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10 }}>
          {showDeathSaves ? <div style={{ padding: "2px 0" }}>{DeathSavesRow}</div> : <HPBar cur={cur} max={max} ac={p.ac} variant="compact" showText={false} /> }
          <div style={{ fontSize: "var(--fs-small)", color: theme.colors.text, opacity: 0.9, whiteSpace: "nowrap" }}>{vitalsRight}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          actionsWidth === 0 ? "1fr" : actionsWidth === "auto" ? "1fr auto" : `1fr ${actionsWidth}px`,
        gridTemplateRows: "auto auto",
        gap: 6,
        padding,
        borderRadius,
        background,
        border
      }}
    >
      {/* Top row: identity + meta */}
      <div
        style={{
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ display: "inline-flex", opacity: 0.9, flex: "0 0 auto" }}>{props.icon ?? <IconPlayer size={24} />}</span>
          <div style={{ fontWeight: 900, color: theme.colors.text, fontSize: "var(--fs-medium)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {p.characterName} <span style={{ fontWeight: 700, opacity: 0.85 }}>{p.playerName? ("(" + p.playerName + ")") : null}</span>
          </div>
        </div>

        <div
          style={{
            fontSize: "var(--fs-small)",
            color: theme.colors.muted,
            whiteSpace: "nowrap",
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            flex: "0 1 auto"
          }}
        >
          {metaRight}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
        {props.actions === undefined ? (
          <>
            <IconButton title="Edit" onClick={(e) => (e.stopPropagation(), props.onEdit?.())} disabled={!props.onEdit}>
              <IconPencil />
            </IconButton>
          </>
        ) : (
          props.actions
        )}
      </div>

      {/* Bottom row: full-width bar + right-side vitals */}
      <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10 }}>
        {showDeathSaves ? <div style={{ padding: "2px 0" }}>{DeathSavesRow}</div> : <HPBar cur={cur} max={max} ac={p.ac} showText={false} /> }
        <div style={{ fontSize: "var(--fs-small)", color: theme.colors.text, opacity: 0.9, whiteSpace: "nowrap" }}>{vitalsRight}</div>
      </div>
    </div>
  );
}