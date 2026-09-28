import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { IconAC, IconHP, IconSpeed } from "../../icons";
import { AbilityScoresCompact } from "../../ui/AbilityScoresCompact";
import { withAlpha } from "../../ui/colors";
import { SectionTitle } from "../../ui/SectionTitle";
import { COMPENDIUM_COLORS as C } from "../compendium/compendiumStyle";

type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

/** What a stat sheet shows: vitals, ability scores (with saves) and detail lines. */
export type CharacterSheetStats = {
  ac: number;
  hpCur: number;
  hpMax: number;
  tempHp?: number;
  speed: number | null;
  speedDisplay?: string;
  abilities: Record<AbilityKey, number>;
  saves?: Partial<Record<AbilityKey, number>>;
  infoLines?: Array<{ label: string; value: string }>;
};

/** A section heading used inside stat blocks (collapsible when given `onToggle`). */
export function StatSectionTitle(props: {
  children: React.ReactNode;
  actions?: React.ReactNode;
  collapsed?: boolean;
  onToggle?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <SectionTitle
      color={C.sectionTitle}
      actions={props.actions}
      collapsed={props.collapsed}
      onToggle={props.onToggle}
      fontSize="var(--fs-tiny)"
      fontWeight={700}
      style={props.style}
    >
      {props.children}
    </SectionTitle>
  );
}

/** One vital (AC, hit points, speed): a small caption over an icon and a value. */
export function StatBar(props: { icon: React.ReactNode; label: string; value: React.ReactNode; flex?: number; compact?: boolean }) {
  return (
    <div
      style={{
        flex: props.flex ?? 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: props.compact ? 2 : 4,
        padding: props.compact ? "6px 8px" : "8px 10px",
      }}
    >
      <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", color: C.muted, whiteSpace: "nowrap" }}>
        {props.label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900, fontSize: props.compact ? "var(--fs-title)" : "var(--fs-stat)", color: C.text }}>
        <span style={{ opacity: 0.65, display: "flex", alignItems: "center" }}>{props.icon}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{props.value}</span>
      </div>
    </div>
  );
}

function Vitals({ stats, compact }: { stats: CharacterSheetStats; compact: boolean }) {
  const translateUi = useUiTranslation("sharedUi");
  const speedText = stats.speedDisplay?.trim() || (stats.speed == null ? "--" : `${stats.speed} ft.`);
  const hpText = Number.isFinite(stats.hpCur) && Number.isFinite(stats.hpMax) && stats.hpMax > 0 ? `${stats.hpCur} / ${stats.hpMax}` : "--";
  const tempHp = Number(stats.tempHp ?? 0) || 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 120 : 140}px, 1fr))`,
        borderRadius: 12,
        border: `1px solid ${C.panelBorder}`,
        background: C.panelBg,
        overflow: "hidden",
      }}
    >
      <StatBar compact={compact} icon={<IconAC size={14} />} label={translateUi("Armor Class")} value={Number.isFinite(stats.ac) ? stats.ac : "--"} />
      <StatBar
        compact={compact}
        icon={<IconHP size={14} />}
        label={translateUi("Hit Points")}
        value={
          <>
            {hpText}
            {tempHp > 0 && <span style={{ color: C.highlight, fontSize: "var(--fs-small)", marginLeft: 4 }}>+{tempHp}t</span>}
          </>
        }
      />
      <StatBar compact={compact} icon={<IconSpeed size={14} />} label={translateUi("Speed")} value={speedText} />
    </div>
  );
}

function DetailLines({ infoLines, compact }: { infoLines?: Array<{ label: string; value: string }>; compact: boolean }) {
  const translateUi = useUiTranslation("sharedUi");
  const [open, setOpen] = React.useState(true);
  const lines = (infoLines ?? []).filter((line) => line.value?.trim() && !["--", "—"].includes(line.value.trim()));
  if (lines.length === 0) return null;
  return (
    <div style={{ border: `1px solid ${C.panelBorder}`, borderRadius: 12, background: C.panelBg, overflow: "hidden" }}>
      <div style={{ padding: compact ? "7px 10px" : "8px 12px" }}>
        <StatSectionTitle collapsed={!open} onToggle={() => setOpen((value) => !value)} style={{ width: "100%", marginBottom: 0 }}>
          {translateUi("Details")}
        </StatSectionTitle>
      </div>
      {open && (
        <div style={{ padding: compact ? "0 10px 8px" : "0 12px 10px", display: "grid", gap: 4 }}>
          {lines.map((line) => (
            <div key={line.label} style={{ display: "flex", gap: 6, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
              <span style={{ color: C.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{line.label}</span>
              <span style={{ color: C.text }}>{line.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Vitals, ability scores with saves, and a collapsible list of details (senses, languages...).
 * Used by monster stat blocks and the DM's combatant details.
 */
export function CharacterSheetPanel(props: { stats: CharacterSheetStats; compact?: boolean; hideVitals?: boolean }) {
  const compact = props.compact ?? false;
  return (
    <div style={{ display: "grid", gap: compact ? 8 : 10 }}>
      {!props.hideVitals && <Vitals stats={props.stats} compact={compact} />}
      <div style={{ borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, padding: compact ? "6px 10px" : "8px 12px" }}>
        <AbilityScoresCompact
          scores={props.stats.abilities}
          saves={props.stats.saves}
          compact={compact}
          accentColor={C.colorMagic}
          mutedColor={C.muted}
          textColor={C.text}
          pillBackground={withAlpha(C.shadow, 0.5)}
          pillBorderColor={C.panelBorder}
        />
      </div>
      <DetailLines infoLines={props.stats.infoLines} compact={compact} />
    </div>
  );
}

/** A bordered, collapsible section of a stat block (Traits, Actions, Spells...). */
export function MonsterSectionPanel(props: {
  title: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = React.useState(props.defaultOpen ?? true);
  return (
    <div style={{ borderRadius: 12, border: `1px solid ${C.panelBorder}`, background: C.panelBg, overflow: "hidden" }}>
      <div style={{ padding: "10px 12px 8px" }}>
        <StatSectionTitle collapsed={!open} onToggle={() => setOpen((value) => !value)} actions={props.actions}>
          {props.title}
        </StatSectionTitle>
      </div>
      {open ? (
        <div style={{ padding: "0 12px 12px", display: "grid", gap: 8 }}>
          {props.children ?? (props.emptyText ? <div style={{ color: C.muted, fontSize: "var(--fs-medium)" }}>{props.emptyText}</div> : null)}
        </div>
      ) : null}
    </div>
  );
}
