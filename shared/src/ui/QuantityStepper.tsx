import React from "react";

export function QuantityStepper({
  value,
  onDecrement,
  onIncrement,
  decrementDisabled = false,
  valuePrefix = "",
  theme,
  buttonClassName,
}: {
  value?: number | string | null;
  onDecrement?: () => void;
  onIncrement?: () => void;
  decrementDisabled?: boolean;
  valuePrefix?: string;
  buttonClassName?: string;
  theme?: {
    buttonBackground?: string;
    buttonBorder?: string;
    buttonColor?: string;
    valueColor?: string;
    disabledOpacity?: number;
    buttonSize?: number;
    borderRadius?: number;
    fontSize?: string | number;
    gap?: number;
    valueMinWidth?: number;
  };
}) {
  const buttonSize = theme?.buttonSize ?? 20;
  const borderRadius = theme?.borderRadius ?? 4;
  const fontSize = theme?.fontSize ?? "var(--fs-subtitle)";
  const gap = theme?.gap ?? 4;
  const valueMinWidth = theme?.valueMinWidth ?? 20;
  const buttonStyle: React.CSSProperties = {
    background: theme?.buttonBackground ?? "rgba(255,255,255,0.07)",
    border: `1px solid ${theme?.buttonBorder ?? "rgba(255,255,255,0.14)"}`,
    borderRadius,
    width: buttonSize,
    height: buttonSize,
    color: theme?.buttonColor ?? "var(--c-muted)",
    cursor: "pointer",
    fontSize,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap, flexShrink: 0 }}>
      {onDecrement ? (
        <button
          className={buttonClassName}
          type="button"
          onClick={onDecrement}
          disabled={decrementDisabled}
          style={{
            ...buttonStyle,
            ...(decrementDisabled ? { opacity: theme?.disabledOpacity ?? 0.3 } : {}),
          }}
        >
          -
        </button>
      ) : null}
      {value !== undefined && value !== null ? (
        <span
          style={{
            fontSize: "var(--fs-small)",
            fontWeight: 700,
            color: theme?.valueColor ?? "var(--c-muted)",
            minWidth: valueMinWidth,
            textAlign: "center",
          }}
        >
          {valuePrefix}{value}
        </span>
      ) : null}
      {onIncrement ? <button className={buttonClassName} type="button" onClick={onIncrement} style={buttonStyle}>+</button> : null}
    </div>
  );
}
