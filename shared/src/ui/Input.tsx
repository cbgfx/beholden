import React from "react";

type SharedInputTheme = {
  radius: string | number;
  panelBorder: string;
  inputBg: string;
  text: string;
};

export function Input(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    theme: SharedInputTheme;
  },
) {
  const { theme, style, ...rest } = props;
  return (
    <input
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
        transition: "border-color 120ms ease",
        ...(style ?? {}),
      }}
    />
  );
}
