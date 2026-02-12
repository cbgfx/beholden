import React from "react";
import { theme } from "../../app/theme/theme";

type OptionItem = {
  value: string;
  label: string;
  disabled?: boolean;
};

function extractOptions(children: React.ReactNode): OptionItem[] {
  const nodes = React.Children.toArray(children) as any[];
  const out: OptionItem[] = [];

  for (const n of nodes) {
    if (!React.isValidElement(n)) continue;

    if ((n.type as any) === "option") {
      const value = String((n.props as any).value ?? "");
      const label = String((n.props as any).children ?? "");
      const disabled = Boolean((n.props as any).disabled ?? false);
      out.push({ value, label, disabled });
      continue;
    }

    if ((n.type as any) === "optgroup") {
      const groupChildren = React.Children.toArray((n.props as any).children) as any[];
      for (const gc of groupChildren) {
        if (!React.isValidElement(gc)) continue;
        if ((gc.type as any) !== "option") continue;
        const value = String((gc.props as any).value ?? "");
        const label = String((gc.props as any).children ?? "");
        const disabled = Boolean((gc.props as any).disabled ?? false);
        out.push({ value, label, disabled });
      }
    }
  }

  return out;
}

/**
 * Custom Select
 * - Fully themed (no OS grey <option> rendering)
 * - Keeps a hidden native <select> for compatibility
 * - Click-outside closes
 */
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { children, value, defaultValue, onChange, disabled, style, title, ...rest } = props;

  const options = React.useMemo(() => extractOptions(children), [children]);

  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = React.useState<string>(() => String(defaultValue ?? options[0]?.value ?? ""));
  const selectedValue = String(isControlled ? value : internalValue);

  const selectedLabel = options.find((o) => o.value === selectedValue)?.label ?? options[0]?.label ?? "";

  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const commitValue = (next: string) => {
    if (!isControlled) setInternalValue(next);
    onChange?.({ target: { value: next }, currentTarget: { value: next } } as any);
  };

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        minWidth: 140,
        ...(style ?? {})
      }}
      title={title}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: theme.radius.control,
          border: `2px solid ${theme.colors.accent}`,
          background: theme.colors.inputBg,
          color: theme.colors.text,
          fontWeight: 800,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          opacity: disabled ? 0.55 : 1
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedLabel || "Select…"}
        </span>
        <span style={{ opacity: 0.8, fontWeight: 900 }}>▾</span>
      </button>

      {open && !disabled ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            borderRadius: theme.radius.control,
            border: `2px solid ${theme.colors.accent}`,
            background: theme.colors.panelBg,
            boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
            overflow: "hidden",
            maxHeight: 280
          }}
        >
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {options.map((o) => {
              const isSel = o.value === selectedValue;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return;
                    commitValue(o.value);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: isSel ? theme.colors.accent : "transparent",
                    color: isSel ? "#000" : theme.colors.text,
                    fontWeight: isSel ? 900 : 700,
                    cursor: o.disabled ? "not-allowed" : "pointer",
                    opacity: o.disabled ? 0.45 : 1
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <select
        {...rest}
        value={selectedValue}
        onChange={(e) => commitValue(e.target.value)}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1
        }}
      >
        {children}
      </select>
    </div>
  );
}
