import * as React from "react";
import { PALETTE, withAlpha } from "../../ui/colors";

export type ItemEditorRequest = <T = unknown>(path: string, init?: RequestInit) => Promise<T>;

const ItemEditorContext = React.createContext<ItemEditorRequest | null>(null);

export function ItemEditorProvider({ request, children }: { request: ItemEditorRequest; children: React.ReactNode }) {
  return <ItemEditorContext.Provider value={request}>{children}</ItemEditorContext.Provider>;
}

export function useItemEditorRequest(): ItemEditorRequest {
  const request = React.useContext(ItemEditorContext);
  if (!request) throw new Error("ItemEditorProvider is required");
  return request;
}

export const theme = {
  colors: {
    ...PALETTE,
    inputBg: "rgba(255,255,255,0.045)",
    accentHighlightBorder: withAlpha(PALETTE.accentHighlight, 0.55),
    accentHighlightBg: withAlpha(PALETTE.accentHighlight, 0.12),
  },
  radius: 8,
};

export { withAlpha };

export const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  border: `1px solid ${PALETTE.panelBorder}`, background: "rgba(255,255,255,0.045)",
  color: PALETTE.text, fontSize: "var(--fs-medium)", outline: "none",
};

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...fieldStyle, resize: "vertical", ...props.style }} />;
}

export function Button({ variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const color = variant === "danger" ? PALETTE.red : PALETTE.accentPrimary;
  return <button {...props} style={{ padding: "8px 14px", borderRadius: 8, cursor: props.disabled ? "not-allowed" : "pointer", fontWeight: 700, opacity: props.disabled ? 0.6 : 1, border: variant === "ghost" ? `1px solid ${PALETTE.panelBorder}` : "none", background: variant === "ghost" ? "transparent" : color, color: variant === "ghost" ? PALETTE.text : PALETTE.textDark, ...props.style }} />;
}

export function togglePillStyle(active: boolean): React.CSSProperties {
  return { padding: "6px 10px", borderRadius: 999, cursor: "pointer", fontWeight: 700, border: `1px solid ${active ? PALETTE.accentHighlight : PALETTE.panelBorder}`, background: active ? withAlpha(PALETTE.accentHighlight, 0.15) : "transparent", color: active ? PALETTE.accentHighlight : PALETTE.muted };
}

type SpellRow = { id: string; name: string; level?: number | null };
export function useSpellSearch() {
  const request = useItemEditorRequest();
  const [q, setQ] = React.useState("");
  const [rows, setRows] = React.useState<SpellRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [rulesetFilter, setRulesetFilter] = React.useState<"5e" | "5.5e">("5.5e");
  React.useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const query = new URLSearchParams({ q, ruleset: rulesetFilter, limit: "80", lite: "1" });
    request<SpellRow[]>(`/api/spells/search?${query}`).then((result) => { if (!cancelled) setRows(result); }).catch(() => { if (!cancelled) setRows([]); }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [q, request, rulesetFilter]);
  return { q, setQ, rows, busy, rulesetFilter, setRulesetFilter };
}
