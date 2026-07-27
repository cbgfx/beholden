// web-dm/src/components/iconPicker/IconPicker.tsx
//
// A reusable, Notion-style icon picker. Knows nothing about Organizations,
// Positions, or POIs — callers just read/write an `icon` string (or null).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Modal } from "@/components/overlay/Modal";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { theme, withAlpha } from "@/theme/theme";
import { EntityIcon } from "./EntityIcon";
import {
  normalizeIconSearchText,
  toGameIconId,
  trimGameIconPrefix,
  useGameIconNames,
} from "./gameIconsCollection";

const MAX_VISIBLE_RESULTS = 100;
/** Approximate tile footprint (including gap) used to derive a column count for arrow-key navigation. */
const TILE_WIDTH_PX = 88;

export function IconPicker(props: {
  value: string | null;
  onChange: (icon: string | null) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const currentName = props.value ? trimGameIconPrefix(props.value) : null;

  return (
    <div style={{ display: "grid", gap: 7 }}>
      {props.label ? (
        <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>{props.label}</div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          onDoubleClick={() => {
            if (props.value) props.onChange(null);
          }}
          title={props.value ? "Double-click to clear" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: theme.radius.control,
            border: `1px dashed ${theme.colors.panelBorder}`,
            background: withAlpha(theme.colors.accentPrimary, 0.08),
            flex: "0 0 auto",
          }}
        >
          <EntityIcon icon={props.value} size={22} />
        </span>
        <span style={{ fontSize: "var(--fs-body)", color: currentName ? theme.colors.text : theme.colors.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentName ?? "No icon"}
        </span>
        <Button variant="ghost" onClick={() => setOpen(true)} style={{ fontSize: "var(--fs-subtitle)", padding: "5px 10px" }}>
          Change
        </Button>
      </div>
      {open ? (
        <IconPickerModal
          value={props.value}
          onSelect={(icon) => {
            props.onChange(icon);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

function IconPickerModal(props: {
  value: string | null;
  onSelect: (icon: string) => void;
  onClose: () => void;
}) {
  const names = useGameIconNames();
  const [query, setQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [columns, setColumns] = useState(6);
  const gridRef = useRef<HTMLDivElement>(null);

  const searchTokens = useMemo(
    () => normalizeIconSearchText(query).split(/\s+/).filter(Boolean),
    [query],
  );

  const filtered = useMemo(() => {
    if (!names) return [];
    if (!searchTokens.length) return names;
    return names.filter((name) => {
      const haystack = normalizeIconSearchText(name);
      return searchTokens.every((token) => haystack.includes(token));
    });
  }, [names, searchTokens]);

  const visible = useMemo(() => filtered.slice(0, MAX_VISIBLE_RESULTS), [filtered]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [query]);

  useEffect(() => {
    const measure = () => {
      const width = gridRef.current?.clientWidth ?? 0;
      setColumns(Math.max(1, Math.floor(width / TILE_WIDTH_PX)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!visible.length) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setFocusedIndex((i) => Math.min(visible.length - 1, i + 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - 1));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((i) => Math.min(visible.length - 1, i + columns));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((i) => Math.max(0, i - columns));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const picked = visible[focusedIndex];
      if (picked) props.onSelect(toGameIconId(picked));
    }
  }

  return (
    <Modal isOpen title="Choose an icon" onClose={props.onClose} width={640} height={560}>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%" }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${theme.colors.panelBorder}` }}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search icons…"
            autoFocus
          />
        </div>
        <div style={{ overflowY: "auto", padding: 14 }}>
          {!names ? (
            <div style={{ textAlign: "center", color: theme.colors.muted, padding: 40 }}>Loading icons…</div>
          ) : !visible.length ? (
            <div style={{ textAlign: "center", color: theme.colors.muted, padding: 40 }}>No icons match &ldquo;{query}&rdquo;.</div>
          ) : (
            <>
              <div
                ref={gridRef}
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 6 }}
              >
                {visible.map((name, index) => {
                  const iconId = toGameIconId(name);
                  const selected = iconId === props.value;
                  const focused = index === focusedIndex;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => props.onSelect(iconId)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      title={name}
                      style={{
                        display: "grid",
                        justifyItems: "center",
                        gap: 4,
                        padding: "9px 4px",
                        borderRadius: theme.radius.control,
                        border: selected
                          ? `2px solid ${theme.colors.accentPrimary}`
                          : focused
                            ? `1px solid ${theme.colors.accentPrimary}`
                            : "1px solid transparent",
                        background: focused ? withAlpha(theme.colors.accentPrimary, 0.1) : "transparent",
                        cursor: "pointer",
                        color: theme.colors.text,
                        minWidth: 0,
                      }}
                    >
                      <EntityIcon icon={iconId} size={26} />
                      <span
                        style={{
                          fontSize: "var(--fs-small)",
                          color: theme.colors.muted,
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {filtered.length > visible.length ? (
                <div style={{ textAlign: "center", color: theme.colors.muted, fontSize: "var(--fs-small)", marginTop: 12 }}>
                  Showing {visible.length} of {filtered.length} matches — refine your search to see more.
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
