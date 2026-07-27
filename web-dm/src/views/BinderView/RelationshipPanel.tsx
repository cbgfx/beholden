import { useCallback, useEffect, useState } from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { theme } from "@/theme/theme";
import {
  createBinderRelationship, deleteBinderRelationship, fetchBinderRelationships,
  type BinderRecordOption, type BinderRelationship,
} from "@/services/binderLoreApi";

const CATEGORIES = ["family", "friend", "enemy", "rival", "ally", "mentor", "student", "spouse", "parent", "child", "sibling", "other"];

export function RelationshipPanel(props: { binderId: string; recordId: string; records: BinderRecordOption[]; canEdit: boolean }) {
  const [rows, setRows] = useState<BinderRelationship[]>([]);
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState("family");
  const [label, setLabel] = useState("");
  const reload = useCallback(async () => setRows(await fetchBinderRelationships(props.binderId, props.recordId)), [props.binderId, props.recordId]);
  useEffect(() => { void reload(); }, [reload]);
  return <section style={{ borderTop: `1px solid ${theme.colors.panelBorder}`, paddingTop: 16, display: "grid", gap: 10 }}>
    <strong>Relationships</strong>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {rows.map((row) => {
        const outgoing = row.sourceRecordId === props.recordId;
        const name = outgoing ? row.targetName : row.sourceName;
        const display = outgoing ? row.sourceLabel : row.targetLabel;
        return <span key={row.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 8px", border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 7, background: "rgba(255,255,255,.055)" }}>
          <b>{display || row.category}</b> · {name}
          {props.canEdit ? <button type="button" onClick={async () => { await deleteBinderRelationship(props.binderId, row.id); await reload(); }} style={{ border: 0, color: theme.colors.colorPinkRed, background: "transparent", cursor: "pointer" }}>×</button> : null}
        </span>;
      })}
      {!rows.length ? <span style={{ color: theme.colors.muted }}>None</span> : null}
    </div>
    {props.canEdit ? <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 150px minmax(150px,.8fr) auto", gap: 7 }}>
      <select value={target} onChange={(event) => setTarget(event.target.value)} style={{ minWidth: 0, background: theme.colors.inputBg, color: theme.colors.text, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, padding: 8 }}>
        <option value="">Choose record…</option>
        {props.records.filter((row) => row.id !== props.recordId).map((row) => <option key={row.id} value={row.id}>{row.name} · {row.type}</option>)}
      </select>
      <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ background: theme.colors.inputBg, color: theme.colors.text, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.control, padding: 8 }}>
        {CATEGORIES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
      </select>
      <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={category === "family" ? "cousin, half-brother…" : "Display label"} />
      <Button disabled={!target} onClick={async () => {
        await createBinderRelationship(props.binderId, {
          sourceRecordId: props.recordId, targetRecordId: target, category,
          sourceLabel: label || null, targetLabel: label || null,
          isSymmetric: ["family","friend","enemy","rival","ally","spouse","sibling"].includes(category),
        });
        setTarget(""); setLabel(""); await reload();
      }}>Add</Button>
    </div> : null}
  </section>;
}
