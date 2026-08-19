import * as React from "react";
import { PALETTE, withAlpha } from "../../ui/colors";
import { Button as SharedButton } from "../../ui/Button";
import { Input as SharedInput } from "../../ui/Input";
import { TextArea as SharedTextArea } from "../../ui/TextArea";

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

// Adapts the item-editor's local `theme` (nested under `colors`) to the flat shape
// shared/ui's Input/TextArea/Button expect, so this package's forms get the same
// themed components — hover/press states included — as the rest of the app instead
// of a hand-rolled lookalike.
const uiTheme = {
  radius: theme.radius,
  text: theme.colors.text,
  textDark: theme.colors.textDark,
  panelBorder: theme.colors.panelBorder,
  accentPrimary: theme.colors.accentPrimary,
  red: theme.colors.red,
  green: theme.colors.green,
  inputBg: theme.colors.inputBg,
};

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <SharedInput {...props} theme={uiTheme} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <SharedTextArea {...props} theme={uiTheme} />;
}

export function Button({ variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return <SharedButton {...props} variant={variant} theme={uiTheme} />;
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
