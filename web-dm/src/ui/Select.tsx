import React from "react";
import ReactDOM from "react-dom";
import { theme, withAlpha } from "@/theme/theme";

type OptionLike = { value: string; label: string; disabled?: boolean };

function toOptionList(children: React.ReactNode): OptionLike[] {
  const out: OptionLike[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    // Support <option> only (keeps Beholden simple and predictable)
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

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { children, value, defaultValue, onChange, disabled, style, ...rest } = props;

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

    const onScroll = () => computeMenuPos();
    const onResize = () => computeMenuPos();

    // capture scroll from any scroll container
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, computeMenuPos]);

  React.useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;

      const root = rootRef.current;
      const menu = menuRef.current;

      // IMPORTANT: menu is portaled, so it's not a child of rootRef.
      if (root && root.contains(t)) return;
      if (menu && menu.contains(t)) return;

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

  const triggerStyle: React.CSSProperties = {
    width,
    minWidth,
    padding: "6px 10px",
    borderRadius: theme.radius.control,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: theme.colors.inputBg,
    color: theme.colors.text,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    userSelect: "none",
    outline: "none",
    boxShadow: "none"
  };

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: menuPos.top,
    left: menuPos.left,
    width: menuPos.width,
    background: theme.colors.bg, // opaque background (avoid see-through)
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: theme.radius.control,
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
    zIndex: 999999,
    maxHeight: 280
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
              onMouseDown={(e) => {
                e.preventDefault();
              }}
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
                background: isSel ? theme.colors.accentHighlight : isHov ? withAlpha(theme.colors.accentHighlight, 0.12) : theme.colors.bg,
                color: isSel ? theme.colors.textDark : theme.colors.text,
                fontWeight: isSel ? 900 : 700,
                cursor: isDis ? "not-allowed" : "pointer",
                opacity: isDis ? 0.45 : 1
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
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label ?? "Select"}</span>
        <span style={{ opacity: 0.75, fontWeight: 900 }}>▾</span>
      </button>

      {open ? ReactDOM.createPortal(menu, document.body) : null}
    </div>
  );
}
