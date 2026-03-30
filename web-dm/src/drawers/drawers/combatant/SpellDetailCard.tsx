import React from "react";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";

export function SpellDetailCard(props: {
  open: boolean;
  loading: boolean;
  error: string | null;
  detail: any | null;
  onClose: () => void;
}) {
  if (!props.open) return null;
  return (
    <div
      style={{
        marginTop: 6,
        padding: 12,
        borderRadius: 14,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: withAlpha(theme.colors.panelBorder, 0.10)
      }}
    >
      {props.loading ? (
        <div style={{ color: theme.colors.muted }}>Loading spell…</div>
      ) : props.error ? (
        <div style={{ color: theme.colors.red, fontWeight: 800 }}>{props.error}</div>
      ) : props.detail ? (
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ color: theme.colors.text, fontWeight: 900, fontSize: "var(--fs-subtitle)" }}>{props.detail.name}</div>
            <div style={{ color: theme.colors.muted, fontWeight: 800 }}>
              {Number(props.detail.level) === 0 ? "Cantrip" : `L${props.detail.level ?? "?"}`}
              {props.detail.school ? ` • ${props.detail.school}` : ""}
            </div>
          </div>

          <div style={{ color: theme.colors.muted }}>
            {[props.detail.time, props.detail.range, props.detail.duration].filter(Boolean).join(" • ")}
          </div>

          {props.detail.components ? <div style={{ color: theme.colors.muted }}>Components: {props.detail.components}</div> : null}

          <div style={{ color: theme.colors.text, whiteSpace: "pre-wrap" }}>
            {Array.isArray(props.detail.text) ? props.detail.text.filter(Boolean).join("\n") : String(props.detail.text ?? "")}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <Button variant="ghost" onClick={props.onClose}>
          Close spell
        </Button>
      </div>
    </div>
  );
}
