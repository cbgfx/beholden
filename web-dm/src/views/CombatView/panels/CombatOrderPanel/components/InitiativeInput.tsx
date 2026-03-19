import React from "react";
import { theme } from "@/theme/theme";

export function InitiativeInput(props: { value: number | null | undefined; onCommit: (n: number) => void }) {
  const { value, onCommit } = props;
  const [v, setV] = React.useState(() => (value && value > 0 ? String(value) : ""));

  React.useEffect(() => {
    setV(value && value > 0 ? String(value) : "");
  }, [value]);

  return (
    <input
      data-initiative-input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        const k = String(e.key || "").toLowerCase();
        const allowHotkey = !e.altKey && !e.ctrlKey && !e.metaKey && (k === "n" || k === "p");
        if (!allowHotkey) e.stopPropagation();
        if (e.key === "Enter") {
          const current = e.target as HTMLInputElement;
          // Find the next empty initiative input in DOM order
          const all = Array.from(document.querySelectorAll<HTMLInputElement>("[data-initiative-input]"));
          const idx = all.indexOf(current);
          const nextEmpty = all.slice(idx + 1).find((el) => el.value === "");
          current.blur(); // triggers onBlur → onCommit
          if (nextEmpty) {
            // Wait one frame for React to re-render after commit, then focus
            requestAnimationFrame(() => {
              nextEmpty.focus();
              nextEmpty.select();
            });
          }
        }
      }}
      onBlur={() => {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        onCommit(Math.max(0, Math.floor(n)));
      }}
      placeholder="–"
      style={{
        width: 48,
        padding: "4px 6px",
        borderRadius: 6,
        border: `1px solid ${theme.colors.panelBg}`,
        background: theme.colors.panelBg,
        color: theme.colors.text,
        textAlign: "center",
        fontSize: "var(--fs-pill)"
      }}
    />
  );
}
