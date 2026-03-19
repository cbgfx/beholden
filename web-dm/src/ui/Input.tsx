
import React from "react";
import { theme } from "@/theme/theme";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: theme.radius.control,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.inputBg,
        color: theme.colors.text,
        outline: "none",
        ...(props.style ?? {})
      }}
    />
  );
}
