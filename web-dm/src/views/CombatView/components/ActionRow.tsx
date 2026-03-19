import React from "react";
import { theme } from "@/theme/theme";

type ActionLike = {
  name?: unknown;
  title?: unknown;
  text?: unknown;
  entries?: unknown;
};

type Props =
  | { title: string; subtitle?: string; row?: undefined }
  | { row: ActionLike; title?: undefined; subtitle?: undefined };

function normalizeText(t: unknown): string {
  if (t == null) return "";
  if (Array.isArray(t)) return t.map((x) => String(x)).join(" ");
  return String(t);
}

export function ActionRow(props: Props) {
  const title = "row" in props
    ? String((props.row?.name ?? props.row?.title ?? "")).trim()
    : String(props.title ?? "").trim();

  const subtitle = "row" in props
    ? normalizeText((props.row as any)?.text ?? (props.row as any)?.entries)
    : normalizeText(props.subtitle);

  if (!title && !subtitle) return null;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: theme.colors.panelBg,
        border: `1px solid ${theme.colors.panelBorder}`
      }}
    >
      {title ? <div style={{ color: theme.colors.text, fontWeight: 900, fontSize: "var(--fs-medium)" }}>{title}</div> : null}
      {subtitle ? (
        <div style={{ marginTop: 4, color: theme.colors.muted, fontSize: "var(--fs-medium)", lineHeight: 1.35 }}>{subtitle}</div>
      ) : null}
    </div>
  );
}
