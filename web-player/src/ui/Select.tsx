import React from "react";
import { C } from "@/lib/theme";

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, ...rest } = props;
  return (
    <select
      {...rest}
      style={{
        background: C.bg,
        color: C.text,
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 8,
        padding: "7px 8px",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: "pointer",
        outline: "none",
        appearance: "auto",
        ...style,
      }}
    />
  );
}
