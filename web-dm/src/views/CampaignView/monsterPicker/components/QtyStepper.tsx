import * as React from "react";
import { theme } from "@/theme/theme";
import { IconButton } from "@/ui/IconButton";

export function QtyStepper(props: { value: number; onChange: (n: number) => void }) {
  const v = props.value ?? 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <IconButton
        title="Decrease"
        variant="ghost"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onChange(Math.max(1, v - 1));
        }}
      >
        <span style={{ fontWeight: 900, fontSize: "var(--fs-large)", lineHeight: 0 }}>–</span>
      </IconButton>

      <div
        style={{
          minWidth: 26,
          textAlign: "center",
          color: theme.colors.text,
          fontWeight: 900
        }}
        title="Quantity"
      >
        {v}
      </div>

      <IconButton
        title="Increase"
        variant="ghost"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          props.onChange(Math.min(20, v + 1));
        }}
      >
        <span style={{ fontWeight: 900, fontSize: "var(--fs-large)", lineHeight: 0 }}>+</span>
      </IconButton>
    </div>
  );
}
