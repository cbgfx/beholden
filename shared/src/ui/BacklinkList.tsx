import { Link } from "react-router-dom";
import {
  backlinkDestination,
  type BinderBacklink,
} from "../domain/binderBacklinks";
import { useUiTranslation } from "../i18n/useUiTranslation";
import { LAYOUT_COLORS as C } from "./layoutTheme";

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  backstory: "Backstory",
  dm_notes: "DM Notes",
  campaign_story: "Campaign Story",
  campaign_notes: "Campaign Notes",
};

/** Data is permission-filtered by the caller; excerpts are plain text, never HTML. */
export function BacklinkList({
  rows,
  targetId,
  loading = false,
  error,
  onRetry,
}: {
  rows: BinderBacklink[];
  targetId: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const t = useUiTranslation("sharedUi");
  return (
    <section
      aria-label={t("Mentioned in")}
      style={{
        borderTop: `1px solid ${C.panelBorder}`,
        paddingTop: 16,
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <strong>{t("Mentioned in")}</strong>
      {loading ? (
        <span role="status" style={{ color: C.muted }}>
          {t("Loading mentions…")}
        </span>
      ) : error ? (
        <div role="alert">
          {t(error)}{" "}
          {onRetry ? (
            <button type="button" onClick={onRetry} style={{ minHeight: 44 }}>
              {t("Retry")}
            </button>
          ) : null}
        </div>
      ) : !rows.length ? (
        <span style={{ color: C.muted }}>{t("No mentions yet.")}</span>
      ) : (
        rows.map((row) => (
          <article
            key={`${row.type}:${row.id}`}
            style={{
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 10,
              padding: 10,
              minWidth: 0,
            }}
          >
            <strong
              style={{
                display: "block",
                overflowWrap: "anywhere",
                marginBottom: 6,
              }}
            >
              {row.name}
            </strong>
            {row.contexts.map((context) => (
              <Link
                key={`${context.field}:${context.occurrence}`}
                to={backlinkDestination(row.route, targetId, context)}
                style={{
                  display: "block",
                  padding: "9px 6px",
                  minHeight: 44,
                  boxSizing: "border-box",
                  color: C.text,
                  textDecoration: "none",
                  overflowWrap: "anywhere",
                }}
              >
                <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>
                  {t(FIELD_LABELS[context.field] ?? context.field)}
                </span>
                <p style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
                  {context.before}
                  <mark
                    style={{
                      borderRadius: 4,
                      color: "inherit",
                      background: "rgba(125,211,252,.18)",
                    }}
                  >
                    {context.mention}
                  </mark>
                  {context.after}
                </p>
              </Link>
            ))}
          </article>
        ))
      )}
    </section>
  );
}
