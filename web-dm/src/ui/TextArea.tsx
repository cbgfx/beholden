
import React from "react";
import { theme } from "@/theme/theme";

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: theme.radius.control,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.inputBg,
        color: theme.colors.text,
        outline: "none",
        minHeight: 140,
        resize: "vertical",
        ...(props.style ?? {})
      }}
    />
  );
}
