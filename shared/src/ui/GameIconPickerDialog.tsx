import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Icon } from "@iconify/react";
import { useUiTranslation } from "../i18n/useUiTranslation";
import { ModalFrame } from "./ModalFrame";
import { LAYOUT_COLORS as C } from "./layoutTheme";
import { PALETTE, withAlpha } from "./colors";
import {
  normalizeIconSearchText,
  toGameIconId,
  useGameIconNames,
} from "./gameIconsCollection";

const MAX_VISIBLE_RESULTS = 100;
// Tile width plus gap: used for keyboard up/down navigation after resize.
const TILE_WIDTH_PX = 88;

/** One searchable Game Icons catalog for Binder and both layout editors. */
export function GameIconPickerDialog(props: {
  value?: string | null;
  onSelect: (icon: `game-icons:${string}` | undefined) => void;
  onClose: () => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
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

  const visible = useMemo(
    () => filtered.slice(0, MAX_VISIBLE_RESULTS),
    [filtered],
  );

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
    <ModalFrame
      isOpen
      title={translateUi("Choose an icon")}
      onClose={props.onClose}
      width={640}
      height={560}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          height: "100%",
        }}
      >
        <div
          style={{ padding: 14, borderBottom: `1px solid ${C.panelBorder}` }}
        >
          <input
            aria-label={translateUi("Search icons")}
            style={{
              width: "100%",
              boxSizing: "border-box",
              minHeight: 44,
              padding: 10,
              borderRadius: 8,
              background: C.bg,
              color: C.text,
              border: `1px solid ${C.panelBorder}`,
            }}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={translateUi("Search icons…")}
            autoFocus
          />
          <button
            type="button"
            onClick={() => props.onSelect(undefined)}
            style={{
              marginTop: 8,
              minHeight: 44,
              padding: "6px 12px",
              borderRadius: 8,
              background: "transparent",
              color: C.text,
              border: `1px solid ${C.panelBorder}`,
              cursor: "pointer",
            }}
          >
            {translateUi("Reset icon")}
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 14 }}>
          {!names ? (
            <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
              {translateUi("Loading icons…")}
            </div>
          ) : !visible.length ? (
            <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>
              {translateUi("No icons match “")}
              {query}
              {translateUi("”.")}
            </div>
          ) : (
            <>
              <div
                ref={gridRef}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                  gap: 6,
                }}
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
                        borderRadius: 8,
                        border: selected
                          ? `2px solid ${PALETTE.accentPrimary}`
                          : focused
                            ? `1px solid ${PALETTE.accentPrimary}`
                            : "1px solid transparent",
                        background: focused
                          ? withAlpha(PALETTE.accentPrimary, 0.1)
                          : "transparent",
                        cursor: "pointer",
                        color: C.text,
                        minWidth: 0,
                      }}
                    >
                      <Icon icon={iconId} width={26} height={26} />
                      <span
                        style={{
                          fontSize: "var(--fs-small)",
                          color: C.muted,
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
                <div
                  style={{
                    textAlign: "center",
                    color: C.muted,
                    fontSize: "var(--fs-small)",
                    marginTop: 12,
                  }}
                >
                  {translateUi("Showing")} {visible.length} {translateUi("of")}{" "}
                  {filtered.length}{" "}
                  {translateUi("matches — refine your search to see more.")}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </ModalFrame>
  );
}
