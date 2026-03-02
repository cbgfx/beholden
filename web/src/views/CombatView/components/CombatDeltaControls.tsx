import * as React from "react";
import { theme } from "@/theme/theme";
import { IconAttack, IconHeal, IconConditions, IconDice } from "@/icons";
import { rollDiceExpr, hasDiceTerm } from "@/views/CombatView/utils/dice";

type Props = {
  value: string;
  targetId?: string | null;
  disabled?: boolean;
  onChange: (v: string) => void;
  onApplyDamage: () => void;
  onApplyHeal: () => void;
  onOpenConditions?: () => void;
};

/**
 * Sanitise input to digits, 'd/D', '+', '-'.
 * Allows full dice expressions like "2d6+3", "1d4+6d8+3d4", "+10", "-2d8".
 */
function normalizeDeltaInput(raw: string): string {
  const s = String(raw ?? "");
  // Keep digits, 'd'/'D', '+', '-' — strip everything else.
  return s.replace(/[^0-9dD+\-]/g, "");
}

function HexButton({
  title,
  disabled,
  onClick,
  variant,
  children
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  variant: "damage" | "heal" | "neutral" | "dice";
  children: React.ReactNode;
}) {
  const bg =
    variant === "damage"   ? theme.colors.red
    : variant === "heal"   ? theme.colors.green
    : variant === "dice"   ? theme.colors.accentPrimary
    : theme.colors.accentPrimary;
  const fg = theme.colors.text;

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 56,
        height: 52,
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        border: `2px solid ${theme.colors.panelBorder}`,
        background: bg,
        color: fg,
        clipPath:
          "polygon(25% 4%, 75% 4%, 98% 50%, 75% 96%, 25% 96%, 2% 50%)",
        boxShadow: disabled
          ? "none"
          : `0 2px 0 0 ${theme.colors.panelBorder}, 0 0 0 2px rgba(0,0,0,0.08) inset`,
        animation: disabled ? "none" : "beholdenHexPulse 2.2s ease-in-out infinite",
        opacity: disabled ? 0.5 : 1,
        transition: "transform 80ms ease, filter 120ms ease",
        userSelect: "none"
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
      }}
    >
      {children}
    </button>
  );
}

export function CombatDeltaControls(props: Props) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const disabled = Boolean(props.disabled);
  const tooltip = disabled ? "Select a target" : "";
  const hasConditions = Boolean(props.onOpenConditions);

  // Show dice roll flash briefly after a preview roll.
  const [lastRoll, setLastRoll] = React.useState<number | null>(null);
  const flashRef = React.useRef<number | null>(null);

  const isDiceExpr = hasDiceTerm(props.value);

  // Roll the current expression and put the result back in the field.
  const handleRollPreview = React.useCallback(() => {
    if (!props.value.trim()) return;
    const result = rollDiceExpr(props.value);
    if (result <= 0) return;
    props.onChange(String(result));
    setLastRoll(result);
    if (flashRef.current) window.clearTimeout(flashRef.current);
    flashRef.current = window.setTimeout(() => setLastRoll(null), 1600);
    inputRef.current?.focus();
  }, [props.value, props.onChange]);

  // When a new target is selected, snap focus back to the input for fast table flow.
  React.useEffect(() => {
    if (disabled) return;
    if (!props.targetId) return;
    const raf = requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== inputRef.current) {
        const tag = (el.tagName || "").toUpperCase();
        const isTextField = tag === "INPUT" || tag === "TEXTAREA" || (el as any).isContentEditable;
        if (isTextField) return;
      }
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [props.targetId, disabled]);

  return (
    <>
      <style>
        {`@keyframes beholdenHexPulse {
            0% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
            50% { filter: drop-shadow(0 0 10px rgba(255,255,255,0.10)); }
            100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
          }
          @keyframes beholdenRollFlash {
            0%   { color: ${theme.colors.accentHighlight}; transform: scale(1.08); }
            60%  { color: ${theme.colors.accentHighlight}; transform: scale(1.08); }
            100% { color: inherit; transform: scale(1); }
          }`}
      </style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "10px 8px",
          borderRadius: 14,
          border: `1px solid ${theme.colors.panelBorder}`,
          background: theme.colors.panelBg
        }}
      >
        {/* 🎲 Dice preview button — left of Damage */}
        <HexButton
          title={disabled ? tooltip : isDiceExpr ? "Roll dice — preview result in field" : "Type a dice expression (e.g. 2d6+3) to roll"}
          disabled={disabled || !props.value.trim()}
          onClick={handleRollPreview}
          variant="dice"
        >
          <IconDice size={22} title="Roll Dice" />
        </HexButton>

        <HexButton
          title={disabled ? tooltip : "Apply damage"}
          disabled={disabled}
          onClick={() => {
            props.onApplyDamage();
            inputRef.current?.focus();
          }}
          variant="damage"
        >
          <IconAttack size={22} title="Damage" />
        </HexButton>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <input
            ref={inputRef}
            data-allow-combat-nav="true"
            value={props.value}
            inputMode="text"
            placeholder="1d6+2/+10"
            onChange={(e) => props.onChange(normalizeDeltaInput(e.target.value))}
            onKeyDown={(e) => {
              const k = String(e.key || "").toLowerCase();
              const allowHotkey = !e.altKey && !e.ctrlKey && !e.metaKey && (k === "n" || k === "p");
              if (!allowHotkey) e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                // If it's a dice expression, roll first then apply damage.
                if (hasDiceTerm(props.value)) {
                  handleRollPreview();
                  // Apply on next tick so the rolled value is in place.
                  setTimeout(() => props.onApplyDamage(), 0);
                } else {
                  props.onApplyDamage();
                }
              }
              if (e.key === "Escape") {
                e.preventDefault();
                props.onChange("");
              }
            }}
            disabled={disabled}
            title={disabled ? tooltip : "Enter: damage • +N heals • -N damages • 2d6+3 supported"}
            style={{
              width: 140,
              textAlign: "center",
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: theme.colors.panelBg,
              color: lastRoll !== null ? theme.colors.accentHighlight : theme.colors.text,
              fontWeight: 900,
              fontSize: "var(--fs-title)",
              outline: "none",
              transition: "color 200ms ease",
              animation: lastRoll !== null ? "beholdenRollFlash 1.6s ease forwards" : "none",
            }}
          />
          {/* Tiny hint when a dice expression is typed */}
          {isDiceExpr && !disabled && (
            <span style={{ fontSize: "var(--fs-tiny)", color: theme.colors.muted, pointerEvents: "none" }}>
              🎲 click dice to preview
            </span>
          )}
        </div>

        <HexButton
          title={disabled ? tooltip : "Apply heal"}
          disabled={disabled}
          onClick={() => {
            props.onApplyHeal();
            inputRef.current?.focus();
          }}
          variant="heal"
        >
          <IconHeal size={22} title="Heal" />
        </HexButton>

        {hasConditions ? (
          <HexButton
            title={disabled ? tooltip : "Conditions"}
            disabled={disabled}
            onClick={() => {
              props.onOpenConditions?.();
              inputRef.current?.focus();
            }}
            variant="neutral"
          >
            <IconConditions size={22} title="Conditions" />
          </HexButton>
        ) : null}
      </div>
    </>
  );
}
