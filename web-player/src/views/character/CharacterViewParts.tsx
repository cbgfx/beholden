import React, { useEffect, useState } from "react";
import { C, withAlpha } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import { FormField, Input, NoteRow as SharedNoteRow, SectionTitle as SharedSectionTitle, TextArea, accentButtonStyle, ghostButtonStyle } from "@beholden/shared/ui";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { ClassFeatureEntry, PlayerNote } from "@/views/character/CharacterSheetTypes";

export function Tooltip({ text, children, multiline }: { text: string; children: React.ReactNode; multiline?: boolean }) {
  const [visible, setVisible] = useState(false);

  if (!text) return <>{children}</>;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 5px)", left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(10,15,28,0.97)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 6, padding: "6px 10px",
          fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.85)",
          whiteSpace: multiline ? "normal" : "nowrap",
          maxWidth: multiline ? 280 : undefined,
          zIndex: 200, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          lineHeight: 1.5,
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

export function Wrap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", overflowX: wide ? "auto" : "hidden", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: wide ? "none" : 1060, minWidth: wide ? 1760 : "auto", margin: "0 auto", padding: wide ? "16px" : "28px 20px" }}>
        {children}
      </div>
    </div>
  );
}

const PANEL_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 12, padding: "14px 16px",
};

export function Panel({ children }: { children: React.ReactNode }) {
  return <div style={PANEL_STYLE}>{children}</div>;
}

export function PanelTitle({ children, color, actions, style }: { children: React.ReactNode; color: string; actions?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <SharedSectionTitle color={color} actions={actions} style={style}>
      {children}
    </SharedSectionTitle>
  );
}

export function CollapsiblePanel({
  title, color, actions, children, storageKey, defaultOpen = true,
}: {
  title: React.ReactNode;
  color: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  storageKey: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(() => {
    try {
      const v = localStorage.getItem(`panel:${storageKey}`);
      if (v !== null) return v !== "0";
    } catch { /* ignore */ }
    return defaultOpen;
  });

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(`panel:${storageKey}`, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div style={PANEL_STYLE}>
      <div
        onClick={toggle}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer", userSelect: "none",
          marginBottom: open ? 10 : 0,
        }}
      >
        <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color, display: "flex", alignItems: "center", gap: 6 }}>
          {title}
        </span>
        <div style={{ flex: 1, height: 1, background: `${color}30` }} />
        {actions && (
          <div style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>{actions}</div>
        )}
        <span style={{
          color, fontSize: "var(--fs-tiny)", lineHeight: 1,
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          transition: "transform 120ms ease",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 10, flexShrink: 0,
        }}>▼</span>
      </div>
      {open && children}
    </div>
  );
}

export function ProfDot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: filled ? color : "transparent",
      border: `1.5px solid ${filled ? color : "rgba(255,255,255,0.2)"}`,
    }} />
  );
}

export function HexBtn({ variant, active, title, disabled, onClick, children }: {
  variant: "damage" | "heal" | "conditions" | "inspiration";
  active?: boolean;
  title: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const bg = variant === "damage" ? C.red : variant === "heal" ? C.green : variant === "inspiration" ? (active ? "#a855f7" : "#4b2d6b") : "#f59e0b";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 56, height: 52,
        display: "grid", placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "2px solid rgba(255,255,255,0.1)",
        background: bg, color: "#fff",
        clipPath: "polygon(25% 4%, 75% 4%, 98% 50%, 75% 96%, 25% 96%, 2% 50%)",
        boxShadow: disabled ? "none" : active ? "0 0 12px 4px rgba(168,85,247,0.6), 0 2px 0 0 rgba(0,0,0,0.3)" : "0 2px 0 0 rgba(0,0,0,0.3)",
        animation: disabled ? "none" : "playerHexPulse 2.2s ease-in-out infinite",
        opacity: disabled ? 0.4 : variant === "inspiration" && !active ? 0.55 : 1,
        transition: "transform 80ms ease, opacity 150ms ease",
        userSelect: "none",
      }}
      onMouseDown={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
    >
      {children}
    </button>
  );
}

export function MiniStat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      textAlign: "center", padding: "8px 6px", borderRadius: 8,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accent ? accent + "33" : "rgba(255,255,255,0.09)"}`,
    }}>
      <div style={{
        fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.muted, textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 3,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
      }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: "var(--fs-body)", fontWeight: 800, color: accent ?? C.text }}>
        {value}
      </div>
    </div>
  );
}

export function inventoryEquipBtn(active: boolean, color: string): React.CSSProperties {
  return {
    minWidth: 30,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${active ? color : C.panelBorder}`,
    background: active ? withAlpha(color, 0.14) : "transparent",
    color: active ? color : C.muted,
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  };
}

