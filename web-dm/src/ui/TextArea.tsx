import React from "react";
import { theme } from "@/theme/theme";

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
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
        minHeight: 120,
        resize: "vertical",
        lineHeight: 1.5,
        transition: "border-color 120ms ease",
        ...(props.style ?? {}),
      }}
    />
  );
}
