import React from "react";

type ListShellProps = React.HTMLAttributes<HTMLDivElement> & {
  borderColor?: string;
  radius?: number;
};

export const ListShell = React.forwardRef<HTMLDivElement, ListShellProps>((props, ref) => {
  const {
    children,
    borderColor = "rgba(255,255,255,0.12)",
    radius = 12,
    style,
    ...rest
  } = props;
  return (
    <div
      ref={ref}
      {...rest}
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
