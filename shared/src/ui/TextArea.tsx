import React from "react";

type SharedInputTheme = {
  radius: string | number;
  panelBorder: string;
  inputBg: string;
  text: string;
};

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    theme: SharedInputTheme;
  },
) {
  const { theme, style, ...rest } = props;
  return (
    <textarea
      {...rest}
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: theme.radius,
        border: `1px solid ${theme.panelBorder}`,
        background: theme.inputBg,
        color: theme.text,
        fontSize: "var(--fs-medium)",
        outline: "none",
        minHeight: 120,
        resize: "vertical",
        lineHeight: 1.5,
        transition: "border-color 120ms ease",
        ...(style ?? {}),
      }}
    />
  );
}
