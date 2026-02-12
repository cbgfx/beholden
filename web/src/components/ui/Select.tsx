import React from "react";
import { theme } from "../../app/theme/theme";

type OptionLike = { value: string; label: string; disabled?: boolean };

function toOptionList(children: React.ReactNode): OptionLike[] {
  const out: OptionLike[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    // Support <option> only (keeps Beholden simple and predictable)
    if ((child.type as any) === "option") {
      const value = String((child.props as any).value ?? "");
      const label = String((child.props as any).children ?? "");
      const disabled = Boolean((child.props as any).disabled ?? false);
      out.push({ value, label, disabled });
    }
  });
  return out;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const {
    children,
    value,
    defaultValue,
    onChange,
    disabled,
    style,
    ...rest
  } = props;

  const options = React.useMemo(() => toOptionList(children), [children]);

  const isControlled = value != null;
  const [internalValue, setInternalValue] = React.useState<string>(() => {
    if (isControlled) return String(value);
    if (defaultValue != null) return String(defaultValue);
    // fall back to first option
    return options[0]?.value ?? "";
  });

  React.useEffect(() => {
    if (isControlled) setInternalValue(String(value));
  }, [isControlled, value]);

  const currentValue = isControlled ? String(value) : internalValue;
  const selected = options.find((o) => o.value === currentValue) ?? null;

  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const commitValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternalValue(next);

      if (onChange) {
        // Provide the shape Beholden code expects (e.target.value).
        const evt = { target: { value: next } } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(evt);
      }
    },
    [isControlled, onChange]
  );

  // Allow callers to control width via style.width/minWidth.
  const width = (style as any)?.width;
  const minWidth = (style as any)?.minWidth;

  const triggerBase: React.CSSProperties = {
    width,
    minWidth,
    padding: "8px 10px",
    borderRadius: theme.radius.control,
    border: `2px solid ${theme.colors.accent}`,
    background: theme.colors.inputBg,
    color: theme.colors.text,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    userSelect: "none"
  };

  const menuStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    background: theme.colors.panelBg,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.control,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
    zIndex: 2000
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block", width, minWidth }}>
      {/* Hidden native select for semantics / forms */}
      <select
        {...rest}
        value={currentValue}
        disabled={disabled}
        onChange={(e) => commitValue(e.target.value)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0 }}
      >
        {children}
      </select>

      <div
        role="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        style={triggerBase}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? "Select"}
        </span>
        <span style={{ opacity: 0.75, fontWeight: 900 }}>▾</span>
      </div>

      {open ? (
        <div role="listbox" style={menuStyle}>
          {options.map((o) => {
            const isSel = o.value === currentValue;
            const isDis = Boolean(o.disabled);
            return (
              <div
                key={o.value}
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  if (isDis) return;
                  commitValue(o.value);
                  setOpen(false);
                }}
                style={{
                  padding: "10px 12px",
                  cursor: isDis ? "not-allowed" : "pointer",
                  background: isSel ? theme.colors.accent : theme.colors.panelBg,
                  color: isSel ? "#000" : theme.colors.text,
                  fontWeight: isSel ? 900 : 700,
                  opacity: isDis ? 0.45 : 1,
                  borderBottom: `1px solid ${theme.colors.panelBorder}`
                }}
              >
                {o.label}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
