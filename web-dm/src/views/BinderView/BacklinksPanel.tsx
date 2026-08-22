import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme/theme";
import { fetchBinderBacklinks, type BinderBacklink } from "@/services/binderLoreApi";
import { Button } from "@/ui/Button";

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  dm_notes: "DM Notes",
};

export function BacklinksPanel(props: { binderId: string; recordId: string }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BinderBacklink[]>([]);
  const reload = useCallback(async () => setRows(await fetchBinderBacklinks(props.binderId, props.recordId)), [props.binderId, props.recordId]);
  useEffect(() => { void reload(); }, [reload]);
  return <section style={{ borderTop: `1px solid ${theme.colors.panelBorder}`, paddingTop: 16, display: "grid", gap: 10 }}>
    <strong>Mentioned in</strong>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {rows.map((row) => (
        <Button
          key={row.id}
          type="button"
          variant="ghost"
          onClick={() => navigate(row.route)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 8px", borderRadius: 7, font: "inherit" }}
        >
          <b>{row.name}</b>
          <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            {row.fields.map((field) => FIELD_LABELS[field] ?? field).join(", ")}
          </span>
        </Button>
      ))}
      {!rows.length ? <span style={{ color: theme.colors.muted }}>None</span> : null}
    </div>
  </section>;
}