export function panelHeaderAddBtn(color: string): React.CSSProperties {
  return {
    minWidth: 32,
    height: 32,
    padding: "0 9px",
    borderRadius: 10,
    border: `1px solid ${withAlpha(color, 0.38)}`,
    background: withAlpha(color, 0.18),
    color,
    cursor: "pointer",
    fontSize: "var(--fs-title)",
    lineHeight: 1,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 6px 18px ${withAlpha(color, 0.12)}`,
  };
}

export function addBtnStyle(accent: string): React.CSSProperties {
  return {
    background: accent, color: "#000",
    border: "none", borderRadius: 7,
    padding: "6px 14px", fontSize: "var(--fs-subtitle)",
    fontWeight: 700, cursor: "pointer",
  };
}

export const cancelBtnStyle: React.CSSProperties = {
  ...ghostButtonStyle({
    textColor: C.muted,
    borderColor: "rgba(255,255,255,0.14)",
    padding: "6px 14px",
    fontSize: "var(--fs-subtitle)",
    borderRadius: 7,
  }),
};

export const inventoryCheckboxLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: "var(--fs-small)",
  color: C.muted,
};

export const inventoryPickerColumnStyle: React.CSSProperties = {
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  padding: 12,
  gap: 10,
};

export const inventoryPickerListStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 220,
  overflowY: "auto",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
};

export const inventoryPickerDetailStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 260,
  overflowY: "auto",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
  padding: 12,
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
  fontSize: "var(--fs-subtitle)",
  color: C.text,
};

export function inventoryRarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common": return C.muted;
    case "uncommon": return "#1eff00";
    case "rare": return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact": return "#e6cc80";
    default: return C.muted;
  }
}


export function miniPillBtn(enabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: `1px solid ${enabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
    background: enabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
    color: enabled ? C.text : C.muted,
    cursor: enabled ? "pointer" : "default",
    fontSize: "var(--fs-body)",
    fontWeight: 800,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

export function restBtnStyle(color: string): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${withAlpha(color, 0.45)}`,
    background: withAlpha(color, 0.12),
    color,
    cursor: "pointer",
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    minWidth: 102,
  };
}

export function NoteItem(props: {
  note: PlayerNote;
  expanded: boolean;
  accentColor: string;
  hideTitle?: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { note, expanded, accentColor, hideTitle } = props;
  const preview = (note.text ?? "").trim().split(/\r?\n/).find(Boolean) ?? "";
  const label = hideTitle ? (preview || note.title || "Untitled") : (note.title || "Untitled");
  return <SharedNoteRow title={label} text={note.text} expanded={expanded} accentColor={accentColor} textColor={C.text} mutedColor={C.muted} deleteColor={C.red} onToggle={props.onToggle} onEdit={props.onEdit} onDelete={props.onDelete} />;
}

export function ClassFeatureItem(props: {
  feature: ClassFeatureEntry;
  expanded: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  const { feature, expanded, accentColor } = props;
  return (
    <div style={{
      padding: "5px 6px",
      borderRadius: 7,
      background: expanded ? withAlpha(accentColor, 0.07) : "transparent",
      border: `1px solid ${expanded ? withAlpha(accentColor, 0.22) : "transparent"}`,
    }}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onToggle(); }}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          fontWeight: 700,
          color: C.text,
          fontSize: "var(--fs-subtitle)",
          lineHeight: 1.4,
        }}
      >
        {feature.name}
      </button>
      {expanded && feature.text && (
        <div style={{ marginTop: 6, color: C.muted, fontSize: "var(--fs-small)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {feature.text}
        </div>
      )}
      {expanded && feature.preparedSpellProgression?.length ? (
        <PreparedSpellProgressionBlock tables={feature.preparedSpellProgression} accentColor={accentColor} />
      ) : null}
    </div>
  );
}

export function PreparedSpellProgressionBlock(props: {
  tables: PreparedSpellProgressionTable[];
  accentColor?: string;
  compact?: boolean;
}) {
  const { tables, accentColor = C.accentHl, compact = false } = props;
  if (!tables.length) return null;

  return (
    <div style={{ marginTop: compact ? 8 : 10, display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      {tables.map((table, tableIndex) => (
        <div
          key={`${table.label ?? "default"}:${table.levelLabel}:${table.spellLabel}:${tableIndex}`}
          style={{
            borderRadius: 8,
            border: `1px solid ${withAlpha(accentColor, 0.22)}`,
            background: withAlpha(accentColor, 0.06),
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: compact ? "6px 8px" : "7px 10px",
              borderBottom: `1px solid ${withAlpha(accentColor, 0.18)}`,
              color: accentColor,
              fontSize: "var(--fs-small)",
              fontWeight: 800,
            }}
          >
            {table.label?.trim() || "Prepared Spells"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(82px, auto) minmax(0, 1fr)" }}>
            <div
              style={{
                padding: compact ? "6px 8px" : "7px 10px",
                borderRight: `1px solid ${withAlpha(accentColor, 0.16)}`,
                color: C.muted,
                fontSize: "var(--fs-small)",
                fontWeight: 700,
              }}
            >
              {table.levelLabel}
            </div>
            <div style={{ padding: compact ? "6px 8px" : "7px 10px", color: C.muted, fontSize: "var(--fs-small)", fontWeight: 700 }}>
              {table.spellLabel}
            </div>
          </div>
          {table.rows.map((row) => (
            <div
              key={`${table.label ?? "default"}:${row.level}:${row.spells.join("|")}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(82px, auto) minmax(0, 1fr)",
                borderTop: `1px solid ${withAlpha(accentColor, 0.12)}`,
              }}
            >
              <div
                style={{
                  padding: compact ? "6px 8px" : "7px 10px",
                  borderRight: `1px solid ${withAlpha(accentColor, 0.12)}`,
                  color: C.text,
                  fontSize: "var(--fs-small)",
                  fontWeight: 700,
                }}
              >
                {row.level}
              </div>
              <div style={{ padding: compact ? "6px 8px" : "7px 10px", color: C.text, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>
                {row.spells.join(", ")}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function NoteEditDrawer(props: {
  scope: "player" | "shared";
  note: PlayerNote | null;
  accentColor: string;
  onSave: (title: string, text: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const color = props.scope === "shared" ? C.green : props.accentColor;
  const label = props.scope === "shared" ? "Shared Note" : "Player Note";
  const [title, setTitle] = useState(props.note?.title ?? "");
  const [text, setText] = useState(props.note?.text ?? "");

  useEffect(() => {
    setTitle(props.note?.title ?? "");
    setText(props.note?.text ?? "");
  }, [props.note]);

  return (
    <RightDrawer
      onClose={props.onClose}
      width="min(400px, 90vw)"
      title={
        <span style={{ fontWeight: 900, fontSize: "var(--fs-subtitle)", letterSpacing: "0.08em", textTransform: "uppercase", color }}>
          {props.note ? `Edit ${label}` : `New ${label}`}
        </span>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            {props.note && props.onDelete && (
              <button onClick={props.onDelete} style={{ background: "rgba(255,93,93,0.12)", border: "1px solid rgba(255,93,93,0.3)", borderRadius: 8, color: C.red, cursor: "pointer", padding: "8px 16px", fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={props.onClose} style={ghostButtonStyle({ textColor: C.muted, borderColor: "rgba(255,255,255,0.16)", padding: "8px 16px", fontSize: "var(--fs-subtitle)" })}>
              Cancel
            </button>
            <button onClick={() => props.onSave(title.trim() || "Note", text)} style={accentButtonStyle(color, { padding: "8px 16px", fontSize: "var(--fs-subtitle)" })}>
              Save
            </button>
          </div>
        </div>
      }
    >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FormField label="Title" labelStyle={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              theme={{ radius: 6, panelBorder: "rgba(255,255,255,0.12)", inputBg: "rgba(255,255,255,0.06)", text: C.text }}
              style={{ width: "100%", boxSizing: "border-box", fontSize: "var(--fs-subtitle)", fontFamily: "inherit" }}
            />
          </FormField>
          <FormField label="Text" labelStyle={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write..."
              rows={12}
              theme={{ radius: 6, panelBorder: "rgba(255,255,255,0.12)", inputBg: "rgba(255,255,255,0.06)", text: C.text }}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontSize: "var(--fs-subtitle)", padding: "8px 10px", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </FormField>
        </div>
      </RightDrawer>
    );
  }

