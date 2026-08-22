import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme/theme";
import { fetchBinderRelatedRecords, type BinderRelatedRecord } from "@/services/binderLoreApi";
import { Button } from "@/ui/Button";

export function RelatedRecordsPanel(props: { binderId: string; recordId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BinderRelatedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchBinderRelatedRecords(props.binderId, props.recordId)); }
    finally { setLoading(false); }
  }, [props.binderId, props.recordId]);
  useEffect(() => { setOpen(false); void reload(); }, [reload]);
  const groups = useMemo(() => rows.reduce<Record<string, BinderRelatedRecord[]>>((result, row) => {
    (result[row.relationship] ??= []).push(row);
    return result;
  }, {}), [rows]);

  return <section>
    <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 750, textTransform: "uppercase", letterSpacing: ".06em" }}>Related Records</div>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} style={{ marginTop: 7, padding: 0, border: 0, background: "transparent", color: theme.colors.text, cursor: "pointer", font: "inherit", fontSize: "var(--fs-body)", textDecoration: rows.length ? "underline" : "none", textUnderlineOffset: 3 }}>
      {loading ? "Loading…" : rows.length ? `${rows.length} ${open ? "▴" : "▾"}` : "None"}
    </button>
    {open && rows.length ? <div style={{ display: "grid", gap: 12, marginTop: 12, padding: 12, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, background: theme.colors.inputBg }}>
      {Object.entries(groups).map(([relationship, records]) => <div key={relationship} style={{ display: "grid", gap: 6 }}>
        <strong style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{relationship}</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{records.map((record) => <Button key={`${relationship}:${record.id}`} type="button" variant="ghost" onClick={() => navigate(record.route)} style={{ padding: "5px 8px", borderRadius: 7, font: "inherit" }}><b>{record.name}</b> <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>{record.type}</span></Button>)}</div>
      </div>)}
    </div> : null}
  </section>;
}
