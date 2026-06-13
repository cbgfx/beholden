import React from "react";
import { C, withAlpha } from "@/lib/theme";
import { IconDice } from "@/icons";

function rollAllDice(expr: string): string {
  return expr.replace(/(\d*)d(\d+)/gi, (_, count, sides) => {
    const n = count ? Math.max(0, parseInt(count, 10)) : 1;
    const s = Math.max(1, parseInt(sides, 10));
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Math.floor(Math.random() * s) + 1;
    return String(sum);
  });
}

function evalArith(expr: string): number {
  const tokens: string[] = expr.match(/\d+|[+\-*/()]/g) ?? [];
  if (tokens.length === 0) return 0;
  let pos = 0;

  function parseAddSub(): number {
    let result = parseMulDiv();
    while (pos < tokens.length && (tokens[pos] === "+" || tokens[pos] === "-")) {
      const op = tokens[pos++];
      result = op === "+" ? result + parseMulDiv() : result - parseMulDiv();
    }
    return result;
  }

  function parseMulDiv(): number {
    let result = parsePrimary();
    while (pos < tokens.length && (tokens[pos] === "*" || tokens[pos] === "/")) {
      const op = tokens[pos++];
      const right = parsePrimary();
      result = op === "*" ? result * right : right !== 0 ? Math.floor(result / right) : 0;
    }
    return result;
  }

  function parsePrimary(): number {
    if (tokens[pos] === "(") {
      pos++;
      const result = parseAddSub();
      if (tokens[pos] === ")") pos++;
      return result;
    }
    if (tokens[pos] === "-") {
      pos++;
      return -parsePrimary();
    }
    const value = Number(tokens[pos++]);
    return Number.isFinite(value) ? value : 0;
  }

  try {
    return parseAddSub();
  } catch {
    return 0;
  }
}

function evaluate(expr: string): number {
  return evalArith(rollAllDice(expr));
}

function calculatorButtonStyle(variant: "dice" | "digit" | "op" | "danger" | "roll" = "digit"): React.CSSProperties {
  const palette = {
    dice: { bg: withAlpha(C.accentHl, 0.12), color: C.accentHl },
    digit: { bg: "rgba(255,255,255,0.07)", color: C.text },
    op: { bg: "rgba(251,191,36,0.12)", color: C.colorGold },
    danger: { bg: "rgba(255,91,104,0.14)", color: C.red },
    roll: { bg: C.accent, color: C.bg },
  }[variant];

  return {
    border: "none",
    borderRadius: 8,
    background: palette.bg,
    color: palette.color,
    minHeight: 48,
    fontWeight: 800,
    fontSize: variant === "dice" ? 13 : 16,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

export function DiceCalculatorModal(props: { isOpen: boolean; onClose: () => void }) {
  const [expr, setExpr] = React.useState("");
  const [result, setResult] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!props.isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [props.isOpen]);

  if (!props.isOpen) return null;

  function append(value: string) {
    setResult(null);
    setExpr((prev) => prev + value);
    inputRef.current?.focus();
  }

  function roll() {
    if (!expr.trim()) return;
    setResult(evaluate(expr));
  }

  function keyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      roll();
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  }

  const button = (label: string, onClick: () => void, variant?: Parameters<typeof calculatorButtonStyle>[0], style?: React.CSSProperties) => (
    <button key={label} type="button" onClick={onClick} style={{ ...calculatorButtonStyle(variant), ...style }}>
      {label}
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dice Calculator"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(3, 7, 18, 0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(360px, 100%)",
          border: `1px solid ${C.panelBorder}`,
          borderRadius: 12,
          background: "#111827",
          boxShadow: "0 24px 90px rgba(0,0,0,0.72)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${C.panelBorder}` }}>
          <IconDice size={24} />
          <div style={{ flex: 1, fontWeight: 900, color: C.text }}>Dice Calculator</div>
          <button type="button" onClick={props.onClose} style={{ ...calculatorButtonStyle("digit"), minHeight: 34, padding: "0 12px" }}>
            Close
          </button>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.panelBorder}`, minHeight: 78 }}>
          <input
            ref={inputRef}
            value={expr}
            onChange={(e) => {
              setResult(null);
              setExpr(e.target.value);
            }}
            onKeyDown={keyDown}
            placeholder="enter expression..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: C.bg,
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 8,
              color: C.text,
              outline: "none",
              padding: "10px 12px",
              fontSize: 15,
            }}
          />
          {result !== null && <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: C.accent }}>= {result}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4, padding: 12 }}>
          {button("d2", () => append("d2"), "dice")}
          {button("d4", () => append("d4"), "dice")}
          {button("d6", () => append("d6"), "dice")}
          {button("Del", () => { setResult(null); setExpr((prev) => prev.slice(0, -1)); }, "danger")}
          {button("d8", () => append("d8"), "dice")}
          {button("d10", () => append("d10"), "dice")}
          {button("d12", () => append("d12"), "dice")}
          {button("/", () => append("/"), "op")}
          {button("d20", () => append("d20"), "dice")}
          {button("d100", () => append("d100"), "dice")}
          {button("d", () => append("d"), "dice")}
          {button("*", () => append("*"), "op")}
          {["7", "8", "9"].map((n) => button(n, () => append(n)))}
          {button("-", () => append("-"), "op")}
          {["4", "5", "6"].map((n) => button(n, () => append(n)))}
          {button("+", () => append("+"), "op")}
          {["1", "2", "3"].map((n) => button(n, () => append(n)))}
          {button("Roll", roll, "roll", { gridRow: "6 / span 2", gridColumn: 4 })}
          {button("0", () => append("0"))}
          {button("(", () => append("("), "op")}
          {button(")", () => append(")"), "op")}
        </div>
      </div>
    </div>
  );
}
