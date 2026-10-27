import { useEffect, useState } from "react";
import { MarkdownRichText } from "@beholden/shared/ui";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { api } from "@/services/api";
import { theme } from "@/theme/theme";

export function PlayerBackground({ campaignId, playerId }: { campaignId: string; playerId: string }) {
  const t = useUiTranslation("dmUi");
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setText(null); setError(false);
    void api<{ text: string }>(`/api/campaigns/${campaignId}/players/${playerId}/background`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setText(value.text); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [campaignId, playerId, attempt]);
  return <div style={{ padding: "12px 16px", color: theme.colors.text, border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 10 }}>
    {error ? <div role="alert">{t("Could not load background.")} <button type="button" onClick={() => setAttempt((value) => value + 1)}>{t("Retry")}</button></div>
      : text === null ? t("Loading?") : text.trim() ? <MarkdownRichText text={text} /> : <span style={{ color: theme.colors.muted }}>{t("No background provided yet.")}</span>}
  </div>;
}
