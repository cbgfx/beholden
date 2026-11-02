import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { COMPENDIUM_COLORS as C } from "./compendiumStyle";
import { withAlpha } from "../../ui/colors";

export function CompendiumSectionPicker({
  entries,
  value,
  onChange,
}: {
  entries: { id: string; label: string; icon: ReactNode }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useUiTranslation("sharedUi");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = entries.find((entry) => entry.id === value) ?? entries[0];
  useEffect(() => {
    if (!open) return;
    (
      menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]') ??
      menu.current?.querySelector("button")
    )?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={root}
      style={{ position: "relative", minWidth: 0 }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={t("Reference")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          minHeight: 44,
          padding: "10px 12px",
          border: `1px solid ${C.panelBorder}`,
          borderRadius: 10,
          background: C.panelBg,
          color: C.text,
          font: "inherit",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {selected?.icon}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            textAlign: "left",
            overflowWrap: "anywhere",
          }}
        >
          {selected?.label}
        </span>
        <span
          aria-hidden="true"
          style={{
            color: C.muted,
            transform: open ? "rotate(180deg)" : undefined,
          }}
        >
          ⌄
        </span>
      </button>
      {open ? (
        <div
          id={id}
          ref={menu}
          role="menu"
          aria-label={t("Reference")}
          onKeyDown={(event) => {
            const buttons = Array.from(
              menu.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
            );
            const index = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            } else if (
              ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        buttons.length) %
                      buttons.length;
              buttons[next]?.focus();
            }
          }}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            padding: 6,
            display: "grid",
            gap: 3,
            maxHeight: "min(420px, 60dvh)",
            overflowY: "auto",
            borderRadius: 12,
            border: `1px solid ${C.panelBorder}`,
            background: C.bg,
            boxShadow: "0 12px 32px #0008",
          }}
        >
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="menuitemradio"
              aria-checked={entry.id === value}
              onClick={() => {
                setOpen(false);
                onChange(entry.id);
                trigger.current?.focus();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                minHeight: 44,
                padding: "9px 12px",
                border: 0,
                borderRadius: 8,
                background:
                  entry.id === value
                    ? withAlpha(C.highlight, 0.12)
                    : "transparent",
                color: entry.id === value ? C.highlight : C.text,
                font: "inherit",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              {entry.icon}
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                {entry.label}
              </span>
              {entry.id === value ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
