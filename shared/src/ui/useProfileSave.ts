import React from "react";
import { api, jsonInit } from "../api/browserClient";
import type { AuthUser } from "./AuthContext";

/** Serialize the account forms and discard responses after the view closes. */
export function useProfileSave(onSaved: (user: AuthUser, token: string) => void) {
  const [busy, setBusy] = React.useState(false);
  const pending = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => { pending.current?.abort(); }, []);

  const save = React.useCallback(async (body: Record<string, string | number>): Promise<boolean> => {
    if (pending.current) return false;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const response = await api<{ user: AuthUser; token: string }>("/api/me/profile", {
        ...jsonInit("PUT", body), signal: controller.signal,
      });
      if (controller.signal.aborted) return false;
      onSaved(response.user, response.token);
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      throw error;
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }, [onSaved]);

  return { busy, save };
}
