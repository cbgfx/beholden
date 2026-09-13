import React from "react";
import { useTranslation } from "react-i18next";

type ApiClient = <T>(path: string, init?: RequestInit) => Promise<T>;

export function useUpdateCheck(api: ApiClient, fallbackVersion: string) {
  const { t } = useTranslation("shared");
  const [state, setState] = React.useState({ currentVersion: fallbackVersion, updateAvailable: false });
  const [updating, setUpdating] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const pending = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    const check = () => {
      api<{ ok: boolean; currentVersion?: string; updateAvailable?: boolean }>("/api/update-check")
        .then((result) => {
          if (!cancelled) setState({
            currentVersion: result.currentVersion ?? fallbackVersion,
            updateAvailable: result.ok && result.updateAvailable === true,
          });
        })
        .catch(() => {});
    };
    const idleId = window.requestIdleCallback?.(check, { timeout: 3_000 });
    const timeoutId = idleId === undefined ? window.setTimeout(check, 1_500) : undefined;
    return () => {
      cancelled = true;
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [api, fallbackVersion]);

  const startUpdate = React.useCallback(async () => {
    if (pending.current || !window.confirm(t("updateCheck.confirmPrompt"))) return;
    pending.current = true;
    setUpdating(true);
    setMessage("");
    try {
      const result = await api<{ message?: string }>("/api/update", { method: "POST" });
      setMessage(result.message ?? t("updateCheck.defaultStartedMessage"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("updateCheck.defaultErrorMessage"));
    } finally {
      pending.current = false;
      setUpdating(false);
    }
  }, [api, t]);

  return { ...state, updating, message, startUpdate };
}
