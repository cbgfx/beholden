import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/ui/Input";
import { theme } from "@/theme/theme";
import { fetchBinderRecordOptions, type BinderRecordOption } from "@/services/binderLoreApi";

export function BinderGlobalSearch({ binderId }: { binderId: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<BinderRecordOption[]>([]);
  useEffect(() => {
    const value = query.trim();
    if (!value) { setRows([]); return; }
    const timer = window.setTimeout(() => void fetchBinderRecordOptions(binderId, value).then(setRows), 180);
    return () => window.clearTimeout(timer);
  }, [binderId, query]);
  return <div style={{ position: "relative", width: "min(420px, 100%)" }}>
    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this Binder…" aria-label="Search this Binder" />
    {query.trim() ? <div style={{ position: "absolute", zIndex: 20, top: "calc(100% + 5px)", left: 0, right: 0, maxHeight: 330, overflow: "auto", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 9, background: theme.colors.panelBg, boxShadow: "0 12px 30px rgba(0,0,0,.45)" }}>
      {rows.map((row) => <button key={row.id} type="button" onClick={() => { navigate(row.route); setQuery(""); }} style={{ width: "100%", padding: "10px 12px", border: 0, borderBottom: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, display: "flex", justifyContent: "space-between", cursor: "pointer" }}><strong>{row.name}</strong><span style={{ color: theme.colors.muted, textTransform: "capitalize" }}>{row.type}</span></button>)}
      {!rows.length ? <div style={{ padding: 14, color: theme.colors.muted }}>No matching records.</div> : null}
    </div> : null}
  </div>;
}
