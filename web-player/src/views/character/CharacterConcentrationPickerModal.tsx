import type React from "react";
import { C } from "@/lib/theme";

export function CharacterConcentrationPickerModal(props: {
  open: boolean;
  accentColor: string;
  currentSpell?: string | null;
  search: string;
  spells: string[];
  loading: boolean;
  loadError: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (spellName: string) => void;
  onClose: () => void;
}) {
  if (!props.open) return null;

  const search = props.search.trim();
  const filteredSpells = search
    ? props.spells.filter((name) => name.toLowerCase().includes(search.toLowerCase()))
    : props.spells;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) props.onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="concentration-picker-title"
        style={{
          background: "#080e18",
          border: `2px solid ${props.accentColor}`,
          borderRadius: 16,
          width: "min(340px, 92vw)",
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 0 40px ${props.accentColor}33, 0 24px 60px rgba(0,0,0,0.85)`,
          overflow: "hidden",
          maxHeight: "80vh",
        }}
      >
        <div style={{ padding: "16px 20px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div
            id="concentration-picker-title"
            style={{
              fontWeight: 900,
              fontSize: "var(--fs-body)",
              color: props.accentColor,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 10,
            }}
          >
            Concentrating on…
          </div>
          <input
            autoFocus
            type="text"
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") props.onClose();
              if (event.key === "Enter" && search) props.onSelect(search);
            }}
            placeholder="Search or type spell name…"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 12px",
              borderRadius: 8,
              border: `1px solid ${props.accentColor}44`,
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: "var(--fs-body)",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ overflowY: "auto", padding: "8px 0" }}>
          {props.loading && (
            <div style={{ padding: "10px 20px", color: C.muted, fontSize: "var(--fs-small)" }}>
              Checking concentration spells…
            </div>
          )}
          {!props.loading && !search && filteredSpells.length === 0 && (
            <div style={{ padding: "10px 20px", color: C.muted, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
              {props.loadError
                ? "Could not load concentration spells. You can still type a spell name."
                : "No concentration spells found. You can still type a spell name."}
            </div>
          )}
          {filteredSpells.length === 0 && search && (
            <button type="button" onClick={() => props.onSelect(search)} style={spellButtonStyle(props.accentColor, true)}>
              Set "{search}"
            </button>
          )}
          {filteredSpells.map((name) => {
            const selected = name === props.currentSpell;
            return (
              <button
                key={name}
                type="button"
                onClick={() => props.onSelect(name)}
                style={spellButtonStyle(selected ? props.accentColor : C.text, selected)}
              >
                {selected ? `✓ ${name}` : name}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "8px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            type="button"
            onClick={props.onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: C.muted,
              fontSize: "var(--fs-small)",
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function spellButtonStyle(color: string, emphasized: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "9px 20px",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    color,
    fontWeight: emphasized ? 800 : 500,
    fontSize: "var(--fs-small)",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}
