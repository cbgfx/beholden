import React from "react";
import ReactDOM from "react-dom";

type OptionLike = { value: string; label: string; disabled?: boolean };

type SharedSelectTheme = {
  radius: string | number;
  panelBorder: string;
  inputBg: string;
  bg: string;
  text: string;
  textDark: string;
  accentHighlight: string;
  withAlpha: (color: string, alpha: number) => string;
};

function toOptionList(children: React.ReactNode): OptionLike[] {
  const out: OptionLike[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if ((child.type as any) === "option") {
      const value = String((child.props as any).value ?? "");
      const raw = (child.props as any).children;
      const label = Array.isArray(raw)
        ? raw.map((c: unknown) => String(c ?? "")).join("")
        : String(raw ?? "");
      const disabled = Boolean((child.props as any).disabled ?? false);
      out.push({ value, label, disabled });
    }
  });
  return out;
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    theme: SharedSelectTheme;
  },
) {
  const { children, value, defaultValue, onChange, disabled, style, theme, ...rest } = props;

  const options = React.useMemo(() => toOptionList(children), [children]);

  const isControlled = value != null;
  const [internalValue, setInternalValue] = React.useState<string>(() => {
    if (isControlled) return String(value);
    if (defaultValue != null) return String(defaultValue);
    return options[0]?.value ?? "";
  });

  React.useEffect(() => {
    if (isControlled) setInternalValue(String(value));
  }, [isControlled, value]);

  const currentValue = isControlled ? String(value) : internalValue;
  const selected = options.find((o) => o.value === currentValue) ?? null;

  const [open, setOpen] = React.useState(false);
  const [hoveredValue, setHoveredValue] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const computeMenuPos = React.useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    computeMenuPos();
    window.addEventListener("scroll", computeMenuPos, true);
    window.addEventListener("resize", computeMenuPos);
    return () => {
      window.removeEventListener("scroll", computeMenuPos, true);
      window.removeEventListener("resize", computeMenuPos);
    };
  }, [open, computeMenuPos]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const commitValue = React.useCallback((next: string) => {
    if (!isControlled) setInternalValue(next);
    if (onChange) {
      const evt = { target: { value: next } } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(evt);
    }
  }, [isControlled, onChange]);

  const width = (style as any)?.width;
  const minWidth = (style as any)?.minWidth;

  const triggerStyle: React.CSSProperties = {
    width,
    minWidth,
    padding: "6px 10px",
    borderRadius: theme.radius,
    border: `1px solid ${theme.panelBorder}`,
    background: theme.inputBg,
    color: theme.text,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    userSelect: "none",
    outline: "none",
    boxShadow: "none",
  };

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: menuPos.top,
    left: menuPos.left,
    width: menuPos.width,
    background: theme.bg,
    border: `1px solid ${theme.panelBorder}`,
    borderRadius: theme.radius,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
    zIndex: 999999,
    maxHeight: 280,
  };

  const menu = open ? (
    <div ref={menuRef} role="listbox" style={menuStyle}>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {options.map((o) => {
          const isSel = o.value === currentValue;
          const isDis = Boolean(o.disabled);
          const isHov = hoveredValue === o.value && !isSel;
          return (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={isSel}
              disabled={isDis}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHoveredValue(o.value)}
              onMouseLeave={() => setHoveredValue(null)}
              onClick={() => {
                if (isDis) return;
                commitValue(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: isSel
                  ? theme.accentHighlight
                  : isHov
                    ? theme.withAlpha(theme.accentHighlight, 0.12)
                    : theme.bg,
                color: isSel ? theme.textDark : theme.text,
                fontWeight: isSel ? 900 : 700,
                cursor: isDis ? "not-allowed" : "pointer",
                opacity: isDis ? 0.45 : 1,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block", width, minWidth }}>
      <select
        {...rest}
        value={currentValue}
        disabled={disabled}
        onChange={(e) => commitValue(e.target.value)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", height: 0, width: 0 }}
      >
        {children}
      </select>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
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
        style={triggerStyle}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected?.label ?? "Select"}
        </span>
        <span style={{ opacity: 0.75, fontWeight: 900 }}>▾</span>
      </button>

      {open ? ReactDOM.createPortal(menu, document.body) : null}
    </div>
  );
}
