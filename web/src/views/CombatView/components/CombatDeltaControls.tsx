import * as React from "react";
import { theme } from "@/theme/theme";
import { IconAttack, IconHeal, IconConditions } from "@/icons";

type Props = {
  value: string;
  targetId?: string | null;
  disabled?: boolean;
  onChange: (v: string) => void;
  onApplyDamage: () => void;
  onApplyHeal: () => void;
  onOpenConditions?: () => void;
};

function normalizeDeltaInput(raw: string): string {
  const s = String(raw ?? "");
  if (!s) return "";

  // Keep ONLY a leading sign (+/-) and digits.
  const sign = s[0] === "+" || s[0] === "-" ? s[0] : "";
  const rest = (sign ? s.slice(1) : s).replace(/[^0-9]/g, "");
  // Allow just "+" or "-" as an intermediate state while typing.
  return sign + rest;
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
  variant: "damage" | "heal" | "neutral";
  children: React.ReactNode;
}) {
  const bg =
    variant === "damage"
      ? theme.colors.red
      : variant === "heal"
        ? theme.colors.green
        : theme.colors.accent;
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

  // When a new target is selected, snap focus back to the input for fast table flow.
  React.useEffect(() => {
    if (disabled) return;
    if (!props.targetId) return;
    // Defer to the next frame so we don't fight click focus.
    // IMPORTANT: do NOT steal focus if the user is actively editing another input
    // (e.g. initiative entries). This was causing a "double-click" requirement.
    const raf = requestAnimationFrame(() => {
      const el = document.activeElement as HTMLElement | null;
      // If focus is already on an input/textarea that isn't OUR delta input, back off.
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
      <HexButton
        title={disabled ? tooltip : "Apply damage"}
        disabled={disabled}
        onClick={() => {
          props.onApplyDamage();
          // Keep input focus for rapid entry.
          inputRef.current?.focus();
        }}
        variant="damage"
      >
        <IconAttack size={22} title="Damage" />
      </HexButton>

      <input
        ref={inputRef}
        data-allow-combat-nav="true"
        value={props.value}
        inputMode="numeric"
        placeholder="10 / +10"
        onChange={(e) => props.onChange(normalizeDeltaInput(e.target.value))}
        onKeyDown={(e) => {
          // Keep global combat hotkeys usable (n/p) even when the delta input is focused.
          // Everything else should NOT bubble to the window-level key handler.
          const k = String(e.key || "").toLowerCase();
          const allowHotkey = !e.altKey && !e.ctrlKey && !e.metaKey && (k === "n" || k === "p");
          if (!allowHotkey) e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            props.onApplyDamage();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            props.onChange("");
          }
        }}
        disabled={disabled}
        title={disabled ? tooltip : "Enter: damage • +N heals • -N damages"}
        style={{
          width: 140,
          textAlign: "center",
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${theme.colors.panelBorder}`,
          // Keep the input readable in the dark theme.
          background: theme.colors.panelBg,
          color: theme.colors.text,
          fontWeight: 900,
          fontSize: "var(--fs-title)",
          outline: "none"
        }}
      />

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
            // Keep input focus for rapid entry.
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
