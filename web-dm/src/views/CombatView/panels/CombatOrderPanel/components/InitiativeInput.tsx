import React from "react";
import { theme } from "@/theme/theme";

export function InitiativeInput(props: { value: number | null | undefined; onCommit: (n: number) => void }) {
  const { value, onCommit } = props;
  const [v, setV] = React.useState(() => (value == null ? "" : String(value)));

  React.useEffect(() => {
    setV(value == null ? "" : String(value));
  }, [value]);

  const commit = React.useCallback(() => {
    const trimmed = v.trim();
    if (!trimmed) return;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    onCommit(Math.trunc(n));
  }, [onCommit, v]);

  return (
    <input
      data-initiative-input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        const k = String(e.key || "").toLowerCase();
        const allowHotkey = !e.altKey && !e.ctrlKey && !e.metaKey && (k === "n" || k === "p");
        if (!allowHotkey) e.stopPropagation();
        if (e.key === "Enter") {
          const current = e.target as HTMLInputElement;
          const all = Array.from(document.querySelectorAll<HTMLInputElement>("[data-initiative-input]"));
          const idx = all.indexOf(current);
          const nextEmpty = all.slice(idx + 1).find((el) => el.value.trim() === "");
          commit();
          current.blur();
          if (nextEmpty) {
            requestAnimationFrame(() => {
              nextEmpty.focus();
              nextEmpty.select();
            });
          }
        }
      }}
      onBlur={commit}
      placeholder="-"
      style={{
        width: 48,
        padding: "4px 6px",
        borderRadius: 6,
        border: `1px solid ${theme.colors.panelBg}`,
        background: theme.colors.panelBg,
        color: theme.colors.text,
        textAlign: "center",
        fontSize: "var(--fs-pill)",
      }}
    />
  );
}
