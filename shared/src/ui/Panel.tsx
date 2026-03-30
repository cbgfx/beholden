import React from "react";

export function Panel(props: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  storageKey?: string;
  defaultOpen?: boolean;
  titleColor?: string;
  borderColor?: string;
  background?: string;
  radius?: number;
  padding?: string | number;
  titleFontSize?: string | number;
  titleFontWeight?: number;
}) {
  const {
    title,
    actions,
    children,
    style,
    bodyStyle,
    storageKey,
    defaultOpen = true,
    titleColor = "#e8edf5",
    borderColor = "rgba(255,255,255,0.13)",
    background = "rgba(255,255,255,0.055)",
    radius = 14,
    padding = "8px 10px",
    titleFontSize = "var(--fs-body)",
    titleFontWeight = 900,
  } = props;

  const [open, setOpen] = React.useState(() => {
    if (!storageKey) return defaultOpen;
    try {
      const v = localStorage.getItem(`panel:${storageKey}`);
      if (v !== null) return v !== "0";
    } catch {}
    return defaultOpen;
  });

  const isCollapsible = Boolean(storageKey);

  const toggle = React.useCallback(() => {
    if (!isCollapsible || !storageKey) return;
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`panel:${storageKey}`, next ? "1" : "0");
      } catch {}
      return next;
    });
  }, [isCollapsible, storageKey]);

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: radius,
        padding,
        background,
        ...style,
      }}
    >
      <div
        onClick={isCollapsible ? toggle : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          cursor: isCollapsible ? "pointer" : undefined,
          userSelect: isCollapsible ? "none" : undefined,
        }}
      >
        <div
          style={{
            margin: 0,
            color: titleColor,
            fontWeight: titleFontWeight,
            fontSize: titleFontSize,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 0,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          {actions ? (
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {actions}
            </div>
          ) : null}
          {isCollapsible ? (
            <span
              style={{
                color: titleColor,
                fontSize: "var(--fs-tiny)",
                lineHeight: 1,
                transform: open ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 120ms ease",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 10,
              }}
            >
              ▼
            </span>
          ) : null}
        </div>
      </div>
      {open ? <div style={{ marginTop: 8, ...bodyStyle }}>{children}</div> : null}
    </div>
  );
}
