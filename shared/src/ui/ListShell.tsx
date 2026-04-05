import React from "react";

export const ListShell = React.forwardRef<HTMLDivElement, {
  children: React.ReactNode;
  borderColor?: string;
  radius?: number;
  style?: React.CSSProperties;
}>((props, ref) => {
  const { children, borderColor = "rgba(255,255,255,0.12)", radius = 12, style } = props;
  return (
    <div
      ref={ref}
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        border: `1px solid ${borderColor}`,
        borderRadius: radius,
        ...style,
      }}
    >
      {children}
    </div>
  );
});

ListShell.displayName = "ListShell";
