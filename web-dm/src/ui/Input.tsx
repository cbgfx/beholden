import React from "react";
import { theme } from "@/theme/theme";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: theme.radius.control,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.inputBg,
        color: theme.colors.text,
        fontSize: "var(--fs-medium)",
        outline: "none",
        transition: "border-color 120ms ease",
        ...(props.style ?? {}),
      }}
    />
  );
}
