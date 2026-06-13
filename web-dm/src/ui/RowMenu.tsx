import React from "react";
import { theme, withAlpha } from "@/theme/theme";

export type RowMenuItem = {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
};

export function RowMenu(props: { items: RowMenuItem[] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        title="More actions"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          borderRadius: 8,
          border: `1px solid ${theme.colors.panelBorder}`,
          background: "transparent",
          color: theme.colors.muted,
          cursor: "pointer",
          fontSize: "var(--fs-body)",
          fontWeight: 900,
          letterSpacing: 1,
          lineHeight: 1,
        }}
      >
        ···
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 200,
            minWidth: 140,
            borderRadius: 10,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: theme.colors.modalBg,
            boxShadow: `0 8px 24px ${withAlpha(theme.colors.shadowColor, 0.5)}`,
            overflow: "hidden",
          }}
        >
          {props.items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick(); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "9px 14px",
                border: "none",
                background: "transparent",
                color: item.danger ? theme.colors.red : theme.colors.text,
                fontSize: "var(--fs-medium)",
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
                borderTop: i > 0 ? `1px solid ${theme.colors.panelBorder}` : "none",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = withAlpha(theme.colors.panelBorder, 0.3); }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {item.icon ? <span style={{ opacity: 0.8 }}>{item.icon}</span> : null}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
